import React from 'react';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/__tests__/test-utils';
import { kv } from '@/services/storage';

let mockUser: Record<string, unknown> | null = null;
const mockRefreshUser = jest.fn(async () => {});
const mockLogout = jest.fn(async () => {});
jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: Boolean(mockUser),
    isLoadingAuth: false,
    isLoadingPublicSettings: false,
    refreshUser: mockRefreshUser,
    logout: mockLogout,
  }),
}));

const mockUpdateMe = jest.fn(async (_data: unknown) => ({}));
jest.mock('@/api/base44Client', () => ({
  getBase44: () => ({ auth: { updateMe: (d: unknown) => mockUpdateMe(d) } }),
}));

let mockRegulations: Record<string, unknown>[] = [];
let mockPolicies: Record<string, unknown>[] = [];
jest.mock('@/api/entities', () => ({
  InternalRegulations: () => ({ list: jest.fn(async () => mockRegulations) }),
  PrivacyPolicy: () => ({ list: jest.fn(async () => mockPolicies) }),
}));

import { LegalConsentGate } from '../LegalConsentGate';

const REG = {
  id: 'reg_2',
  title: 'Règlement intérieur AfriGo',
  content: '# Règlement\n\n- Respect des délais\n- Paiement à réception',
  version: 2,
  is_active: true,
  effective_date: '2026-05-12',
};
const POLICY = { id: 'pol_1', content: 'POLITIQUE DE CONFIDENTIALITÉ\n\n1. COLLECTE', version: '1.0', is_active: true };

const acceptCurrentStep = async () => {
  fireEvent.press(screen.getByTestId('legal-gate-consent'));
  await waitFor(() =>
    expect(screen.getByTestId('legal-gate-accept').props.accessibilityState?.disabled).toBeFalsy(),
  );
  fireEvent.press(screen.getByTestId('legal-gate-accept'));
};

beforeEach(() => {
  jest.clearAllMocks();
  kv.clear();
  mockUser = null;
  mockRegulations = [REG];
  mockPolicies = [POLICY];
});

describe('LegalConsentGate', () => {
  it('au premier lancement : règlement puis politique, l’accord est mémorisé', async () => {
    renderWithProviders(<LegalConsentGate />);
    await waitFor(() => expect(screen.getByTestId('legal-gate-regulations')).toBeTruthy());
    expect(screen.getByText('Règlement intérieur AfriGo')).toBeTruthy();
    expect(screen.getByText('Respect des délais')).toBeTruthy();
    // Sans cocher, impossible d'accepter.
    expect(screen.getByTestId('legal-gate-accept').props.accessibilityState?.disabled).toBe(true);

    await acceptCurrentStep();
    await waitFor(() => expect(screen.getByTestId('legal-gate-privacy')).toBeTruthy());
    expect(screen.getByText('Politique de confidentialité')).toBeTruthy();

    await acceptCurrentStep();
    await waitFor(() => expect(screen.queryByTestId('legal-gate-privacy')).toBeNull());
    // Accord rangé pour l'appareil, pas pour un compte.
    expect(kv.get('legal_regulations_accepted')).toEqual(
      expect.objectContaining({ regulationId: 'reg_2', regulationVersion: 2 }),
    );
    expect(kv.get('legal_privacy_accepted')).toEqual(expect.objectContaining({ version: '1.0' }));
    // Invité : rien n'est écrit sur un profil.
    expect(mockUpdateMe).not.toHaveBeenCalled();
  });

  it('client connecté : la politique acceptée est enregistrée sur le profil', async () => {
    mockUser = { email: 'salma@x.fr', privacy_policy_accepted_version: null };
    kv.set('legal_regulations_accepted:salma@x.fr', { regulationId: 'reg_2', regulationVersion: 2, acceptedAt: 'x' });
    renderWithProviders(<LegalConsentGate />);
    await waitFor(() => expect(screen.getByTestId('legal-gate-privacy')).toBeTruthy());
    expect(screen.queryByTestId('legal-gate-regulations')).toBeNull();

    await acceptCurrentStep();
    await waitFor(() =>
      expect(mockUpdateMe).toHaveBeenCalledWith(
        expect.objectContaining({ privacy_policy_accepted_version: '1.0' }),
      ),
    );
    await waitFor(() => expect(screen.queryByTestId('legal-gate-privacy')).toBeNull());
    expect(mockRefreshUser).toHaveBeenCalled();
  });

  it('ne redemande rien quand tout est déjà accepté, ni sans aucun document', async () => {
    mockUser = { email: 'salma@x.fr', privacy_policy_accepted_version: '1.0' };
    kv.set('legal_regulations_accepted:salma@x.fr', { regulationId: 'reg_2', regulationVersion: 2, acceptedAt: 'x' });
    const { unmount } = renderWithProviders(<LegalConsentGate />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('legal-gate-regulations')).toBeNull();
    expect(screen.queryByTestId('legal-gate-privacy')).toBeNull();
    unmount();

    mockUser = null;
    mockRegulations = [];
    mockPolicies = [];
    renderWithProviders(<LegalConsentGate />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('legal-gate-regulations')).toBeNull();
  });

  it('demande l’accord même si l’admin a laissé le document inactif', async () => {
    // En production, les textes base44 restent sur `is_active: false` : l'accord
    // doit malgré tout être demandé à tout le monde avant d'utiliser l'app.
    mockRegulations = [{ ...REG, is_active: false }];
    mockPolicies = [{ ...POLICY, is_active: false }];
    renderWithProviders(<LegalConsentGate />);
    await waitFor(() => expect(screen.getByTestId('legal-gate-regulations')).toBeTruthy());
    await acceptCurrentStep();
    await waitFor(() => expect(screen.getByTestId('legal-gate-privacy')).toBeTruthy());
  });

  it('une nouvelle version du règlement est redemandée', async () => {
    kv.set('legal_regulations_accepted:guest', { regulationId: 'reg_1', regulationVersion: 1, acceptedAt: 'x' });
    kv.set('legal_privacy_accepted:guest', { version: '1.0', acceptedAt: 'x' });
    renderWithProviders(<LegalConsentGate />);
    await waitFor(() => expect(screen.getByTestId('legal-gate-regulations')).toBeTruthy());
  });
});

describe('LegalConsentGate — accord donné une seule fois, avant connexion ou inscription', () => {
  it('accepté en invité : plus rien à la connexion, et l’accord est reporté sur le profil', async () => {
    const guest = renderWithProviders(<LegalConsentGate />);
    await waitFor(() => expect(screen.getByTestId('legal-gate-regulations')).toBeTruthy());
    await acceptCurrentStep();
    await waitFor(() => expect(screen.getByTestId('legal-gate-privacy')).toBeTruthy());
    await acceptCurrentStep();
    await waitFor(() => expect(screen.queryByTestId('legal-gate-privacy')).toBeNull());
    guest.unmount();
    expect(mockUpdateMe).not.toHaveBeenCalled();

    // Le client finit son inscription / se connecte : profil sans version acceptée.
    mockUser = { email: 'nouveau@x.fr', privacy_policy_accepted_version: null };
    renderWithProviders(<LegalConsentGate />);
    await waitFor(() =>
      expect(mockUpdateMe).toHaveBeenCalledWith(
        expect.objectContaining({ privacy_policy_accepted_version: '1.0' }),
      ),
    );
    expect(screen.queryByTestId('legal-gate-regulations')).toBeNull();
    expect(screen.queryByTestId('legal-gate-privacy')).toBeNull();
  });
});
