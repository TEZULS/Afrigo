/**
 * Carte enregistrée : ajout, remplacement, suppression (2026-10-27).
 *
 * Mêmes fonctions cloud que le site (déployées) : `saveCard` rattache la
 * carte au client Stripe du compte et la range sur le profil, `deleteCard` la
 * détache et vide le profil. Une seule carte par client : en remplacer une
 * détache d'abord l'ancienne, pour qu'aucune carte « oubliée » ne reste
 * rattachée chez Stripe.
 */
import { createPaymentMethod } from '@stripe/stripe-react-native';
import { getBase44 } from '@/api/base44Client';
import { invokeFunction } from '@/api/entities';
import { ensureStripeReady } from '@/services/stripeSetup';
import { GENERIC_PAYMENT_ERROR, rawUserMessage, userErrorMessage } from '@/lib/userErrors';

export type CardActionResult = { ok: true } | { ok: false; message: string };

const SAVE_ERROR = 'Votre carte n’a pas pu être enregistrée. Vérifiez-la, puis réessayez.';
const DELETE_ERROR = 'Votre carte n’a pas pu être supprimée. Réessayez dans un instant.';

/** Message client ; le texte générique « Le paiement n'a pas pu aboutir » est hors sujet ici. */
const saveErrorMessage = (e: unknown): string => {
  const message = userErrorMessage(e, SAVE_ERROR);
  return message === GENERIC_PAYMENT_ERROR ? SAVE_ERROR : message;
};

/** Range le moyen de paiement Stripe sur le profil ; lève une erreur en cas d'échec. */
const attachCard = async (paymentMethodId: string, replacesSavedCard: boolean) => {
  if (replacesSavedCard) await invokeFunction('deleteCard', {}).catch(() => {});
  await invokeFunction('saveCard', { paymentMethodId });
};

/** Après un paiement accepté : garde la carte, sans jamais faire échouer le paiement. */
export const rememberCard = async (paymentMethodId: string, replacesSavedCard: boolean): Promise<boolean> => {
  try {
    await attachCard(paymentMethodId, replacesSavedCard);
    return true;
  } catch {
    return false;
  }
};

/** Paramètres › Paiement : enregistre la carte saisie dans le formulaire affiché. */
export const saveCardFromForm = async ({
  customer,
  replacesSavedCard,
}: {
  customer: { email: string; name?: string };
  replacesSavedCard: boolean;
}): Promise<CardActionResult> => {
  try {
    if (!(await ensureStripeReady())) throw new Error('stripe_not_configured');
    const { paymentMethod, error } = await createPaymentMethod({
      paymentMethodType: 'Card',
      paymentMethodData: {
        billingDetails: {
          email: customer.email,
          ...(customer.name ? { name: customer.name } : {}),
          address: { country: 'FR' },
        },
      },
    });
    if (error) throw error;
    if (!paymentMethod?.id) throw new Error('missing_payment_method');
    await attachCard(paymentMethod.id, replacesSavedCard);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: saveErrorMessage(e) };
  }
};

/** Paramètres › Paiement : supprime la carte enregistrée. */
export const deleteSavedCard = async (): Promise<CardActionResult> => {
  try {
    await invokeFunction('deleteCard', {});
    return { ok: true };
  } catch (e) {
    // Carte déjà retirée chez Stripe (ou d'un autre compte Stripe) : `deleteCard`
    // échouerait à chaque fois. Il ne reste qu'à l'effacer du profil.
    if (!/no such paymentmethod|not attached|resource_missing/i.test(rawUserMessage(e))) {
      return { ok: false, message: userErrorMessage(e, DELETE_ERROR) };
    }
    try {
      await getBase44().auth.updateMe({
        saved_payment_method_id: null,
        saved_card_info: null,
      } as Record<string, unknown>);
      return { ok: true };
    } catch (e2) {
      return { ok: false, message: userErrorMessage(e2, DELETE_ERROR) };
    }
  }
};
