import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { renderWithProviders, screen } from '@/__tests__/test-utils';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => false }),
    useRoute: () => ({ name: 'PaymentMethods', key: 'pm', params: {} }),
  };
});

import { PaymentMethodsScreen } from '../PaymentMethodsScreen';

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'test@x.fr' },
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

describe('PaymentMethodsScreen', () => {
  it('affiche le titre et le sous-titre', () => {
    renderWithProviders(wrap(<PaymentMethodsScreen />));
    expect(screen.getAllByText('Moyens de paiement').length).toBeGreaterThan(0);
    expect(screen.getByText('Gérez votre carte bancaire enregistrée')).toBeTruthy();
  });

  it("affiche la card 'Ma carte enregistrée' avec empty state", () => {
    renderWithProviders(wrap(<PaymentMethodsScreen />));
    expect(screen.getByText('Ma carte enregistrée')).toBeTruthy();
    expect(screen.getByText('Aucune carte enregistrée')).toBeTruthy();
  });

  it("affiche la card 'Ajouter une carte' avec bouton + Ajouter", () => {
    renderWithProviders(wrap(<PaymentMethodsScreen />));
    expect(screen.getByText('Ajouter une carte')).toBeTruthy();
    expect(screen.getByText('Ajouter')).toBeTruthy();
  });
});
