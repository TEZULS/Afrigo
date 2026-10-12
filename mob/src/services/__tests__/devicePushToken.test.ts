jest.unmock('@/services/devicePushToken');

const mockNative = { getDevicePushTokenAsync: jest.fn() };
jest.mock('expo', () => ({
  requireOptionalNativeModule: (name: string) => (name === 'ExpoPushTokenManager' ? mockNative : null),
}));

import { fetchDevicePushToken } from '../devicePushToken';

describe('fetchDevicePushToken', () => {
  beforeEach(() => mockNative.getDevicePushTokenAsync.mockReset());

  it('renvoie le jeton natif de l’iPhone', async () => {
    mockNative.getDevicePushTokenAsync.mockResolvedValue('ab'.repeat(32));
    await expect(fetchDevicePushToken()).resolves.toEqual({ type: 'ios', data: 'ab'.repeat(32) });
  });

  it('réessaie vraiment après un échec (expo-notifications restait bloqué jusqu’à la relance)', async () => {
    mockNative.getDevicePushTokenAsync
      .mockRejectedValueOnce(new Error('SERVICE_NOT_AVAILABLE'))
      .mockResolvedValueOnce('cd'.repeat(32));
    await expect(fetchDevicePushToken()).rejects.toThrow('SERVICE_NOT_AVAILABLE');
    await expect(fetchDevicePushToken()).resolves.toEqual({ type: 'ios', data: 'cd'.repeat(32) });
    expect(mockNative.getDevicePushTokenAsync).toHaveBeenCalledTimes(2);
  });

  it('deux demandes simultanées partagent un seul appel natif', async () => {
    mockNative.getDevicePushTokenAsync.mockResolvedValue('ef'.repeat(32));
    const [a, b] = await Promise.all([fetchDevicePushToken(), fetchDevicePushToken()]);
    expect(a).toEqual(b);
    expect(mockNative.getDevicePushTokenAsync).toHaveBeenCalledTimes(1);
  });

  it('refuse un jeton vide', async () => {
    mockNative.getDevicePushTokenAsync.mockResolvedValue('');
    await expect(fetchDevicePushToken()).rejects.toThrow('Jeton natif vide');
  });
});
