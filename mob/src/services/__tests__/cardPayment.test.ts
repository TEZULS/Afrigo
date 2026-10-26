import { confirmPayment } from '@stripe/stripe-react-native';

const mockOrderUpdate = jest.fn(async (_id: string, _patch: Record<string, unknown>) => ({}));
const mockInvokeFunction = jest.fn(
  async (_name: string, _payload?: Record<string, unknown>): Promise<unknown> => ({
    clientSecret: 'cs_test_123',
  }),
);
jest.mock('@/api/entities', () => ({
  Order: () => ({ update: mockOrderUpdate }),
  invokeFunction: (name: string, payload?: Record<string, unknown>) => mockInvokeFunction(name, payload),
}));
jest.mock('@/api/base44Client', () => ({ getBase44: () => ({ auth: { updateMe: jest.fn() } }) }));

const mockConsumeOrderedLines = jest.fn(async (_email?: string, _keys?: string[]) => {});
jest.mock('@/services/cartServerSync', () => ({
  consumeOrderedLines: (email?: string, keys?: string[]) => mockConsumeOrderedLines(email, keys),
}));

const mockDebitWallet = jest.fn(async (_args: Record<string, unknown>) => 15);
jest.mock('@/lib/wallet', () => ({
  debitWalletForOrder: (args: Record<string, unknown>) => mockDebitWallet(args),
}));

/** Clé publique Stripe de l'admin trouvée (voir services/stripeSetup.ts). */
const mockEnsureStripeReady = jest.fn(async () => true);
jest.mock('@/services/stripeSetup', () => ({
  ensureStripeReady: () => mockEnsureStripeReady(),
}));

import { isCardPaymentInProgress, payOrderByCard, type CardPaymentRequest } from '../cardPayment';

const mockConfirmPayment = confirmPayment as jest.MockedFunction<typeof confirmPayment>;

const request = (over: Partial<CardPaymentRequest> = {}): CardPaymentRequest => ({
  orderId: 'order-1',
  amount: 6.7,
  walletAmount: 0,
  lineKeys: ['p1-'],
  customer: { email: 'client@afrigo.app', walletBalance: 20, name: 'Salma Diallo' },
  card: { kind: 'new', save: false, replacesSavedCard: false },
  ...over,
});

/** Paiement accepté par Stripe, avec la carte `pm_new`. */
const accepted = (status = 'Succeeded') =>
  ({ paymentIntent: { id: 'pi_1', status, paymentMethodId: 'pm_new' } }) as unknown as Awaited<
    ReturnType<typeof confirmPayment>
  >;
const refused = (code: string, message: string) =>
  ({ error: { code, message } }) as unknown as Awaited<ReturnType<typeof confirmPayment>>;

const cancelPatch = () =>
  mockOrderUpdate.mock.calls.find(([, patch]) => patch.status === 'cancelled')?.[1] as
    | Record<string, string>
    | undefined;
const calledFunctions = () => mockInvokeFunction.mock.calls.map(([name]) => name);

beforeEach(() => {
  jest.clearAllMocks();
  mockEnsureStripeReady.mockResolvedValue(true);
  mockInvokeFunction.mockImplementation(async () => ({ clientSecret: 'cs_test_123' }));
  mockConfirmPayment.mockResolvedValue(accepted());
});

describe('payOrderByCard — paiement accepté', () => {
  it('nouvelle carte : paiement Stripe créé puis confirmé avec la carte du formulaire', async () => {
    const outcome = await payOrderByCard(request());

    expect(outcome).toEqual({ status: 'paid', cardSaved: false });
    expect(mockInvokeFunction).toHaveBeenCalledWith('createPaymentIntent', {
      orderId: 'order-1',
      amount: 6.7,
      saveCard: false,
    });
    expect(mockConfirmPayment).toHaveBeenCalledWith('cs_test_123', {
      paymentMethodType: 'Card',
      paymentMethodData: {
        billingDetails: { email: 'client@afrigo.app', name: 'Salma Diallo', address: { country: 'FR' } },
      },
    });
    expect(mockOrderUpdate).toHaveBeenCalledWith('order-1', { payment_status: 'completed', status: 'confirmed' });
    expect(mockConsumeOrderedLines).toHaveBeenCalledWith('client@afrigo.app', ['p1-']);
    expect(cancelPatch()).toBeUndefined();
    expect(calledFunctions()).not.toContain('saveCard');
  });

  it('Stripe préparé avec la clé de l’admin avant de créer le paiement', async () => {
    await payOrderByCard(request());
    expect(mockEnsureStripeReady).toHaveBeenCalledTimes(1);
    expect(mockEnsureStripeReady.mock.invocationCallOrder[0]).toBeLessThan(
      mockInvokeFunction.mock.invocationCallOrder[0]!,
    );
  });

  it('carte enregistrée : confirmée par l’app (3-D Secure possible), sans repasser par le formulaire', async () => {
    await payOrderByCard(request({ card: { kind: 'saved', paymentMethodId: 'pm_saved' } }));
    expect(mockInvokeFunction).toHaveBeenCalledWith('createPaymentIntent', {
      orderId: 'order-1',
      amount: 6.7,
      saveCard: false,
    });
    expect(mockConfirmPayment).toHaveBeenCalledWith('cs_test_123', {
      paymentMethodType: 'Card',
      paymentMethodData: { paymentMethodId: 'pm_saved' },
    });
  });

  it('débite le portefeuille seulement après la carte, avec le solde connu', async () => {
    await payOrderByCard(request({ walletAmount: 5 }));
    expect(mockDebitWallet).toHaveBeenCalledWith({
      email: 'client@afrigo.app',
      knownBalance: 20,
      amount: 5,
      orderId: 'order-1',
    });
    expect(mockConfirmPayment.mock.invocationCallOrder[0]).toBeLessThan(
      mockDebitWallet.mock.invocationCallOrder[0]!,
    );
  });

  it('sans part portefeuille, le solde n’est pas touché', async () => {
    await payOrderByCard(request());
    expect(mockDebitWallet).not.toHaveBeenCalled();
  });

  it('« Processing » (la banque finit de traiter) : la commande est gardée', async () => {
    mockConfirmPayment.mockResolvedValueOnce(accepted('Processing'));
    expect(await payOrderByCard(request())).toEqual({ status: 'paid', cardSaved: false });
    expect(cancelPatch()).toBeUndefined();
  });
});

describe('payOrderByCard — « Enregistrer ma carte »', () => {
  it('paiement créé pour garder la carte, puis carte rangée sur le profil', async () => {
    const outcome = await payOrderByCard(request({ card: { kind: 'new', save: true, replacesSavedCard: false } }));
    expect(outcome).toEqual({ status: 'paid', cardSaved: true });
    expect(mockInvokeFunction).toHaveBeenCalledWith('createPaymentIntent', {
      orderId: 'order-1',
      amount: 6.7,
      saveCard: true,
    });
    expect(mockInvokeFunction).toHaveBeenCalledWith('saveCard', { paymentMethodId: 'pm_new' });
    expect(calledFunctions()).not.toContain('deleteCard');
  });

  it('remplace l’ancienne carte : détachée d’abord, puis la nouvelle enregistrée', async () => {
    await payOrderByCard(request({ card: { kind: 'new', save: true, replacesSavedCard: true } }));
    expect(calledFunctions()).toEqual(['createPaymentIntent', 'deleteCard', 'saveCard']);
  });

  it('enregistrement de la carte en échec : le paiement, lui, reste acquis', async () => {
    mockInvokeFunction.mockImplementation(async (name: string) => {
      if (name === 'saveCard') throw new Error('Network Error');
      return { clientSecret: 'cs_test_123' };
    });
    const outcome = await payOrderByCard(request({ card: { kind: 'new', save: true, replacesSavedCard: false } }));
    expect(outcome).toEqual({ status: 'paid', cardSaved: false });
    expect(mockOrderUpdate).toHaveBeenCalledWith('order-1', { payment_status: 'completed', status: 'confirmed' });
  });
});

describe('payOrderByCard — paiement refusé ou abandonné', () => {
  it('carte refusée : commande annulée avec un motif lisible, portefeuille et panier intacts', async () => {
    mockConfirmPayment.mockResolvedValueOnce(refused('Failed', 'Your card was declined.'));
    const outcome = await payOrderByCard(request({ walletAmount: 5 }));

    expect(outcome).toEqual({
      status: 'failed',
      stage: 'confirm',
      message: 'Votre banque a refusé le paiement. Essayez une autre carte ou contactez votre banque.',
    });
    expect(cancelPatch()).toMatchObject({
      status: 'cancelled',
      payment_status: 'failed',
      cancelled_by_role: 'client',
      cancellation_reason: 'Le paiement a été refusé. Aucun montant n’a été débité.',
      payment_failure_reason: 'stripe_error: Your card was declined.',
    });
    expect(mockDebitWallet).not.toHaveBeenCalled();
    expect(mockConsumeOrderedLines).not.toHaveBeenCalled();
  });

  it('validation de la banque fermée par le client : commande annulée, rien de débité', async () => {
    mockConfirmPayment.mockResolvedValueOnce(refused('Canceled', 'The payment has been canceled'));
    expect(await payOrderByCard(request({ walletAmount: 5 }))).toEqual({ status: 'canceled' });
    expect(cancelPatch()).toMatchObject({ cancellation_reason: 'Paiement annulé par le client' });
    expect(mockDebitWallet).not.toHaveBeenCalled();
  });

  it('paiement resté sans carte valide (sans erreur du SDK) : traité comme un refus', async () => {
    mockConfirmPayment.mockResolvedValueOnce(accepted('RequiresPaymentMethod'));
    const outcome = await payOrderByCard(request());
    expect(outcome).toMatchObject({ status: 'failed', stage: 'confirm' });
    expect(cancelPatch()?.payment_failure_reason).toBe('stripe_error: status RequiresPaymentMethod');
  });
});

describe('payOrderByCard — paiement impossible à lancer', () => {
  /**
   * Le message brut du SDK Stripe, tel qu'il finissait affiché au client dans
   * « Motif d'annulation » sur le détail de commande.
   */
  const STRIPE_RAW =
    'One of `paymentIntentClientSecret`, `setupIntentClientSecret`, or `intentConfiguration` is required';

  it('aucune clé Stripe : pas de paiement créé, commande annulée, message clair', async () => {
    mockEnsureStripeReady.mockResolvedValueOnce(false);
    const outcome = await payOrderByCard(request());

    expect(mockInvokeFunction).not.toHaveBeenCalled();
    expect(mockConfirmPayment).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      status: 'failed',
      stage: 'init',
      message: 'Le paiement n’a pas pu aboutir. Aucun montant n’a été débité, vous pouvez réessayer.',
    });
    expect(cancelPatch()).toMatchObject({
      status: 'cancelled',
      payment_status: 'failed',
      cancellation_reason: 'Le paiement n’a pas pu être lancé. Aucun montant n’a été débité.',
    });
    expect(cancelPatch()?.payment_failure_reason).toContain('stripe_not_configured');
  });

  it('la fonction signale Stripe non configuré : message générique, jamais le texte serveur', async () => {
    mockInvokeFunction.mockResolvedValueOnce({ error: 'Stripe non configuré. Veuillez configurer les clés Stripe.' });
    const outcome = await payOrderByCard(request());
    expect(outcome).toMatchObject({ status: 'failed', stage: 'init' });
    expect((outcome as { message: string }).message).not.toMatch(/clés Stripe/);
    expect(mockConfirmPayment).not.toHaveBeenCalled();
  });

  it('conserve le détail technique pour le support, hors de la vue client', async () => {
    mockInvokeFunction.mockRejectedValueOnce(new Error(STRIPE_RAW));
    const outcome = await payOrderByCard(request());
    expect((outcome as { message: string }).message).not.toMatch(/paymentIntentClientSecret|`/);
    expect(cancelPatch()?.cancellation_reason).not.toMatch(/paymentIntentClientSecret|init_failed|`/);
    expect(cancelPatch()?.payment_failure_reason).toBe(`init_failed: ${STRIPE_RAW}`);
  });

  it('réponse sans secret de paiement : annulée, pas de confirmation', async () => {
    mockInvokeFunction.mockResolvedValueOnce({});
    expect(await payOrderByCard(request())).toMatchObject({ status: 'failed', stage: 'init' });
    expect(cancelPatch()?.payment_failure_reason).toBe('init_failed: missing_client_secret');
    expect(mockConfirmPayment).not.toHaveBeenCalled();
  });
});

describe('isCardPaymentInProgress', () => {
  it('vrai pendant la confirmation (validation de la banque), faux après', async () => {
    let during: boolean | undefined;
    mockConfirmPayment.mockImplementationOnce(async () => {
      during = isCardPaymentInProgress();
      return accepted();
    });
    expect(isCardPaymentInProgress()).toBe(false);
    await payOrderByCard(request());
    expect(during).toBe(true);
    expect(isCardPaymentInProgress()).toBe(false);
  });

  it('retombe à faux même après un refus', async () => {
    mockConfirmPayment.mockResolvedValueOnce(refused('Failed', 'Your card was declined.'));
    await payOrderByCard(request());
    expect(isCardPaymentInProgress()).toBe(false);
  });
});
