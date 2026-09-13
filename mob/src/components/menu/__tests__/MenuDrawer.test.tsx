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

/** Textes du panneau dans leur ordre de rendu (pour vérifier l'ordre du menu). */
function renderedTexts(): string[] {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      const t = node.trim();
      if (t) out.push(t);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === 'object' && 'children' in node) {
      walk((node as { children: unknown }).children);
    }
  };
  walk(screen.toJSON());
  return out;
}

describe('MenuDrawer', () => {
  beforeEach(() => {
    useMenuDrawer.setState({ isOpen: false, activeRoute: null });
  });

  it("ne rend rien quand fermé", () => {
    renderWithProviders(wrap(<MenuDrawer />));
    expect(screen.queryByText('Mon profil')).toBeNull();
    expect(screen.queryByText('Mes commandes')).toBeNull();
  });

  it('affiche les 7 items dans l’ordre attendu quand ouvert', async () => {
    renderWithProviders(wrap(<MenuDrawer />));
    useMenuDrawer.getState().open();
    await waitFor(() => expect(screen.getByText('Accueil')).toBeTruthy());
    // « AfriGo » est le libellé de l'en-tête, pas une entrée de menu.
    const labels = renderedTexts().filter((t) => t !== 'AfriGo');
    expect(labels).toEqual([
      'Accueil',
      'Mon profil',
      'Mes recettes',
      'Mes commandes',
      'Avis clients',
      'Nous contacter',
      'Paramètres',
    ]);
  });

  it('ne contient plus les entrées déplacées dans « Paramètres »', async () => {
    renderWithProviders(wrap(<MenuDrawer />));
    useMenuDrawer.getState().open();
    await waitFor(() => expect(screen.getByText('Accueil')).toBeTruthy());
    expect(screen.queryByText('Paiement')).toBeNull();
    expect(screen.queryByText('Mes retours')).toBeNull();
    expect(screen.queryByText('Mes remboursements')).toBeNull();
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
