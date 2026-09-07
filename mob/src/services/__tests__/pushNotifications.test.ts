import * as Notifications from 'expo-notifications';
import { getBase44 } from '@/api/base44Client';
import { kv, STORAGE_KEYS } from '@/services/storage';
import {
  getExpoPushToken,
  registerPushToken,
  requestPushPermission,
  unregisterPushToken,
} from '../pushNotifications';

const mocked = Notifications as unknown as {
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  getExpoPushTokenAsync: jest.Mock;
};

const auth = getBase44().auth as unknown as { updateMe: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  kv.remove(STORAGE_KEYS.PUSH_TOKEN);
  mocked.getPermissionsAsync.mockResolvedValue({
    status: 'granted',
    granted: true,
    canAskAgain: true,
  });
  mocked.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
});

describe('pushNotifications', () => {
  it('ne redemande pas la permission si elle est déjà accordée', async () => {
    await expect(requestPushPermission()).resolves.toBe('granted');
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('refuse sans relance quand la permission a été retirée définitivement', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
    });
    await expect(requestPushPermission()).resolves.toBe('denied');
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('ne renvoie aucun jeton si la permission est refusée', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({
      status: 'denied',
      granted: false,
      canAskAgain: false,
    });
    await expect(getExpoPushToken()).resolves.toBeNull();
    expect(mocked.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('enregistre le jeton sur le profil Base44 puis le met en cache', async () => {
    await expect(registerPushToken()).resolves.toBe('ExponentPushToken[abc]');
    expect(auth.updateMe).toHaveBeenCalledWith(
      expect.objectContaining({ expo_push_token: 'ExponentPushToken[abc]', push_enabled: true }),
    );
    expect(kv.get<string>(STORAGE_KEYS.PUSH_TOKEN)).toBe('ExponentPushToken[abc]');
  });

  it("n'écrit pas deux fois le même jeton", async () => {
    await registerPushToken();
    auth.updateMe.mockClear();
    await registerPushToken();
    expect(auth.updateMe).not.toHaveBeenCalled();
  });

  it('détache le jeton du compte à la déconnexion', async () => {
    await registerPushToken();
    auth.updateMe.mockClear();

    await unregisterPushToken();

    expect(auth.updateMe).toHaveBeenCalledWith({ expo_push_token: null, push_enabled: false });
    expect(kv.get<string>(STORAGE_KEYS.PUSH_TOKEN)).toBeNull();
  });
});
