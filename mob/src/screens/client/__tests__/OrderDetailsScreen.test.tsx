import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/__tests__/test-utils';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), canGoBack: () => true }),
    useRoute: () => ({ name: 'OrderDetails', key: 'od', params: { id: 'ord_9b81a19f' } }),
  };
});

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({
    user: {
      email: 'kanesamas5@gmail.com',
      full_name: 'Samy Kane',
      first_name: 'Samy',
      last_name: 'Kane',
      customer_id: 'AFG-0007',
      phone: '0601020304',
    },
    isAuthenticated: true,
  }),
}));

const mockShareOrderInvoice = jest.fn(async (_order?: unknown, _customer?: unknown) => {});
jest.mock('@/services/invoice', () => ({
  shareOrderInvoice: (o: unknown, c: unknown) => mockShareOrderInvoice(o, c),
}));

/** Livrée il y a 10 min : dans la fenêtre d'une heure. */
let mockDeliveredDate = new Date(Date.now() - 10 * 60 * 1000).toISOString();
let mockReturns: { id: string; order_id: string; status: string }[] = [];
/** Champs de commande surchargés par certains tests (statut, paiement). */
let mockOrderOverride: Record<string, unknown> = {};

const order = () => ({
  id: 'ord_9b81a19f',
  status: 'delivered',
  payment_method: 'delivery',
  total_amount: 58.99,
  amount_to_pay: 58.99,
  delivered_date: mockDeliveredDate,
  created_date: '2026-09-15T17:54:00.000Z',
  delivery_address: '37 Rue de la Couronne',
  delivery_postal_code: '55000',
  delivery_city: 'Bar-le-Duc',
  items: [
    { product_name: 'AILLE de Poulet HALAL (10kg)', quantity: 1, unit_price: 29.9, total_price: 29.9, vat_rate: 0 },
    { product_name: 'Chinchard (Poisson)', quantity: 1, unit_price: 29.09, total_price: 29.09, vat_rate: 0 },
  ],
  ...mockOrderOverride,
});

jest.mock('@/api/entities', () => ({
  Order: () => ({ get: jest.fn(async () => order()) }),
  Return: () => ({ filter: jest.fn(async () => mockReturns) }),
}));

import { OrderDetailsScreen } from '../OrderDetailsScreen';

const wrap = (ui: React.ReactElement) => <NavigationContainer>{ui}</NavigationContainer>;

describe('OrderDetailsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReturns = [];
    mockDeliveredDate = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  });

  it('propose « Facture » (PDF) et « Service client » (messagerie) au lieu de l’appel téléphonique', async () => {
    renderWithProviders(wrap(<OrderDetailsScreen />));
    await waitFor(() => expect(screen.getByTestId('order-invoice')).toBeTruthy());
    expect(screen.getByText('Facture')).toBeTruthy();
    expect(screen.getByText('Service client')).toBeTruthy();
    expect(screen.queryByText('Messages')).toBeNull();

    fireEvent.press(screen.getByTestId('order-support'));
    expect(mockNavigate).toHaveBeenCalledWith('Messages');

    fireEvent.press(screen.getByTestId('order-invoice'));
    await waitFor(() => expect(mockShareOrderInvoice).toHaveBeenCalledTimes(1));
    const [passedOrder, customer] = mockShareOrderInvoice.mock.calls[0] as unknown as [
      { id: string },
      Record<string, unknown>,
    ];
    expect(passedOrder.id).toBe('ord_9b81a19f');
    expect(customer).toMatchObject({
      email: 'kanesamas5@gmail.com',
      first_name: 'Samy',
      last_name: 'Kane',
      customer_id: 'AFG-0007',
    });
  });

  it('garde « Demander un retour » tant qu’aucune demande n’est approuvée (plusieurs demandes possibles)', async () => {
    mockReturns = [
      { id: 'r1', order_id: 'ord_9b81a19f', status: 'rejected' },
      { id: 'r2', order_id: 'ord_9b81a19f', status: 'pending' },
    ];
    renderWithProviders(wrap(<OrderDetailsScreen />));
    await waitFor(() => expect(screen.getByText('Demander un retour')).toBeTruthy());
    fireEvent.press(screen.getByText('Demander un retour'));
    expect(mockNavigate).toHaveBeenCalledWith('Returns', { orderId: 'ord_9b81a19f' });
  });

  it('masque le bouton une fois une demande approuvée', async () => {
    mockReturns = [{ id: 'r3', order_id: 'ord_9b81a19f', status: 'approved' }];
    renderWithProviders(wrap(<OrderDetailsScreen />));
    await waitFor(() => expect(screen.getByTestId('order-invoice')).toBeTruthy());
    await waitFor(() => expect(screen.queryByText('Demander un retour')).toBeNull());
  });

  it('masque le bouton une heure après la livraison', async () => {
    mockDeliveredDate = new Date(Date.now() - 61 * 60 * 1000).toISOString();
    renderWithProviders(wrap(<OrderDetailsScreen />));
    await waitFor(() => expect(screen.getByTestId('order-invoice')).toBeTruthy());
    expect(screen.queryByText('Demander un retour')).toBeNull();
  });
});

describe('OrderDetailsScreen — facture selon le paiement', () => {
  it('masque « Facture » quand le paiement a échoué', async () => {
    mockOrderOverride = { status: 'cancelled', payment_method: 'card', payment_status: 'failed' };
    renderWithProviders(wrap(<OrderDetailsScreen />));
    await waitFor(() => expect(screen.getByTestId('order-support')).toBeTruthy());
    expect(screen.queryByTestId('order-invoice')).toBeNull();
    mockOrderOverride = {};
  });

  it('masque « Facture » pour un paiement à la livraison pas encore livré', async () => {
    mockOrderOverride = { status: 'preparing', payment_method: 'delivery' };
    renderWithProviders(wrap(<OrderDetailsScreen />));
    await waitFor(() => expect(screen.getByTestId('order-support')).toBeTruthy());
    expect(screen.queryByTestId('order-invoice')).toBeNull();
    mockOrderOverride = {};
  });
});
