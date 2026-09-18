import React from 'react';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/__tests__/test-utils';
import { kv } from '@/services/storage';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => ({ navigate: mockNavigate }) };
});

let mockUser: Record<string, unknown> | null = null;
jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, isAuthenticated: Boolean(mockUser), isLoadingAuth: false }),
}));

let mockMessages: Record<string, unknown>[] = [];
jest.mock('@/api/entities', () => ({
  WelcomeMessage: () => ({ list: jest.fn(async () => mockMessages) }),
}));

import { WelcomeMessageDialog } from '../WelcomeMessageDialog';

const MSG = {
  id: 'w_guest',
  title: 'Bienvenue sur votre marché Africain 100% en ligne',
  message: 'Merci de vous inscrire ou connecter a votre espace client',
  is_active: true,
  target_audience: 'guests',
  display_frequency: 'once',
  button_text_guest: "S'inscrire/Se connecter",
  button_text_registered: "J'ai compris",
};

beforeEach(() => {
  jest.clearAllMocks();
  kv.clear();
  mockUser = null;
  mockMessages = [MSG];
});

describe('WelcomeMessageDialog', () => {
  it('affiche le message aux invités, le bouton ouvre la connexion et mémorise « once »', async () => {
    renderWithProviders(<WelcomeMessageDialog />);
    await waitFor(() => expect(screen.getByTestId('welcome-message')).toBeTruthy());
    expect(screen.getByText('Bienvenue sur votre marché Africain 100% en ligne')).toBeTruthy();
    expect(screen.getByText("S'inscrire/Se connecter")).toBeTruthy();

    fireEvent.press(screen.getByTestId('welcome-primary'));
    await waitFor(() => expect(screen.queryByTestId('welcome-message')).toBeNull());
    expect(mockNavigate).toHaveBeenCalledWith('Login', { initialMode: 'login' });
    expect(kv.get<string[]>('welcome_dismissed_ids')).toEqual(['w_guest']);
  });

  it('ne l’affiche pas à un client connecté quand il cible les invités, ni une fois écarté', async () => {
    mockUser = { email: 'salma@x.fr' };
    const first = renderWithProviders(<WelcomeMessageDialog />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('welcome-message')).toBeNull();
    first.unmount();

    mockUser = null;
    kv.set('welcome_dismissed_ids', ['w_guest']);
    renderWithProviders(<WelcomeMessageDialog />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('welcome-message')).toBeNull();
  });
});
