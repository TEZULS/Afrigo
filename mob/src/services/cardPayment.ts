/**
 * Paiement par carte d'une commande qui vient d'être créée (2026-10-27).
 *
 * Le formulaire de carte Stripe est affiché dans la page de validation, sous
 * « Carte bancaire » (demande du client) : plus d'écran Paiement ni de fenêtre
 * Stripe à ouvrir. Ce module fait ce que faisait cet écran :
 * 1. `createPaymentIntent` crée le paiement Stripe, rattaché au client Stripe
 *    du compte (`saveCard: true` → carte gardée pour les prochains achats) ;
 * 2. le SDK le confirme avec la carte saisie ou la carte enregistrée. Le site
 *    fait confirmer la carte enregistrée par le serveur (`useSavedCard`), sans
 *    3-D Secure possible : l'app confirme elle-même, la banque peut demander
 *    sa validation ;
 * 3. paiement accepté : portefeuille débité, commande payée, lignes retirées
 *    du panier, carte rangée sur le profil si demandé (fonction `saveCard`,
 *    comme le site) ;
 *    paiement refusé ou abandonné : commande annulée — motif lisible pour le
 *    client, détail technique pour le support — et portefeuille intact.
 */
import { confirmPayment, type BillingDetails } from '@stripe/stripe-react-native';
import { invokeFunction, Order } from '@/api/entities';
import { consumeOrderedLines } from '@/services/cartServerSync';
import { rememberCard } from '@/services/savedCardActions';
import { ensureStripeReady } from '@/services/stripeSetup';
import { debitWalletForOrder } from '@/lib/wallet';
import { GENERIC_PAYMENT_ERROR, orderIssueMessage, userErrorMessage } from '@/lib/userErrors';

/** Carte choisie à la validation. */
export type CardChoice =
  | { kind: 'saved'; paymentMethodId: string }
  /** `replacesSavedCard` : une carte est déjà enregistrée, la nouvelle la remplace. */
  | { kind: 'new'; save: boolean; replacesSavedCard: boolean };

export interface CardPaymentRequest {
  orderId: string;
  /** Montant débité sur la carte (après portefeuille). */
  amount: number;
  /** Part réglée par le portefeuille — débitée seulement une fois la carte acceptée. */
  walletAmount: number;
  /** Lignes du panier commandées (sélection du panier). */
  lineKeys?: string[];
  customer: { email: string; walletBalance: number; name?: string };
  card: CardChoice;
}

export type CardPaymentOutcome =
  | { status: 'paid'; cardSaved: boolean }
  /** Le client a fermé la validation de sa banque : rien n'est débité. */
  | { status: 'canceled' }
  /** Paiement impossible à lancer (`init`) ou refusé (`confirm`), message pour le client. */
  | { status: 'failed'; stage: 'init' | 'confirm'; message: string };

interface CreatePaymentIntentResponse {
  clientSecret?: string;
  /** Renvoyé par la fonction quand Stripe n'est pas configuré côté admin. */
  error?: string;
}

/** Statuts d'un paiement accepté (« Processing » : la banque finit de le traiter). */
const ACCEPTED_STATUSES = new Set(['Succeeded', 'Processing', 'RequiresCapture']);

let inProgress = false;
/** Paiement en cours : la validation de la banque peut se faire hors de l'app. */
export const isCardPaymentInProgress = (): boolean => inProgress;

/**
 * Commande marquée échouée + annulée : l'admin ne la voit pas passer.
 * `cancellation_reason` est lu par le client sur le détail de commande, il
 * reste en français ; `payment_failure_reason` garde le détail pour le support.
 */
const cancelOrder = async (orderId: string, clientReason: string, technicalDetail?: string) => {
  try {
    await Order().update?.(orderId, {
      status: 'cancelled',
      payment_status: 'failed',
      payment_failure_reason: technicalDetail ?? clientReason,
      cancelled_by_role: 'client',
      cancellation_reason: clientReason,
    });
  } catch {
    /* best-effort */
  }
};

/** Titulaire de la carte ; le pays et le code postal saisis dans le formulaire priment. */
const billingDetailsOf = (customer: CardPaymentRequest['customer']): BillingDetails => ({
  email: customer.email,
  ...(customer.name ? { name: customer.name } : {}),
  address: { country: 'FR' },
});

const pay = async ({
  orderId,
  amount,
  walletAmount,
  lineKeys,
  customer,
  card,
}: CardPaymentRequest): Promise<CardPaymentOutcome> => {
  const save = card.kind === 'new' && card.save;

  let clientSecret: string;
  try {
    if (!(await ensureStripeReady())) throw new Error('stripe_not_configured');
    const intent = await invokeFunction<CreatePaymentIntentResponse>('createPaymentIntent', {
      orderId,
      amount,
      saveCard: save,
    });
    if (intent?.error) throw new Error(intent.error);
    if (!intent?.clientSecret) throw new Error('missing_client_secret');
    clientSecret = intent.clientSecret;
  } catch (e) {
    const detail = (e as Error | undefined)?.message ?? 'unknown';
    await cancelOrder(orderId, orderIssueMessage('init_failed'), `init_failed: ${detail}`);
    return { status: 'failed', stage: 'init', message: userErrorMessage(e, GENERIC_PAYMENT_ERROR) };
  }

  // Le SDK lit la carte dans le formulaire affiché : il doit rester monté jusqu'ici.
  const { paymentIntent, error } = await confirmPayment(
    clientSecret,
    card.kind === 'saved'
      ? { paymentMethodType: 'Card', paymentMethodData: { paymentMethodId: card.paymentMethodId } }
      : { paymentMethodType: 'Card', paymentMethodData: { billingDetails: billingDetailsOf(customer) } },
  );
  if (error || !paymentIntent || !ACCEPTED_STATUSES.has(paymentIntent.status)) {
    if (error?.code === 'Canceled') {
      await cancelOrder(orderId, 'Paiement annulé par le client');
      return { status: 'canceled' };
    }
    // Le SDK renvoie des messages anglais truffés de codes : ils partent au support.
    const detail = error?.message ?? `status ${paymentIntent?.status ?? 'unknown'}`;
    await cancelOrder(orderId, orderIssueMessage('stripe_error'), `stripe_error: ${detail}`);
    return { status: 'failed', stage: 'confirm', message: userErrorMessage(error, GENERIC_PAYMENT_ERROR) };
  }

  // Paiement acquis : la suite est au mieux, sans jamais le remettre en cause.
  if (walletAmount > 0) {
    await debitWalletForOrder({
      email: customer.email,
      knownBalance: customer.walletBalance,
      amount: walletAmount,
      orderId,
    }).catch(() => {});
  }
  // Le webhook Stripe fait de même côté serveur ; ici, la commande est à jour tout de suite.
  try {
    await Order().update?.(orderId, { payment_status: 'completed', status: 'confirmed' });
  } catch {
    /* best-effort */
  }
  await consumeOrderedLines(customer.email, lineKeys).catch(() => {});
  const cardSaved =
    save && paymentIntent.paymentMethodId
      ? await rememberCard(paymentIntent.paymentMethodId, card.replacesSavedCard)
      : false;
  return { status: 'paid', cardSaved };
};

/** Paie la commande avec la carte choisie ; ne lève jamais d'erreur. */
export const payOrderByCard = async (request: CardPaymentRequest): Promise<CardPaymentOutcome> => {
  inProgress = true;
  try {
    return await pay(request);
  } finally {
    inProgress = false;
  }
};
