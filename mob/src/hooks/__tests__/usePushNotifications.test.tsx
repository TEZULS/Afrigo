import React from 'react';
import { AppState } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';

const mockRegister = jest.fn(async (_opts?: { prompt?: boolean }) => 'ExponentPushToken[abc]');
jest.mock('@/services/pushNotifications', () => ({
  configureNotificationHandler: jest.fn(),
  ensureAndroidChannel: jest.fn(async () => {}),
  registerPushToken: (opts?: { prompt?: boolean }) => mockRegister(opts),
  setAppBadgeCount: jest.fn(async () => {}),
}));

const mockNavigate = jest.fn();
const mockMarkOpened = jest.fn();
jest.mock('@/navigation/navigationRef', () => ({
  navigateWhenReady: (...args: unknown[]) => mockNavigate(...args),
  markOpenedFromPush: () => mockMarkOpened(),
}));

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { email: 'client@afrigo.fr' } }),
}));
jest.mock('@/hooks/useNotificationsFeed', () => ({ useNotificationsFeed: () => ({ badgeCount: 0 }) }));

import { usePushNotifications, PUSH_REREGISTER_MS } from '../usePushNotifications';

const mocked = Notifications as unknown as {
  addNotificationResponseReceivedListener: jest.Mock;
  addPushTokenListener: jest.Mock;
  getLastNotificationResponseAsync: jest.Mock;
  clearLastNotificationResponseAsync: jest.Mock;
};

const response = (id: string, data: Record<string, unknown>) => ({
  notification: { request: { identifier: id, content: { data } } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('usePushNotifications', () => {
  let appStateListener: ((s: string) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    appStateListener = null;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, l) => {
      appStateListener = l as (s: string) => void;
      return { remove: jest.fn() } as never;
    });
    mocked.getLastNotificationResponseAsync.mockResolvedValue(null);
  });

  it('enregistre les jetons à la connexion, puis au retour dans l’app (au plus toutes les 10 min, sans redemander)', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    renderHook(() => usePushNotifications(), { wrapper });
    expect(mockRegister).toHaveBeenCalledWith(undefined);

    act(() => appStateListener?.('active'));
    expect(mockRegister).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + PUSH_REREGISTER_MS + 1);
    act(() => appStateListener?.('active'));
    expect(mockRegister).toHaveBeenCalledTimes(2);
    expect(mockRegister).toHaveBeenLastCalledWith({ prompt: false });
    now.mockRestore();
  });

  it('réenregistre tout de suite quand le système change le jeton', () => {
    renderHook(() => usePushNotifications(), { wrapper });
    const onTokenChange = mocked.addPushTokenListener.mock.calls[0][0] as () => void;
    act(() => onTokenChange());
    expect(mockRegister).toHaveBeenLastCalledWith({ prompt: false });
  });

  it('démarrage à froid : ouvre la commande une seule fois et oublie la notification', async () => {
    mocked.getLastNotificationResponseAsync.mockResolvedValue(
      response('push-1', { relatedType: 'order', relatedId: 'o42' }),
    );
    renderHook(() => usePushNotifications(), { wrapper });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('OrderDetails', { id: 'o42' }));
    expect(mocked.clearLastNotificationResponseAsync).toHaveBeenCalled();
    expect(mockMarkOpened).toHaveBeenCalled();

    // L'écouteur reçoit la même notification : pas de seconde navigation.
    const onResponse = mocked.addNotificationResponseReceivedListener.mock.calls[0][0] as (e: unknown) => void;
    act(() => onResponse(response('push-1', { relatedType: 'order', relatedId: 'o42' })));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('appui sur une push de remboursement : « Mes remboursements »', () => {
    renderHook(() => usePushNotifications(), { wrapper });
    const onResponse = mocked.addNotificationResponseReceivedListener.mock.calls[0][0] as (e: unknown) => void;
    act(() => onResponse(response('push-3', { relatedType: 'refund', relatedId: 'rf_1' })));
    expect(mockNavigate).toHaveBeenCalledWith('MyRefunds');
  });

  it('appui sur une notification, app ouverte : écran du retour concerné', () => {
    renderHook(() => usePushNotifications(), { wrapper });
    const onResponse = mocked.addNotificationResponseReceivedListener.mock.calls[0][0] as (e: unknown) => void;
    act(() => onResponse(response('push-2', { relatedType: 'return', relatedId: 'r7' })));
    expect(mockNavigate).toHaveBeenCalledWith('ReturnDetails', { id: 'r7' });
    expect(mockMarkOpened).toHaveBeenCalled();
  });
});
