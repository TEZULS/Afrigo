import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/__tests__/test-utils';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), canGoBack: () => false }),
    useRoute: () => ({ name: 'MyReturns', key: 'my-returns', params: undefined }),
  };
});

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'beauty13home@gmail.com' }, isAuthenticated: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/PersistentBottomNav', () => ({
  PersistentBottomNav: () => null,
  PERSISTENT_NAV_HEIGHT: 0,
}));

/** Demandes telles qu'en production le 2026-09-16 (échange en attente, remboursement terminé, refus). */
const mockReturns = [
  {
    id: '6aa9c833ae93b03a1ec34073',
    order_id: '6aa9c7b702b2b539629f3694',
    reason: 'expired',
    resolution_type: 'refund',
    refund_amount: 29.9,
    status: 'completed',
    admin_message: 'Toutes est bon',
    created_date: '2026-09-15T22:35:31.591000',
  },
  {
    id: '6aaa70baa5d1f0262490cb58',
    order_id: '6aaa64ca37afea24490f8503',
    reason: 'wrong_product',
    resolution_type: 'exchange',
    refund_amount: 0,
    status: 'pending',
    created_date: '2026-09-16T10:34:34.897000',
  },
  {
    id: '6aa983b55ecc06cb4104a327',
    order_id: '6aa96a3f7a1d1b6d9b81a19f',
    reason: 'wrong_product',
    status: 'rejected',
    rejection_reason: 'Produit ouvert',
    created_date: '2026-09-15T17:43:17.189000',
  },
];

jest.mock('@/api/entities', () => ({
  Return: () => ({ filter: jest.fn(async () => mockReturns) }),
}));

import { MyReturnsScreen } from '../MyReturnsScreen';

const wrap = (ui: React.ReactElement) => <NavigationContainer>{ui}</NavigationContainer>;

describe('MyReturnsScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('liste les demandes, plus récentes en premier, avec statut, motif et résolution en français', async () => {
    renderWithProviders(wrap(<MyReturnsScreen />));
    await waitFor(() => expect(screen.getByText('Retour #2490CB58')).toBeTruthy());

    const titles = screen.getAllByText(/^Retour #/).map((t) => t.props.children.join(''));
    expect(titles).toEqual(['Retour #2490CB58', 'Retour #1EC34073', 'Retour #4104A327']);

    // Badge + étape du suivi : le libellé apparaît plusieurs fois.
    expect(screen.getAllByText('En attente').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Terminé').length).toBeGreaterThan(0);
    expect(screen.getByText('Refusé')).toBeTruthy();
    // Résolution choisie par l'admin : masquée tant que la demande est en attente.
    expect(screen.queryByText('Échange du produit')).toBeNull();
    expect(screen.getByText('Remboursement sur le portefeuille · 29,90 €')).toBeTruthy();
    expect(screen.getByText(/Message d’AfriGo : Toutes est bon/)).toBeTruthy();
  });

  it('montre le suivi en trois étapes et l’encart de refus', async () => {
    renderWithProviders(wrap(<MyReturnsScreen />));
    await waitFor(() => expect(screen.getByText('Retour #2490CB58')).toBeTruthy());

    // Deux demandes non refusées → deux suivis ; la refusée affiche l'encart.
    expect(screen.getAllByTestId('return-tracker')).toHaveLength(2);
    expect(screen.getByTestId('return-tracker-rejected')).toBeTruthy();
    expect(screen.getByText('Produit ouvert')).toBeTruthy();
    // Retour terminé : les trois étapes sont atteintes.
    expect(screen.getByTestId('return-step-completed-done')).toBeTruthy();
    // Retour en attente : « Approuvé » et « Terminé » restent à venir.
    expect(screen.getByTestId('return-step-approved-todo')).toBeTruthy();
  });

  it('ouvre le détail d’une demande', async () => {
    renderWithProviders(wrap(<MyReturnsScreen />));
    await waitFor(() => expect(screen.getByText('Retour #2490CB58')).toBeTruthy());
    fireEvent.press(screen.getByLabelText(/Retour 2490CB58/));
    expect(mockNavigate).toHaveBeenCalledWith('ReturnDetails', { id: '6aaa70baa5d1f0262490cb58' });
  });
});
