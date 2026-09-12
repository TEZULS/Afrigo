import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { renderWithProviders, screen, waitFor } from '@/__tests__/test-utils';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), canGoBack: () => false }),
    useRoute: () => ({ name: 'MyRefunds', key: 'my-refunds', params: undefined }),
  };
});

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'salma@x.fr' }, isAuthenticated: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/PersistentBottomNav', () => ({
  PersistentBottomNav: () => null,
  PERSISTENT_NAV_HEIGHT: 0,
}));

/** Demandes telles qu'en production (2026-09) : un refus motivé, un crédit portefeuille. */
const mockRefunds = [
  {
    id: 'rf_rejected',
    order_id: 'ord_00000042',
    customer_email: 'salma@x.fr',
    amount: 6.64,
    refund_method: 'card',
    status: 'rejected',
    cancellation_reason: 'Le paiement n’a pas pu être lancé. Aucun montant n’a été débité.',
    admin_notes: "aucun montant n'a été débité sur la carte bancaire du client",
    created_date: '2026-09-10T00:10:00.000Z',
    updated_date: '2026-09-10T00:28:00.000Z',
  },
  {
    id: 'rf_done',
    order_id: 'ord_00000043',
    customer_email: 'salma@x.fr',
    amount: 1,
    refund_method: 'wallet',
    status: 'completed',
    cancellation_reason: 'Annulée par le client',
    admin_notes: 'Remboursement de 1.00€ crédité au portefeuille',
    created_date: '2026-09-13T21:00:00.000Z',
    updated_date: '2026-09-13T22:03:00.000Z',
  },
];

jest.mock('@/api/entities', () => ({
  Refund: () => ({ filter: jest.fn(async () => mockRefunds) }),
}));

import { MyRefundsScreen } from '../MyRefundsScreen';

const wrap = (ui: React.ReactElement) => <NavigationContainer>{ui}</NavigationContainer>;

describe('MyRefundsScreen', () => {
  it('affiche le motif de refus donné par l’admin', async () => {
    renderWithProviders(wrap(<MyRefundsScreen />));
    await waitFor(() => expect(screen.getByTestId('refund-card-rf_rejected')).toBeTruthy());

    expect(screen.getByTestId('refund-rejection-rf_rejected')).toHaveTextContent(
      /aucun montant n'a été débité sur la carte bancaire du client/,
    );
    expect(screen.getByText('Motif du refus')).toBeTruthy();
    expect(screen.getByText('Votre demande de remboursement a été refusée.')).toBeTruthy();
    expect(screen.getByText('Demande refusée')).toBeTruthy();
  });

  it('affiche le détail d’un remboursement effectué sur le portefeuille', async () => {
    renderWithProviders(wrap(<MyRefundsScreen />));
    await waitFor(() => expect(screen.getByTestId('refund-card-rf_done')).toBeTruthy());

    expect(screen.getByText('Remboursement de 1.00€ crédité au portefeuille')).toBeTruthy();
    expect(screen.getByText('Le remboursement a été effectué avec succès.')).toBeTruthy();
  });

  it('utilise des libellés de statut en français', async () => {
    renderWithProviders(wrap(<MyRefundsScreen />));
    await waitFor(() => expect(screen.getByTestId('refund-card-rf_done')).toBeTruthy());
    expect(screen.queryByText('rejected')).toBeNull();
    expect(screen.queryByText('completed')).toBeNull();
  });
});
