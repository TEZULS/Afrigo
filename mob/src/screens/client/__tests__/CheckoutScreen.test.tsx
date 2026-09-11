import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/__tests__/test-utils';
import { useCart } from '@/stores/cart';

const mockReplace = jest.fn();
const mockNavigate = jest.fn();
/** Paramètres de route — `lineKeys` = lignes cochées au panier. */
let mockCheckoutParams: { lineKeys?: string[] } | undefined;

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      replace: mockReplace,
      goBack: jest.fn(),
      canGoBack: () => false,
    }),
    useRoute: () => ({ name: 'Checkout', key: 'checkout', params: mockCheckoutParams }),
  };
});

/** Profil du client — `wallet_balance` varie selon le test. */
let mockUser: Record<string, unknown> = {};
const mockRefreshUser = jest.fn(async () => {});

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    refreshUser: mockRefreshUser,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/hooks/useAppSettings', () => ({
  useAppSettings: () => ({ data: { delivery_slots_enabled: false }, isLoading: false }),
}));

jest.mock('@/api/base44Client', () => ({
  getBase44: () => ({ auth: { updateMe: jest.fn(), me: jest.fn() } }),
}));

const mockConsumeOrderedLines = jest.fn(async () => {});
jest.mock('@/services/cartServerSync', () => ({
  clearServerCartForCustomer: jest.fn(async () => {}),
  consumeOrderedLines: (...args: unknown[]) => mockConsumeOrderedLines(...(args as [])),
}));

const mockDebitWallet = jest.fn(async () => 0);
jest.mock('@/lib/wallet', () => ({
  debitWalletForOrder: (...args: unknown[]) => mockDebitWallet(...(args as [])),
}));

/** Zone couvrant le client — son état actif/inactif varie selon le test. */
let mockZones: Record<string, unknown>[] = [];
const mockOrderCreate = jest.fn(async () => ({ id: 'ord_1' }));

jest.mock('@/api/entities', () => ({
  DeliveryZone: () => ({ list: jest.fn(async () => mockZones) }),
  DeliverySlot: () => ({ list: jest.fn(async () => []), update: jest.fn() }),
  Order: () => ({ create: mockOrderCreate }),
  DiscountCode: () => ({ filter: jest.fn(async () => []), update: jest.fn() }),
  DiscountCodeUsage: () => ({ filter: jest.fn(async () => []), create: jest.fn() }),
  WalletTransaction: () => ({ create: jest.fn() }),
  invokeFunction: jest.fn(async () => ({})),
}));

import { CheckoutScreen } from '../CheckoutScreen';

const zone = (is_active: boolean) => ({
  id: 'z3',
  name: 'Zone 3',
  delivery_fee: 2.5,
  free_delivery_threshold: 29.99,
  postal_codes: ['51000'],
  is_active,
  min_order_amount: 0,
  delivery_schedule: [],
});

const baseUser = {
  email: 'salma@x.fr',
  address: '3 rue des Lilas',
  postal_code: '51000',
  city: 'Châlons-en-Champagne',
  phone: '0600000000',
};

const wrap = (ui: React.ReactElement) => <NavigationContainer>{ui}</NavigationContainer>;

const lastCreatedOrder = () =>
  (mockOrderCreate.mock.calls[0] as unknown as [Record<string, unknown>])[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { ...baseUser };
  mockCheckoutParams = undefined;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [] }) });
  useCart.setState({
    lines: [{ productId: 'p1', name: 'Bissap', unitPrice: 6.99, quantity: 1 }],
  });
});

describe('CheckoutScreen — zone de livraison désactivée', () => {
  it('bloque la commande et l’explique quand la zone du client est désactivée', async () => {
    mockZones = [zone(false)];
    renderWithProviders(wrap(<CheckoutScreen />));

    // Le message apparaît deux fois : encart explicatif + libellé du bouton.
    await waitFor(() =>
      expect(screen.getAllByText('Livraison indisponible dans votre zone')).toHaveLength(2),
    );
    expect(screen.getByText(/n'est pas disponible pour le moment/)).toBeTruthy();
    // Le bouton reprend le message et est inactif.
    const button = screen.getByRole('button', { name: 'Livraison indisponible dans votre zone' });
    expect(button.props.accessibilityState?.disabled ?? button.props.disabled).toBeTruthy();
    expect(screen.queryByText('Zone 3')).toBeNull();
  });

  it('laisse commander quand la zone est active', async () => {
    mockZones = [zone(true)];
    renderWithProviders(wrap(<CheckoutScreen />));

    await waitFor(() => expect(screen.getByText('Zone 3')).toBeTruthy());
    expect(screen.queryByText(/n'est pas disponible pour le moment/)).toBeNull();
    const button = screen.getByRole('button', { name: 'Confirmer ma commande' });
    expect(button.props.accessibilityState?.disabled ?? false).toBeFalsy();
  });
});

describe('CheckoutScreen — instructions de livraison', () => {
  it('enregistre les instructions dans `notes`, avec le téléphone', async () => {
    mockZones = [zone(true)];
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() => expect(screen.getByText('Zone 3')).toBeTruthy());

    fireEvent.changeText(
      screen.getByPlaceholderText(/Code d'entrée, étage/),
      'Code 1234, 3e étage',
    );
    fireEvent.press(screen.getByRole('button', { name: 'Confirmer ma commande' }));

    await waitFor(() => expect(mockOrderCreate).toHaveBeenCalled());
    expect(lastCreatedOrder().notes).toBe('Code 1234, 3e étage\nTel: 0600000000');
  });
});

describe('CheckoutScreen — portefeuille', () => {
  beforeEach(() => {
    mockZones = [zone(true)];
  });

  it('ne propose pas le portefeuille quand le solde est nul', async () => {
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() => expect(screen.getByText('Zone 3')).toBeTruthy());
    expect(screen.queryByText('Utiliser mon portefeuille')).toBeNull();
  });

  it('couvre toute la commande : plus de mode de paiement à choisir, commande marquée payée', async () => {
    mockUser = { ...baseUser, wallet_balance: 20 };
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() => expect(screen.getByText('Zone 3')).toBeTruthy());

    expect(screen.getByText('Carte bancaire')).toBeTruthy();
    fireEvent.press(screen.getByTestId('checkout-wallet-toggle'));

    // Panier 6,99 € + livraison 2,50 € = 9,49 € — le solde de 20 € couvre tout.
    await waitFor(() =>
      expect(screen.getByText('Commande entièrement réglée avec votre portefeuille')).toBeTruthy(),
    );
    expect(screen.queryByText('Carte bancaire')).toBeNull();
    expect(screen.queryByText('Paiement à la livraison')).toBeNull();
    expect(screen.getByTestId('checkout-wallet-amount').props.value).toBe('9.49');

    fireEvent.press(screen.getByRole('button', { name: 'Confirmer ma commande' }));

    await waitFor(() => expect(mockOrderCreate).toHaveBeenCalled());
    const order = lastCreatedOrder();
    expect(order.payment_method).toBe('delivery');
    expect(order.payment_status).toBe('completed');
    expect(order.wallet_amount_used).toBe(9.49);
    expect(order.amount_to_pay).toBe(0);

    await waitFor(() => expect(mockDebitWallet).toHaveBeenCalled());
    expect(mockDebitWallet).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'salma@x.fr', amount: 9.49, orderId: 'ord_1' }),
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('OrderDetails', { id: 'ord_1' }));
  });

  it('montant précis : une partie portefeuille, le reste par carte, débit différé après Stripe', async () => {
    mockUser = { ...baseUser, wallet_balance: 20 };
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() => expect(screen.getByText('Zone 3')).toBeTruthy());

    fireEvent.press(screen.getByTestId('checkout-wallet-toggle'));
    fireEvent.changeText(screen.getByTestId('checkout-wallet-amount'), '5');

    // Il reste 4,49 € : les modes de paiement réapparaissent, carte sélectionnée par défaut.
    await waitFor(() => expect(screen.getByText('Carte bancaire')).toBeTruthy());
    expect(screen.getByText(/reste à payer : 4,49/)).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Confirmer ma commande' }));

    await waitFor(() => expect(mockOrderCreate).toHaveBeenCalled());
    const order = lastCreatedOrder();
    expect(order.payment_method).toBe('card');
    expect(order.payment_status).toBe('pending');
    expect(order.wallet_amount_used).toBe(5);
    expect(order.amount_to_pay).toBe(4.49);

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('Payment', {
        orderId: 'ord_1',
        amount: 4.49,
        walletAmount: 5,
      }),
    );
    // Le portefeuille n'est débité qu'après acceptation du paiement carte.
    expect(mockDebitWallet).not.toHaveBeenCalled();
  });

  it('borne la saisie au maximum utilisable', async () => {
    mockUser = { ...baseUser, wallet_balance: 5 };
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() => expect(screen.getByText('Zone 3')).toBeTruthy());

    fireEvent.press(screen.getByTestId('checkout-wallet-toggle'));
    fireEvent.changeText(screen.getByTestId('checkout-wallet-amount'), '50');

    // Solde 5 € < commande 9,49 € : max 5 €, reste 4,49 € par carte.
    await waitFor(() => expect(screen.getByTestId('checkout-wallet-amount').props.value).toBe('5.00'));
    expect(screen.getByText(/reste à payer : 4,49/)).toBeTruthy();
  });
});

describe('CheckoutScreen — sélection du panier', () => {
  beforeEach(() => {
    mockZones = [zone(true)];
    useCart.setState({
      lines: [
        { productId: 'p1', name: 'Bissap', unitPrice: 6.99, quantity: 1 },
        { productId: 'p2', name: 'Attiéké', unitPrice: 3, quantity: 2 },
      ],
    });
  });

  it('ne commande que les lignes cochées et laisse les autres au panier', async () => {
    mockCheckoutParams = { lineKeys: ['p2-'] };
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() => expect(screen.getByText('Zone 3')).toBeTruthy());

    // Sous-total = 2 × 3 € (Bissap exclu), + 2,50 € de livraison.
    expect(screen.getByText('6,00 €')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Confirmer ma commande' }));
    await waitFor(() => expect(mockOrderCreate).toHaveBeenCalled());
    const order = lastCreatedOrder();
    const items = order.items as { product_id: string; quantity: number }[];
    expect(items).toEqual([{ product_id: 'p2', quantity: 2 }].map((i) => expect.objectContaining(i)));
    expect(items).toHaveLength(1);
    expect(order.total_amount).toBe(8.5);

    // Paiement carte : la sélection est transmise à l'écran Paiement, qui ne
    // retire du panier que ces lignes une fois la carte acceptée.
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('Payment', expect.objectContaining({ lineKeys: ['p2-'] })),
    );
    expect(mockConsumeOrderedLines).not.toHaveBeenCalled();
  });

  it('sans sélection transmise, tout le panier est commandé', async () => {
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() => expect(screen.getByText('Zone 3')).toBeTruthy());
    fireEvent.press(screen.getByRole('button', { name: 'Confirmer ma commande' }));
    await waitFor(() => expect(mockOrderCreate).toHaveBeenCalled());
    expect((lastCreatedOrder().items as unknown[]).length).toBe(2);
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('Payment', expect.objectContaining({ lineKeys: undefined })),
    );
  });
});

describe('CheckoutScreen — paiement à la livraison avec sélection', () => {
  it('retire du panier uniquement les lignes commandées', async () => {
    mockZones = [zone(true)];
    useCart.setState({
      lines: [
        { productId: 'p1', name: 'Bissap', unitPrice: 6.99, quantity: 1 },
        { productId: 'p2', name: 'Attiéké', unitPrice: 3, quantity: 2 },
      ],
    });
    mockCheckoutParams = { lineKeys: ['p1-'] };
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() => expect(screen.getByText('Zone 3')).toBeTruthy());

    fireEvent.press(screen.getByText('Paiement à la livraison'));
    fireEvent.press(screen.getByRole('button', { name: 'Confirmer ma commande' }));

    await waitFor(() => expect(mockConsumeOrderedLines).toHaveBeenCalledWith('salma@x.fr', ['p1-']));
    expect((lastCreatedOrder().items as { product_id: string }[]).map((i) => i.product_id)).toEqual(['p1']);
  });
});
