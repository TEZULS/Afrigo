import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { hydrateBase44, tokenStore } from '@/api/base44Client';
import { kv } from '@/services/storage';

const mockLoad = jest.fn();
const mockAlert = jest.fn();
const mockBadge = jest.fn(async () => 2);
jest.mock('@/hooks/useNotificationsFeed', () => ({
  loadNotificationsFeed: (email: string) => mockLoad(email),
  alertNewNotifications: (...args: unknown[]) => mockAlert(...args),
  computeBadgeCount: () => mockBadge(),
}));

const mockSetBadge = jest.fn(async (_count: number) => {});
jest.mock('@/services/pushNotifications', () => ({
  configureNotificationHandler: jest.fn(),
  setAppBadgeCount: (n: number) => mockSetBadge(n),
}));

import {
  BACKGROUND_CHECK_INTERVAL_S,
  NOTIFICATIONS_TASK,
  disableBackgroundNotifications,
  enableBackgroundNotifications,
  runNotificationsCheck,
} from '../backgroundNotifications';

const fetchMock = BackgroundFetch as unknown as {
  getStatusAsync: jest.Mock;
  registerTaskAsync: jest.Mock;
  unregisterTaskAsync: jest.Mock;
};
const taskMock = TaskManager as unknown as { defineTask: jest.Mock; isTaskRegisteredAsync: jest.Mock };
const defineCalls = [...taskMock.defineTask.mock.calls];

const feed = { items: [{ id: 'n1' }], serverReadIds: ['n0'], complete: true };

describe('notifications app fermée (tâche d’arrière-plan)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await disableBackgroundNotifications();
    jest.clearAllMocks();
    (tokenStore.peek as jest.Mock).mockReturnValue('jeton-session');
    mockLoad.mockResolvedValue(feed);
    mockAlert.mockResolvedValue([{ id: 'n1' }]);
    fetchMock.getStatusAsync.mockResolvedValue(BackgroundFetch.BackgroundFetchStatus.Available);
    taskMock.isTaskRegisteredAsync.mockResolvedValue(false);
  });

  it('définit la tâche dès le chargement du module (exigé pour le réveil app fermée)', () => {
    expect(defineCalls.map((c) => c[0])).toContain(NOTIFICATIONS_TASK);
  });

  it('à la connexion : inscrit la vérification périodique, même après fermeture et redémarrage', async () => {
    await expect(enableBackgroundNotifications('client@afrigo.fr')).resolves.toBe('available');
    expect(fetchMock.registerTaskAsync).toHaveBeenCalledWith(NOTIFICATIONS_TASK, {
      minimumInterval: BACKGROUND_CHECK_INTERVAL_S,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  });

  it('actualisation en arrière-plan coupée par le client : rien d’inscrit, état renvoyé', async () => {
    fetchMock.getStatusAsync.mockResolvedValue(BackgroundFetch.BackgroundFetchStatus.Denied);
    await expect(enableBackgroundNotifications('client@afrigo.fr')).resolves.toBe('denied');
    expect(fetchMock.registerTaskAsync).not.toHaveBeenCalled();
  });

  it('au réveil : relit le fil du compte, affiche les nouveautés et met à jour la pastille', async () => {
    await enableBackgroundNotifications('client@afrigo.fr');
    await expect(runNotificationsCheck()).resolves.toBe(BackgroundFetch.BackgroundFetchResult.NewData);
    expect(hydrateBase44).toHaveBeenCalled();
    expect(mockLoad).toHaveBeenCalledWith('client@afrigo.fr');
    expect(mockAlert).toHaveBeenCalledWith(feed.items, { serverReadIds: ['n0'], complete: true });
    expect(mockSetBadge).toHaveBeenCalledWith(2);
  });

  it('attend la fin des écritures disque avant de rendre la main au système', async () => {
    let release!: () => void;
    const flushSpy = jest.spyOn(kv, 'flush').mockImplementation(() => new Promise<void>((r) => (release = r)));
    try {
      await enableBackgroundNotifications('client@afrigo.fr');
      let settled = false;
      const run = runNotificationsCheck().then((r) => {
        settled = true;
        return r;
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(flushSpy).toHaveBeenCalled();
      expect(settled).toBe(false);
      release();
      await expect(run).resolves.toBe(BackgroundFetch.BackgroundFetchResult.NewData);
    } finally {
      flushSpy.mockRestore();
    }
  });

  it('rien de nouveau : NoData', async () => {
    mockAlert.mockResolvedValue([]);
    await enableBackgroundNotifications('client@afrigo.fr');
    await expect(runNotificationsCheck()).resolves.toBe(BackgroundFetch.BackgroundFetchResult.NoData);
  });

  it('après déconnexion : plus aucune lecture du fil', async () => {
    await enableBackgroundNotifications('client@afrigo.fr');
    taskMock.isTaskRegisteredAsync.mockResolvedValue(true);
    await disableBackgroundNotifications();
    expect(fetchMock.unregisterTaskAsync).toHaveBeenCalledWith(NOTIFICATIONS_TASK);
    await expect(runNotificationsCheck()).resolves.toBe(BackgroundFetch.BackgroundFetchResult.NoData);
    expect(mockLoad).not.toHaveBeenCalled();
    expect(kv.get('notifications_owner_email')).toBeNull();
  });

  it('session expirée (pas de jeton) : aucune requête', async () => {
    await enableBackgroundNotifications('client@afrigo.fr');
    (tokenStore.peek as jest.Mock).mockReturnValue(null);
    await expect(runNotificationsCheck()).resolves.toBe(BackgroundFetch.BackgroundFetchResult.NoData);
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('erreur réseau : Failed, sans planter', async () => {
    await enableBackgroundNotifications('client@afrigo.fr');
    mockLoad.mockRejectedValue(new Error('Network request failed'));
    await expect(runNotificationsCheck()).resolves.toBe(BackgroundFetch.BackgroundFetchResult.Failed);
  });
});
