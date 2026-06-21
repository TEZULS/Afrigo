import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { renderWithProviders, fireEvent, screen, waitFor } from '@/__tests__/test-utils';
import { MenuDrawer } from '../MenuDrawer';
import { useMenuDrawer } from '@/stores/menuDrawer';

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: true,
    isLoadingAuth: false,
    isLoadingPublicSettings: false,
    authError: null,
    appPublicSettings: null,
    loginWithEmailPassword: jest.fn(),
    registerWithEmailPassword: jest.fn(),
    loginWithBase44: jest.fn(),
    requestPasswordReset: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const wrap = (ui: React.ReactElement) =>
  <NavigationContainer>{ui}</NavigationContainer>;

describe('MenuDrawer', () => {
  beforeEach(() => {
    useMenuDrawer.setState({ isOpen: false, activeRoute: null });
  });

  it("ne rend rien quand fermé", () => {
    renderWithProviders(wrap(<MenuDrawer />));
    expect(screen.queryByText('Mon profil')).toBeNull();
    expect(screen.queryByText('Mes commandes')).toBeNull();
  });

  it("affiche les 8 items quand ouvert", async () => {
    renderWithProviders(wrap(<MenuDrawer />));
    useMenuDrawer.getState().open();
    await waitFor(() => expect(screen.getByText('Accueil')).toBeTruthy());
    expect(screen.getByText('Mon profil')).toBeTruthy();
    expect(screen.getByText('Mes commandes')).toBeTruthy();
    expect(screen.getByText('Paiement')).toBeTruthy();
    expect(screen.getByText('Mes retours')).toBeTruthy();
    expect(screen.getByText('Mes remboursements')).toBeTruthy();
    expect(screen.getByText('Avis clients')).toBeTruthy();
    expect(screen.getByText('Nous contacter')).toBeTruthy();
  });

  it("ferme via le bouton X", async () => {
    renderWithProviders(wrap(<MenuDrawer />));
    useMenuDrawer.getState().open();
    await waitFor(() => expect(screen.getByText('Accueil')).toBeTruthy());
    const closeBtn = screen.getAllByLabelText('Fermer le menu')[0];
    if (!closeBtn) throw new Error('close button not found');
    fireEvent.press(closeBtn);
    await waitFor(() => expect(useMenuDrawer.getState().isOpen).toBe(false));
  });

  it("highlight l'item correspondant à activeRoute", async () => {
    renderWithProviders(wrap(<MenuDrawer />));
    useMenuDrawer.getState().open('OrdersTab');
    await waitFor(() => expect(screen.getByText('Mes commandes')).toBeTruthy());
    const items = screen.getAllByRole('menuitem');
    const ordersItem = items.find(
      (i) => i.props.accessibilityState?.selected === true,
    );
    expect(ordersItem).toBeTruthy();
  });
});
