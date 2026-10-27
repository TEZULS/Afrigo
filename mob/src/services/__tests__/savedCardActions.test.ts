import { createPaymentMethod } from '@stripe/stripe-react-native';

const mockInvokeFunction = jest.fn(async (_name: string, _payload?: Record<string, unknown>): Promise<unknown> => ({
  success: true,
}));
jest.mock('@/api/entities', () => ({
  invokeFunction: (name: string, payload?: Record<string, unknown>) => mockInvokeFunction(name, payload),
}));

const mockUpdateMe = jest.fn(async (_patch: Record<string, unknown>) => ({}));
jest.mock('@/api/base44Client', () => ({
  getBase44: () => ({ auth: { updateMe: (patch: Record<string, unknown>) => mockUpdateMe(patch) } }),
}));

const mockEnsureStripeReady = jest.fn(async () => true);
jest.mock('@/services/stripeSetup', () => ({
  ensureStripeReady: () => mockEnsureStripeReady(),
}));

import { deleteSavedCard, rememberCard, saveCardFromForm } from '../savedCardActions';

const mockCreatePaymentMethod = createPaymentMethod as jest.MockedFunction<typeof createPaymentMethod>;
const calledFunctions = () => mockInvokeFunction.mock.calls.map(([name]) => name);
/** Erreur renvoyée par une fonction base44 (axios) : le message Stripe est dans `data.error`. */
const functionError = (error: string) => ({ response: { status: 500, data: { error } } });

beforeEach(() => {
  jest.clearAllMocks();
  mockEnsureStripeReady.mockResolvedValue(true);
  mockInvokeFunction.mockImplementation(async () => ({ success: true }));
  mockCreatePaymentMethod.mockResolvedValue({
    paymentMethod: { id: 'pm_form' },
  } as unknown as Awaited<ReturnType<typeof createPaymentMethod>>);
});

describe('rememberCard — après un paiement accepté', () => {
  it('range la carte sur le profil (fonction `saveCard`)', async () => {
    expect(await rememberCard('pm_new', false)).toBe(true);
    expect(mockInvokeFunction).toHaveBeenCalledWith('saveCard', { paymentMethodId: 'pm_new' });
    expect(calledFunctions()).toEqual(['saveCard']);
  });

  it('une seule carte par client : l’ancienne est détachée avant', async () => {
    await rememberCard('pm_new', true);
    expect(calledFunctions()).toEqual(['deleteCard', 'saveCard']);
  });

  it('ancienne carte impossible à détacher : la nouvelle est quand même enregistrée', async () => {
    mockInvokeFunction.mockImplementation(async (name: string) => {
      if (name === 'deleteCard') throw functionError('boom');
      return { success: true };
    });
    expect(await rememberCard('pm_new', true)).toBe(true);
    expect(calledFunctions()).toEqual(['deleteCard', 'saveCard']);
  });

  it('échec de `saveCard` : faux, sans lever d’erreur', async () => {
    mockInvokeFunction.mockRejectedValueOnce(functionError('Network Error'));
    expect(await rememberCard('pm_new', false)).toBe(false);
  });
});

describe('saveCardFromForm — Paramètres › Paiement', () => {
  const customer = { email: 'salma@x.fr', name: 'Salma Diallo' };

  it('crée le moyen de paiement à partir du formulaire, puis l’enregistre', async () => {
    expect(await saveCardFromForm({ customer, replacesSavedCard: false })).toEqual({ ok: true });
    expect(mockCreatePaymentMethod).toHaveBeenCalledWith({
      paymentMethodType: 'Card',
      paymentMethodData: {
        billingDetails: { email: 'salma@x.fr', name: 'Salma Diallo', address: { country: 'FR' } },
      },
    });
    expect(calledFunctions()).toEqual(['saveCard']);
    expect(mockInvokeFunction).toHaveBeenCalledWith('saveCard', { paymentMethodId: 'pm_form' });
  });

  it('« Changer de carte » : l’ancienne est détachée avant', async () => {
    await saveCardFromForm({ customer, replacesSavedCard: true });
    expect(calledFunctions()).toEqual(['deleteCard', 'saveCard']);
  });

  it('numéro refusé par Stripe : message en français, rien d’enregistré', async () => {
    mockCreatePaymentMethod.mockResolvedValueOnce({
      error: { code: 'Failed', message: 'Your card number is incorrect.' },
    } as unknown as Awaited<ReturnType<typeof createPaymentMethod>>);
    expect(await saveCardFromForm({ customer, replacesSavedCard: true })).toEqual({
      ok: false,
      message: 'Le numéro de carte saisi est incorrect.',
    });
    expect(mockInvokeFunction).not.toHaveBeenCalled();
  });

  it('aucune clé Stripe : message générique, pas de formulaire lu', async () => {
    mockEnsureStripeReady.mockResolvedValueOnce(false);
    expect(await saveCardFromForm({ customer, replacesSavedCard: false })).toEqual({
      ok: false,
      message: 'Votre carte n’a pas pu être enregistrée. Vérifiez-la, puis réessayez.',
    });
    expect(mockCreatePaymentMethod).not.toHaveBeenCalled();
  });
});

describe('deleteSavedCard', () => {
  it('supprime la carte (fonction `deleteCard`)', async () => {
    expect(await deleteSavedCard()).toEqual({ ok: true });
    expect(mockInvokeFunction).toHaveBeenCalledWith('deleteCard', {});
    expect(mockUpdateMe).not.toHaveBeenCalled();
  });

  it('erreur inattendue : message clair, profil intact', async () => {
    mockInvokeFunction.mockRejectedValueOnce(functionError('boom'));
    expect(await deleteSavedCard()).toEqual({
      ok: false,
      message: 'Votre carte n’a pas pu être supprimée. Réessayez dans un instant.',
    });
    expect(mockUpdateMe).not.toHaveBeenCalled();
  });

  it('serveur indisponible : message traduit, profil intact', async () => {
    mockInvokeFunction.mockRejectedValueOnce(functionError('Request failed with status code 500'));
    expect(await deleteSavedCard()).toEqual({
      ok: false,
      message: 'Le service rencontre un problème temporaire. Réessayez dans quelques minutes.',
    });
    expect(mockUpdateMe).not.toHaveBeenCalled();
  });

  it.each([
    "No such PaymentMethod: 'pm_old'",
    'The payment method you provided is not attached to a customer so detachment is impossible.',
  ])('carte déjà retirée chez Stripe (« %s ») : effacée du profil', async (stripeMessage) => {
    mockInvokeFunction.mockRejectedValueOnce(functionError(stripeMessage));
    expect(await deleteSavedCard()).toEqual({ ok: true });
    expect(mockUpdateMe).toHaveBeenCalledWith({ saved_payment_method_id: null, saved_card_info: null });
  });
});
