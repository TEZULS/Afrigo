import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { renderWithProviders, screen, waitFor } from '@/__tests__/test-utils';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => false }),
    useRoute: () => ({ name: 'Contact', key: 'contact', params: {} }),
  };
});

import { ContactScreen } from '../ContactScreen';

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

jest.mock('@/hooks/useAppSettings', () => ({
  useAppSettings: () => ({
    data: {
      support_phone: '+33606410121',
      support_email: 'afrigo13kane@gmail.com',
      is_available: true,
    },
    isLoading: false,
  }),
}));

const wrap = (ui: React.ReactElement) =>
  <NavigationContainer>{ui}</NavigationContainer>;

describe('ContactScreen', () => {
  it('affiche le titre et le sous-titre', async () => {
    renderWithProviders(wrap(<ContactScreen />));
    await waitFor(() => expect(screen.getAllByText('Nous contacter').length).toBeGreaterThan(0));
    expect(screen.getByText('Notre équipe est disponible pour vous aider')).toBeTruthy();
  });

  it("affiche les 3 cards de contact (téléphone, email, chat)", async () => {
    renderWithProviders(wrap(<ContactScreen />));
    await waitFor(() => expect(screen.getByText('Appelez-nous')).toBeTruthy());
    expect(screen.getByText('+33606410121')).toBeTruthy();
    expect(screen.getByText('Envoyez-nous un email')).toBeTruthy();
    expect(screen.getByText('afrigo13kane@gmail.com')).toBeTruthy();
    expect(screen.getByText('Chat AfriGo')).toBeTruthy();
  });

  it('affiche les hints sur chaque card', async () => {
    renderWithProviders(wrap(<ContactScreen />));
    await waitFor(() => expect(screen.getByText('Appuyez pour appeler directement')).toBeTruthy());
    expect(screen.getByText('Appuyez pour envoyer un email')).toBeTruthy();
    expect(screen.getByText('Échangez directement avec notre équipe')).toBeTruthy();
  });

  it('n’affiche plus l’encart « Testeurs bêta » (l’app n’est plus en bêta)', async () => {
    renderWithProviders(wrap(<ContactScreen />));
    await waitFor(() => expect(screen.getByText('Appuyez pour appeler directement')).toBeTruthy());
    expect(screen.queryByText('Testeurs bêta')).toBeNull();
  });
});
