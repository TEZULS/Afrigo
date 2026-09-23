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

let mockAppSettings: Record<string, unknown> = { delivery_slots_enabled: false };
jest.mock('@/hooks/useAppSettings', () => ({
  ...jest.requireActual('@/hooks/useAppSettings'),
  useAppSettings: () => ({ data: mockAppSettings, isLoading: false }),
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
let mockSlots: Record<string, unknown>[] = [];
const mockSlotUpdate = jest.fn();
const mockOrderCreate = jest.fn(async () => ({ id: 'ord_1' }));
/** Places prises renvoyées par `getDeliverySlotCounts` (par heure de début). */
let mockSlotCounts: Record<string, number> = {};
const mockInvoke = jest.fn(async (name: string, _payload?: unknown) =>
  name === 'getDeliverySlotCounts' ? { counts: mockSlotCounts } : {},
);

jest.mock('@/api/entities', () => ({
  DeliveryZone: () => ({ list: jest.fn(async () => mockZones) }),
  DeliverySlot: () => ({ list: jest.fn(async () => mockSlots), update: mockSlotUpdate }),
  Order: () => ({ create: mockOrderCreate }),
  DiscountCode: () => ({ filter: jest.fn(async () => []), update: jest.fn() }),
  DiscountCodeUsage: () => ({ filter: jest.fn(async () => []), create: jest.fn() }),
  WalletTransaction: () => ({ create: jest.fn() }),
  invokeFunction: (name: string, payload?: unknown) => mockInvoke(name, payload),
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
  mockSlots = [];
  mockSlotCounts = {};
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
    // Sans TVA : pas de lignes HT / TVA, juste le sous-total.
    expect(screen.getByText('6,00 €')).toBeTruthy();
    expect(screen.queryByText('Montant HT')).toBeNull();

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

describe('CheckoutScreen — TVA', () => {
  it('affiche HT / TVA / TTC et recopie le taux de chaque ligne dans la commande', async () => {
    mockZones = [zone(true)];
    // Crabe Madagascar : 10 € TTC à 10 % de TVA ; Bissap sans TVA renseignée.
    useCart.setState({
      lines: [
        { productId: 'p1', name: 'Bissap', unitPrice: 6.99, quantity: 1 },
        { productId: 'p3', name: 'Crabe Madagascar 1Kg', unitPrice: 10, quantity: 1, vatRate: 10 },
      ],
    });
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() => expect(screen.getByText('Zone 3')).toBeTruthy());

    expect(screen.getByText('Montant HT')).toBeTruthy();
    expect(screen.getByText('16,08 €')).toBeTruthy(); // 6,99 + 9,09
    expect(screen.getByText('TVA')).toBeTruthy(); // deux taux (0 % et 10 %) → pas de taux unique affiché
    expect(screen.getByText('0,91 €')).toBeTruthy();
    expect(screen.getByText('Sous-total TTC')).toBeTruthy();
    expect(screen.getByText('16,99 €')).toBeTruthy();

    fireEvent.press(screen.getByText('Paiement à la livraison'));
    fireEvent.press(screen.getByRole('button', { name: 'Confirmer ma commande' }));
    await waitFor(() => expect(mockOrderCreate).toHaveBeenCalled());
    const items = lastCreatedOrder().items as { product_id: string; vat_rate: number }[];
    expect(items.map((i) => [i.product_id, i.vat_rate])).toEqual([
      ['p1', 0],
      ['p3', 10],
    ]);
  });
});

describe('CheckoutScreen — client privé de paiement à la livraison (base44)', () => {
  const deliveryOption = () => screen.getByTestId('payment-delivery');

  it('grise l’option et impose la carte quand `cash_on_delivery_disabled` est vrai', async () => {
    mockZones = [zone(true)];
    mockUser = { ...baseUser, cash_on_delivery_disabled: true };
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() => expect(screen.getByText('Zone 3')).toBeTruthy());

    expect(screen.getByText('Carte bancaire')).toBeTruthy();
    expect(
      screen.getByText('Non disponible pour votre compte — paiement par carte obligatoire'),
    ).toBeTruthy();
    expect(deliveryOption().props.accessibilityState).toMatchObject({ disabled: true });

    // Un appui ne la sélectionne pas : la commande part en paiement par carte.
    fireEvent.press(screen.getByText('Paiement à la livraison'));
    fireEvent.press(screen.getByRole('button', { name: 'Confirmer ma commande' }));
    await waitFor(() => expect(mockOrderCreate).toHaveBeenCalled());
    expect(lastCreatedOrder().payment_method).toBe('card');
  });

  it('laisse le choix quand le client n’est pas bloqué', async () => {
    mockZones = [zone(true)];
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() => expect(screen.getByText('Zone 3')).toBeTruthy());
    expect(screen.getByText('En espèces ou par carte auprès du livreur')).toBeTruthy();
    expect(deliveryOption().props.accessibilityState).toMatchObject({ disabled: false });
  });
});

describe('CheckoutScreen — créneau du jour même', () => {
  /** Horaires au format admin actuel (objets), saisis dans le désordre. */
  const todayZone = {
    ...zone(true),
    id: 'z1',
    name: 'Zone 1',
    delivery_schedule: [
      {
        day: 'Mercredi',
        time_slots: [
          { time_slot: '09h00-10h00', max_orders: 10 },
          { time_slot: '10h00-11h00', max_orders: 10 },
          { time_slot: '11h00-12h00', max_orders: 10 },
          { time_slot: '14h00-15h00', max_orders: 10 },
        ],
      },
      { day: 'Jeudi', time_slots: [{ time_slot: '09h00-18h30', max_orders: 10 }] },
    ],
  };
  /** Mercredi 23 septembre 2026, 10 h. */
  const TEN_AM = new Date(2026, 8, 23, 10, 0);
  const confirm = () => screen.getByRole('button', { name: 'Confirmer ma commande' });

  beforeAll(() => {
    // Seule la date est figée : les minuteurs restent réels.
    jest.useFakeTimers({
      now: TEN_AM,
      doNotFake: [
        'nextTick',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
        'setTimeout',
        'clearTimeout',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'hrtime',
        'performance',
      ],
    });
  });
  afterAll(() => jest.useRealTimers());

  beforeEach(() => {
    jest.setSystemTime(TEN_AM);
    mockZones = [todayZone];
    // Même activé, le réglage `DeliverySlot` ne sert pas quand la zone a des horaires.
    mockAppSettings = { delivery_slots_enabled: true };
  });
  afterEach(() => {
    mockAppSettings = { delivery_slots_enabled: false };
  });

  it('à 10:00, ne propose que les créneaux d’aujourd’hui pas encore commencés, sans places', async () => {
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() => expect(screen.getByText('11h00 - 12h00')).toBeTruthy());

    expect(screen.getByTestId('slot-day-label')).toHaveTextContent("Aujourd'hui · Mercredi 23 Sept.");
    expect(screen.getByText('14h00 - 15h00')).toBeTruthy();
    // Commencés : plus proposés. Autres jours : pas de navigation.
    expect(screen.queryByText('09h00 - 10h00')).toBeNull();
    expect(screen.queryByText('10h00 - 11h00')).toBeNull();
    expect(screen.queryByText('09h00 - 18h30')).toBeNull();
    expect(screen.queryByTestId('slot-day-next')).toBeNull();
    // Le nombre de places n'est plus affiché.
    expect(screen.queryByText(/\/10/)).toBeNull();

    // Premier créneau libre présélectionné.
    await waitFor(() =>
      expect(screen.getByTestId('slot-zone-2').props.accessibilityState?.selected).toBe(true),
    );
    expect(mockInvoke).toHaveBeenCalledWith('getDeliverySlotCounts', { date: '2026-09-23' });
  });

  it('enregistre le créneau choisi pour aujourd’hui sur la commande', async () => {
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() => expect(screen.getByTestId('slot-zone-3')).toBeTruthy());

    fireEvent.press(screen.getByTestId('slot-zone-3'));
    await waitFor(() =>
      expect(screen.getByTestId('slot-zone-3').props.accessibilityState?.selected).toBe(true),
    );
    await waitFor(() => expect(confirm().props.accessibilityState?.disabled).toBeFalsy());
    fireEvent.press(confirm());
    await waitFor(() => expect(mockOrderCreate).toHaveBeenCalled());

    const order = lastCreatedOrder();
    expect(order.estimated_delivery).toBe('2026-09-23');
    expect(order.delivery_time).toBe('14h00');
    expect(order.delivery_time_slot).toBe('14h00-15h00');
    expect(mockSlotUpdate).not.toHaveBeenCalled();
  });

  it('un créneau complet n’est pas proposé', async () => {
    mockSlotCounts = { '11h00': 10 };
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() => expect(screen.getByText('14h00 - 15h00')).toBeTruthy());
    expect(screen.queryByText('11h00 - 12h00')).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId('slot-zone-3').props.accessibilityState?.selected).toBe(true),
    );
  });

  it('plus aucun créneau aujourd’hui : message, et la commande reste bloquée', async () => {
    jest.setSystemTime(new Date(2026, 8, 23, 20, 0));
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() => expect(screen.getByTestId('slots-none-today')).toBeTruthy());
    // Le jeudi n'est jamais proposé à la place.
    expect(screen.queryByText('09h00 - 18h30')).toBeNull();
    expect(confirm().props.accessibilityState?.disabled).toBe(true);
  });

  it('refuse un créneau qui a commencé pendant la saisie et en propose un autre', async () => {
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() =>
      expect(screen.getByTestId('slot-zone-2').props.accessibilityState?.selected).toBe(true),
    );
    await waitFor(() => expect(confirm().props.accessibilityState?.disabled).toBeFalsy());

    // Le client confirme à 11:00 : le créneau 11h00-12h00 vient de commencer.
    jest.setSystemTime(new Date(2026, 8, 23, 11, 0));
    fireEvent.press(confirm());

    await waitFor(() =>
      expect(screen.getByTestId('slot-zone-3').props.accessibilityState?.selected).toBe(true),
    );
    expect(screen.queryByText('11h00 - 12h00')).toBeNull();
    expect(mockOrderCreate).not.toHaveBeenCalled();
  });

  it('sans horaires de zone, reprend les créneaux du jour de la table DeliverySlot', async () => {
    mockZones = [zone(true)];
    mockSlots = [
      { id: 'started', date: '2026-09-23', time_slot: '09:00-09:45', max_orders: 5, current_orders: 0, is_available: true },
      { id: 'noon', date: '2026-09-23', time_slot: '12:00-13:00', max_orders: 5, current_orders: 2, is_available: true },
      { id: 'tomorrow', date: '2026-09-24', time_slot: '11:00-12:00', max_orders: 5, current_orders: 0, is_available: true },
    ];
    renderWithProviders(wrap(<CheckoutScreen />));
    await waitFor(() => expect(screen.getByText('12:00 - 13:00')).toBeTruthy());
    expect(screen.queryByText('09:00 - 09:45')).toBeNull();
    expect(screen.queryByText('11:00 - 12:00')).toBeNull();
    expect(screen.queryByText('2/5')).toBeNull();

    await waitFor(() => expect(confirm().props.accessibilityState?.disabled).toBeFalsy());
    fireEvent.press(confirm());
    await waitFor(() => expect(mockOrderCreate).toHaveBeenCalled());
    expect(lastCreatedOrder().delivery_time).toBe('12:00');
    expect(lastCreatedOrder().delivery_time_slot).toBe('12:00-13:00');
    expect(mockSlotUpdate).toHaveBeenCalledWith('noon', { current_orders: 3 });
  });
});
