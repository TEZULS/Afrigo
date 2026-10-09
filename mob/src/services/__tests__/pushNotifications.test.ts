import * as Notifications from 'expo-notifications';
import { getBase44 } from '@/api/base44Client';
import { kv, STORAGE_KEYS } from '@/services/storage';
import {
  PUSH_TOKEN_RESYNC_MS,
  getExpoPushToken,
  registerPushToken,
  requestPushPermission,
  unregisterPushToken,
} from '../pushNotifications';

const mocked = Notifications as unknown as {
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  getExpoPushTokenAsync: jest.Mock;
  getDevicePushTokenAsync: jest.Mock;
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
  mocked.getDevicePushTokenAsync.mockResolvedValue({ type: 'ios', data: 'a1b2c3' });
  // base44 renvoie le profil enregistré : les champs du schéma User y figurent.
  auth.updateMe.mockImplementation(async (data: Record<string, unknown>) => ({ ...data }));
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
  });

  it('enregistre aussi le jeton APNs de l’iPhone pour un envoi direct par Apple', async () => {
    await registerPushToken();
    expect(auth.updateMe).toHaveBeenCalledWith(
      expect.objectContaining({ apns_device_token: 'a1b2c3' }),
    );
  });

  it("n'écrit pas deux fois le même jeton", async () => {
    await registerPushToken();
    auth.updateMe.mockClear();
    await registerPushToken();
    expect(auth.updateMe).not.toHaveBeenCalled();
  });

  it('enregistre le jeton Apple même si le jeton Expo est indisponible', async () => {
    mocked.getExpoPushTokenAsync.mockRejectedValue(new Error('Network request failed'));
    await expect(registerPushToken()).resolves.toBe('a1b2c3');
    expect(auth.updateMe).toHaveBeenCalledWith(
      expect.objectContaining({ apns_device_token: 'a1b2c3', push_enabled: true }),
    );
    expect(auth.updateMe.mock.calls[0][0]).not.toHaveProperty('expo_push_token');
  });

  it('réessaie au démarrage suivant si base44 n’a pas gardé les jetons (champs absents du schéma)', async () => {
    auth.updateMe.mockResolvedValue({ email: 'client@afrigo.fr' });
    await registerPushToken();
    await registerPushToken();
    expect(auth.updateMe).toHaveBeenCalledTimes(2);
    expect(kv.get(STORAGE_KEYS.PUSH_TOKEN)).toBeNull();
  });

  it('renvoie les jetons une fois par jour même sans changement', async () => {
    kv.set(STORAGE_KEYS.PUSH_TOKEN, {
      value: 'ExponentPushToken[abc]|a1b2c3',
      at: Date.now() - PUSH_TOKEN_RESYNC_MS - 1000,
    });
    await registerPushToken();
    expect(auth.updateMe).toHaveBeenCalledTimes(1);
  });

  it('renvoie les jetons mis en cache par une ancienne version de l’app', async () => {
    kv.set(STORAGE_KEYS.PUSH_TOKEN, 'ExponentPushToken[abc]|a1b2c3');
    await registerPushToken();
    expect(auth.updateMe).toHaveBeenCalledTimes(1);
  });

  it('retire les jetons du compte même sans cache local (base44 a gardé un seul des jetons)', async () => {
    kv.remove(STORAGE_KEYS.PUSH_TOKEN);
    await unregisterPushToken();
    expect(auth.updateMe).toHaveBeenCalledWith({
      expo_push_token: null,
      apns_device_token: null,
      push_enabled: false,
    });
  });

  it('n’affiche jamais la demande d’autorisation lors d’un réenregistrement silencieux', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ status: 'undetermined', granted: false, canAskAgain: true });
    await expect(registerPushToken({ prompt: false })).resolves.toBeNull();
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(auth.updateMe).not.toHaveBeenCalled();
  });

  it('détache le jeton du compte à la déconnexion', async () => {
    await registerPushToken();
    auth.updateMe.mockClear();

    await unregisterPushToken();

    expect(auth.updateMe).toHaveBeenCalledWith(
      expect.objectContaining({ expo_push_token: null, push_enabled: false }),
    );
    expect(kv.get<string>(STORAGE_KEYS.PUSH_TOKEN)).toBeNull();
  });
});
