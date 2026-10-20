import React from 'react';
import { Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { renderWithProviders, fireEvent, screen, waitFor } from '@/__tests__/test-utils';

const mockStatus = jest.fn();
const mockRequest = jest.fn();
const mockRegister = jest.fn(async () => 'ExponentPushToken[abc]');
const mockTokens = jest.fn(async () => ({
  permission: 'granted',
  expoToken: 'ExponentPushToken[abc]',
  apnsToken: 'f'.repeat(64),
}));
let mockBackground = 'available';
let mockAuthenticated = true;

jest.mock('@/services/pushNotifications', () => ({
  getPushStatus: () => mockStatus(),
  requestPushPermission: () => mockRequest(),
  registerPushToken: () => mockRegister(),
  getPushTokens: () => mockTokens(),
}));

jest.mock('@/services/backgroundNotifications', () => ({
  getBackgroundRefreshState: async () => mockBackground,
}));

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: mockAuthenticated }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }));

import { NotificationsSettingsCard } from '../NotificationsSettingsCard';

describe('NotificationsSettingsCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticated = true;
    mockBackground = 'available';
  });

  it('propose d’activer les notifications puis relie le jeton au compte', async () => {
    mockStatus.mockResolvedValue({ status: 'undetermined', canAskAgain: true });
    mockRequest.mockResolvedValue('granted');
    renderWithProviders(<NotificationsSettingsCard />);

    fireEvent.press(await screen.findByTestId('settings-notifications-enable'));
    await waitFor(() => expect(mockRequest).toHaveBeenCalled());
    await waitFor(() => expect(mockRegister).toHaveBeenCalled());
    expect(mockToast.success).toHaveBeenCalledWith('Notifications activées', expect.any(String));
  });

  it('ouvre les réglages du téléphone quand la permission a été refusée pour de bon', async () => {
    mockStatus.mockResolvedValue({ status: 'denied', canAskAgain: false });
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    renderWithProviders(<NotificationsSettingsCard />);

    fireEvent.press(await screen.findByText('Ouvrir les réglages'));
    expect(open).toHaveBeenCalled();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('copie le jeton Apple de l’iPhone pour la console Push d’Apple', async () => {
    mockStatus.mockResolvedValue({ status: 'granted', canAskAgain: false });
    renderWithProviders(<NotificationsSettingsCard />);

    fireEvent.press(await screen.findByTestId('settings-notifications-copy-token'));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('f'.repeat(64)));
    expect(mockToast.success).toHaveBeenCalledWith('Jeton copié', expect.stringContaining('Production'));
  });

  it('signale l’actualisation en arrière-plan coupée (rien n’arriverait app fermée)', async () => {
    mockStatus.mockResolvedValue({ status: 'granted', canAskAgain: false });
    mockBackground = 'denied';
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    renderWithProviders(<NotificationsSettingsCard />);

    expect(await screen.findByTestId('settings-notifications-background')).toBeTruthy();
    fireEvent.press(screen.getByTestId('settings-notifications-background-settings'));
    expect(open).toHaveBeenCalled();
  });

  it('rien à signaler quand l’actualisation en arrière-plan est active', async () => {
    mockStatus.mockResolvedValue({ status: 'granted', canAskAgain: false });
    renderWithProviders(<NotificationsSettingsCard />);
    await screen.findByTestId('settings-notifications-copy-token');
    expect(screen.queryByTestId('settings-notifications-background')).toBeNull();
  });
});
