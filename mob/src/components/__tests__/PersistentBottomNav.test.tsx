import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { renderWithProviders, fireEvent, screen } from '@/__tests__/test-utils';
import { useCart } from '@/stores/cart';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
    useRoute: () => ({ name: 'HomeTab', key: 'home', params: {} }),
  };
});

jest.mock('@/hooks/useNotificationsFeed', () => ({
  useNotificationsFeed: () => ({
    items: [],
    unreadCount: 0,
    isLoading: false,
    isRefreshing: false,
    refresh: jest.fn(),
  }),
}));

import { PersistentBottomNav } from '../PersistentBottomNav';

const wrap = (ui: React.ReactElement) =>
  <NavigationContainer>{ui}</NavigationContainer>;

describe('PersistentBottomNav', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    useCart.getState().clear();
  });

  it('rend les 5 onglets avec leurs labels', () => {
    renderWithProviders(wrap(<PersistentBottomNav />));
    expect(screen.getByLabelText('Accueil')).toBeTruthy();
    expect(screen.getByLabelText('Commandes')).toBeTruthy();
    expect(screen.getByLabelText('Panier')).toBeTruthy();
    expect(screen.getByLabelText('Recherche')).toBeTruthy();
    expect(screen.getByLabelText('Notifications')).toBeTruthy();
  });

  it("n'affiche plus les onglets Profil et Menu", () => {
    renderWithProviders(wrap(<PersistentBottomNav />));
    expect(screen.queryByLabelText('Profil')).toBeNull();
    expect(screen.queryByLabelText('Menu')).toBeNull();
  });

  it('affiche le badge du panier quand des articles sont présents', () => {
    useCart.getState().add({ productId: 'p1', name: 'A', unitPrice: 5, quantity: 3 });
    useCart.getState().add({ productId: 'p2', name: 'B', unitPrice: 7, quantity: 4 });
    renderWithProviders(wrap(<PersistentBottomNav />));
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('affiche 99+ pour un panier > 99 articles', () => {
    useCart.getState().add({ productId: 'p1', name: 'A', unitPrice: 5, quantity: 150 });
    renderWithProviders(wrap(<PersistentBottomNav />));
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it("ouvre l'écran de recherche quand 'Recherche' est pressé", () => {
    renderWithProviders(wrap(<PersistentBottomNav />));
    fireEvent.press(screen.getByLabelText('Recherche'));
    expect(mockNavigate).toHaveBeenCalledWith('Search');
  });

  it("ouvre l'écran Notifications quand 🔔 est pressé", () => {
    renderWithProviders(wrap(<PersistentBottomNav />));
    fireEvent.press(screen.getByLabelText('Notifications'));
    expect(mockNavigate).toHaveBeenCalledWith('ClientTabs', { screen: 'NotificationsTab' });
  });

  it('aucun badge quand le panier est vide', () => {
    renderWithProviders(wrap(<PersistentBottomNav />));
    expect(screen.queryByText('1')).toBeNull();
    expect(screen.queryByText('99+')).toBeNull();
  });
});
