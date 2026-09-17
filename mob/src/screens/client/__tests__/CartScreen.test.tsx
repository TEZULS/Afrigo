import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { renderWithProviders, screen, waitFor } from '@/__tests__/test-utils';
import { useCart } from '@/stores/cart';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => false }),
    useRoute: () => ({ name: 'CartTab', key: 'cart', params: undefined }),
  };
});

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'salma@x.fr', postal_code: '75015' }, isAuthenticated: true }),
}));

jest.mock('@/lib/cartRemote', () => ({
  remoteDecrementAfterRemove: jest.fn(),
  remoteDeleteLine: jest.fn(),
  remoteUpsertAfterAdd: jest.fn(),
}));

/** Produit relu pour une ligne sans taux (ligne rechargée depuis le serveur). */
const mockProductGet = jest.fn(async (id: string) => (id === 'p_server' ? { id, vat_rate: 5.5 } : { id }));

jest.mock('@/api/entities', () => ({
  DeliveryZone: () => ({
    list: jest.fn(async () => [{ id: 'z1', name: 'Paris', postal_codes: ['75015'], free_delivery_threshold: 29 }]),
  }),
  Product: () => ({ get: (id: string) => mockProductGet(id) }),
}));

import { CartScreen } from '../CartScreen';

const wrap = (ui: React.ReactElement) => <NavigationContainer>{ui}</NavigationContainer>;

describe('CartScreen — montants HT / TVA / TTC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCart.setState({
      lines: [
        // 10 € TTC à 10 % → 9,09 HT + 0,91 TVA.
        { productId: 'p_crabe', name: 'Crabe Madagascar 1Kg', unitPrice: 10, quantity: 1, vatRate: 10 },
        // Ancien produit sans TVA renseignée : le prix est le prix client.
        { productId: 'p_adja', name: 'Adja', unitPrice: 4.25, quantity: 2, vatRate: null },
      ],
      source: 'synced',
    });
  });

  it('détaille le montant HT, la TVA et le total TTC des lignes cochées', async () => {
    renderWithProviders(wrap(<CartScreen />));
    await waitFor(() => expect(screen.getByTestId('cart-vat-breakdown')).toBeTruthy());

    expect(screen.getByText('Montant HT')).toBeTruthy();
    expect(screen.getByText('17,59 €')).toBeTruthy(); // 9,09 + 8,50
    expect(screen.getByText('TVA')).toBeTruthy();
    expect(screen.getByText('0,91 €')).toBeTruthy();
    expect(screen.getByText('Total TTC')).toBeTruthy();
    expect(screen.getAllByText('18,50 €').length).toBeGreaterThan(0);
  });

  it('affiche le taux quand toutes les lignes partagent la même TVA', async () => {
    useCart.setState({
      lines: [{ productId: 'p_crabe', name: 'Crabe Madagascar 1Kg', unitPrice: 10, quantity: 1, vatRate: 10 }],
    });
    renderWithProviders(wrap(<CartScreen />));
    await waitFor(() => expect(screen.getByText('TVA (10 %)')).toBeTruthy());
    expect(screen.getByText('9,09 €')).toBeTruthy();
  });

  it('retrouve le taux sur le produit pour une ligne rechargée depuis le serveur', async () => {
    useCart.setState({
      lines: [{ productId: 'p_server', name: 'Beurre de karité', unitPrice: 21.1, quantity: 1 }],
    });
    renderWithProviders(wrap(<CartScreen />));
    // 21,10 € TTC à 5,5 % → 20,00 € HT, 1,10 € de TVA.
    await waitFor(() => expect(screen.getByText('TVA (5.5 %)')).toBeTruthy());
    expect(mockProductGet).toHaveBeenCalledWith('p_server');
    expect(screen.getByText('20,00 €')).toBeTruthy();
    expect(screen.getByText('1,10 €')).toBeTruthy();
  });
});

describe('CartScreen — sans TVA', () => {
  it('n’affiche ni HT, ni TVA, ni mention TTC quand aucune ligne n’a de TVA', async () => {
    useCart.setState({
      lines: [{ productId: 'p_adja', name: 'Adja', unitPrice: 4.25, quantity: 2, vatRate: null }],
      source: 'synced',
    });
    renderWithProviders(wrap(<CartScreen />));
    await waitFor(() => expect(screen.getByText('Total')).toBeTruthy());
    expect(screen.queryByTestId('cart-vat-breakdown')).toBeNull();
    expect(screen.queryByText('Montant HT')).toBeNull();
    expect(screen.queryByText('Total TTC')).toBeNull();
    expect(screen.getAllByText('8,50 €').length).toBeGreaterThan(0);
  });
});
