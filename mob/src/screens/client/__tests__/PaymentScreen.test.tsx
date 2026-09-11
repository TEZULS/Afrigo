import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/__tests__/test-utils';

const mockGoBack = jest.fn();
const mockReplace = jest.fn();
/** Paramètres de route — `walletAmount` varie selon le test. */
let mockRouteParams: Record<string, unknown> = { orderId: 'order-1', amount: 6.7 };

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      goBack: mockGoBack,
      replace: mockReplace,
      canGoBack: () => true,
      addListener: () => () => {},
    }),
    useRoute: () => ({
      name: 'Payment',
      key: 'payment',
      params: mockRouteParams,
    }),
  };
});

const mockInitPaymentSheet = jest.fn();
const mockPresentPaymentSheet = jest.fn();

jest.mock('@stripe/stripe-react-native', () => ({
  useStripe: () => ({
    initPaymentSheet: mockInitPaymentSheet,
    presentPaymentSheet: mockPresentPaymentSheet,
  }),
}));

const mockOrderUpdate = jest.fn(async () => ({}));
const mockInvokeFunction = jest.fn(async () => ({ clientSecret: 'cs_test_123' }));

jest.mock('@/api/entities', () => ({
  Order: () => ({ update: mockOrderUpdate }),
  invokeFunction: (...args: unknown[]) => mockInvokeFunction(...(args as [])),
}));

const mockRefreshUser = jest.fn(async () => {});
jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'client@afrigo.app', wallet_balance: 20 },
    refreshUser: mockRefreshUser,
  }),
}));

const mockConsumeOrderedLines = jest.fn(async () => {});
jest.mock('@/services/cartServerSync', () => ({
  clearServerCartForCustomer: jest.fn(async () => {}),
  consumeOrderedLines: (...args: unknown[]) => mockConsumeOrderedLines(...(args as [])),
}));

const mockDebitWallet = jest.fn(async () => 17);
jest.mock('@/lib/wallet', () => ({
  debitWalletForOrder: (...args: unknown[]) => mockDebitWallet(...(args as [])),
}));

import { PaymentScreen } from '../PaymentScreen';

/**
 * Le message brut du SDK Stripe, tel qu'il finissait affiché au client dans
 * « Motif d'annulation » sur le détail de commande.
 */
const STRIPE_RAW =
  'One of `paymentIntentClientSecret`, `setupIntentClientSecret`, or `intentConfiguration` is required';

describe('PaymentScreen — échec d’initialisation', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = { orderId: 'order-1', amount: 6.7 };
    mockInvokeFunction.mockResolvedValue({ clientSecret: 'cs_test_123' });
    mockInitPaymentSheet.mockResolvedValue({ error: { message: STRIPE_RAW } });
    mockPresentPaymentSheet.mockResolvedValue({ error: null });
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('annule la commande avec un motif lisible par le client', async () => {
    renderWithProviders(<PaymentScreen />);

    await waitFor(() => expect(mockOrderUpdate).toHaveBeenCalled());

    const [, patch] = mockOrderUpdate.mock.calls[0] as unknown as [
      string,
      { cancellation_reason: string; payment_failure_reason: string },
    ];

    expect(patch.cancellation_reason).toBe(
      'Le paiement n’a pas pu être lancé. Aucun montant n’a été débité.',
    );
    expect(patch.cancellation_reason).not.toMatch(/paymentIntentClientSecret|init_failed|`/);
  });

  it('conserve le détail technique pour le support, hors de la vue client', async () => {
    renderWithProviders(<PaymentScreen />);

    await waitFor(() => expect(mockOrderUpdate).toHaveBeenCalled());

    const [, patch] = mockOrderUpdate.mock.calls[0] as unknown as [
      string,
      { payment_failure_reason: string },
    ];

    expect(patch.payment_failure_reason).toContain('init_failed:');
    expect(patch.payment_failure_reason).toContain('paymentIntentClientSecret');
  });

  it('n’affiche jamais le message brut du SDK à l’écran', async () => {
    renderWithProviders(<PaymentScreen />);

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());

    const [title, body] = alertSpy.mock.calls[0] as [string, string];
    expect(title).toBe('Paiement indisponible');
    expect(body).toBe(
      'Le paiement n’a pas pu aboutir. Aucun montant n’a été débité, vous pouvez réessayer.',
    );
    expect(screen.queryByText(STRIPE_RAW)).toBeNull();
  });

  it('traduit un refus de carte lors du paiement', async () => {
    mockInitPaymentSheet.mockResolvedValue({ error: null });
    mockPresentPaymentSheet.mockResolvedValue({
      error: { code: 'Failed', message: 'Your card was declined.' },
    });

    renderWithProviders(<PaymentScreen />);
    await waitFor(() => expect(screen.getByText('Payer maintenant')).toBeTruthy());

    fireEvent.press(screen.getByText('Payer maintenant'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const [title, body] = alertSpy.mock.calls[0] as [string, string];
    expect(title).toBe('Paiement échoué');
    expect(body).toMatch(/banque a refusé le paiement/);
  });
});

describe('PaymentScreen — paiement accepté', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = { orderId: 'order-1', amount: 6.7 };
    mockInvokeFunction.mockResolvedValue({ clientSecret: 'cs_test_123' });
    mockInitPaymentSheet.mockResolvedValue({ error: null });
    mockPresentPaymentSheet.mockResolvedValue({ error: null });
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('débite le portefeuille après Stripe, marque la commande payée et ouvre le détail', async () => {
    mockRouteParams = { orderId: 'order-1', amount: 6.7, walletAmount: 3, lineKeys: ['p1-'] };
    renderWithProviders(<PaymentScreen />);
    await waitFor(() => expect(screen.getByText('Payer maintenant')).toBeTruthy());
    // Récapitulatif : part portefeuille + part carte.
    expect(screen.getByText(/Portefeuille \(débité après paiement\)/)).toBeTruthy();

    fireEvent.press(screen.getByText('Payer maintenant'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('OrderDetails', { id: 'order-1' }));
    expect(mockDebitWallet).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'client@afrigo.app', amount: 3, orderId: 'order-1' }),
    );
    expect(mockOrderUpdate).toHaveBeenCalledWith('order-1', {
      payment_status: 'completed',
      status: 'confirmed',
    });
    // Seules les lignes commandées quittent le panier.
    expect(mockConsumeOrderedLines).toHaveBeenCalledWith('client@afrigo.app', ['p1-']);
    // Jamais d'annulation après un paiement réussi.
    expect(mockOrderUpdate).not.toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({ status: 'cancelled' }),
    );
  });

  it('ne touche pas au portefeuille sans part portefeuille', async () => {
    renderWithProviders(<PaymentScreen />);
    await waitFor(() => expect(screen.getByText('Payer maintenant')).toBeTruthy());
    expect(screen.queryByText(/Portefeuille \(débité après paiement\)/)).toBeNull();

    fireEvent.press(screen.getByText('Payer maintenant'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockDebitWallet).not.toHaveBeenCalled();
  });

  it('ne débite pas le portefeuille quand la carte est refusée', async () => {
    mockRouteParams = { orderId: 'order-1', amount: 6.7, walletAmount: 3 };
    mockPresentPaymentSheet.mockResolvedValue({
      error: { code: 'Failed', message: 'Your card was declined.' },
    });
    renderWithProviders(<PaymentScreen />);
    await waitFor(() => expect(screen.getByText('Payer maintenant')).toBeTruthy());

    fireEvent.press(screen.getByText('Payer maintenant'));

    await waitFor(() =>
      expect(mockOrderUpdate).toHaveBeenCalledWith(
        'order-1',
        expect.objectContaining({ status: 'cancelled', payment_status: 'failed' }),
      ),
    );
    expect(mockDebitWallet).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
