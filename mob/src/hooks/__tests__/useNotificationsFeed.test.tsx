import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import { AllTheProviders } from '@/__tests__/test-utils';

const EMAIL = 'salma@x.fr';

const mockOrders = [
  { id: 'ord_00000001', status: 'ready', updated_date: '2026-07-26T18:36:00.000Z' },
  { id: 'ord_00000002', status: 'delivered', updated_date: '2026-07-20T10:00:00.000Z' },
];
const mockMessages = [
  { id: 'm1', content: 'Bonjour !', sender_type: 'admin', created_date: '2026-07-27T09:00:00.000Z' },
  { id: 'm2', content: 'salut', sender_type: 'customer', created_date: '2026-07-27T09:05:00.000Z' },
];

/** Notifications ciblées sur le client. */
const mockTargeted = [
  {
    id: 'n_manual',
    title: 'Promotion arrive bientôt',
    message: 'Restez connecté !',
    type: 'manual',
    target_audience: 'specific',
    target_emails: [EMAIL],
    related_type: 'none',
    created_date: '2026-07-30T20:31:00.000Z',
  },
  {
    id: 'n_delivery',
    title: 'Commande livrée',
    message: 'Votre commande a été livrée.',
    type: 'delivery_status',
    target_audience: 'specific',
    target_emails: [EMAIL],
    related_type: 'order',
    related_id: 'ord_00000002',
    created_date: '2026-07-21T08:00:00.000Z',
  },
];
/** Diffusion à tous — doit aussi apparaître. */
const mockBroadcast = [
  {
    id: 'n_all',
    title: 'Tout faire pour vous',
    message: 'Merci de votre confiance.',
    type: 'manual',
    target_audience: 'all',
    related_type: 'none',
    created_date: '2026-07-29T16:12:00.000Z',
  },
];

let mockReads: Record<string, unknown>[] = [];

const mockAppNotificationFilter = jest.fn(async (q: Record<string, unknown>) => {
  if (q.target_audience === 'all') return mockBroadcast;
  if (q.target_emails === EMAIL) return mockTargeted;
  return [];
});
const mockNotificationReadCreate = jest.fn(async (data: Record<string, unknown>) => ({
  id: 'r_' + String(data.notification_id),
  ...data,
}));
const mockNotificationReadUpdate = jest.fn(async () => ({}));

/** Demandes de retour du client — vides par défaut, renseignées par certains tests. */
let mockReturns: Record<string, unknown>[] = [];

jest.mock('@/api/entities', () => ({
  Order: () => ({ filter: jest.fn(async () => mockOrders) }),
  Return: () => ({ filter: jest.fn(async () => mockReturns) }),
  Message: () => ({ filter: jest.fn(async () => mockMessages) }),
  AppNotification: () => ({ filter: mockAppNotificationFilter }),
  NotificationRead: () => ({
    filter: jest.fn(async () => mockReads),
    create: mockNotificationReadCreate,
    update: mockNotificationReadUpdate,
  }),
}));

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'salma@x.fr' }, isAuthenticated: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import {
  useNotificationsFeed,
  markNotificationRead,
  deleteNotification,
  resetNotificationsReadCache,
} from '../useNotificationsFeed';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AllTheProviders>{children}</AllTheProviders>
);

beforeEach(() => {
  mockReads = [];
  mockReturns = [];
  resetNotificationsReadCache();
  jest.clearAllMocks();
});

describe('useNotificationsFeed', () => {
  it('agrège AppNotification (ciblées + diffusion), commandes et réponses admin', async () => {
    const { result } = renderHook(() => useNotificationsFeed(), { wrapper });
    // n_manual, n_all, n_delivery, message m1, commande ord_00000001
    // (ord_00000002 est couverte par n_delivery → pas de doublon)
    await waitFor(() => expect(result.current.items.length).toBe(5));

    expect(result.current.items.map((i) => i.id)).toEqual([
      'n_manual',
      'n_all',
      'message:m1',
      'order:ord_00000001:ready',
      'n_delivery',
    ]);
    expect(result.current.items[0].title).toBe('Promotion arrive bientôt');
  });

  it('ne duplique pas une commande déjà couverte par une notification livraison', async () => {
    const { result } = renderHook(() => useNotificationsFeed(), { wrapper });
    await waitFor(() => expect(result.current.items.length).toBe(5));
    expect(result.current.items.some((i) => i.id === 'order:ord_00000002:delivered')).toBe(false);
  });

  it("ignore les messages envoyés par le client lui-même", async () => {
    const { result } = renderHook(() => useNotificationsFeed(), { wrapper });
    await waitFor(() => expect(result.current.items.length).toBe(5));
    expect(result.current.items.some((i) => i.body === 'salut')).toBe(false);
  });

  it('masque une notification supprimée côté serveur', async () => {
    mockReads = [{ id: 'r1', notification_id: 'n_all', user_email: EMAIL, deleted: true }];
    const { result } = renderHook(() => useNotificationsFeed(), { wrapper });
    await waitFor(() => expect(result.current.items.length).toBe(4));
    expect(result.current.items.some((i) => i.id === 'n_all')).toBe(false);
  });

  it('reprend l’état « lu » enregistré côté serveur', async () => {
    mockReads = [{ id: 'r1', notification_id: 'n_manual', user_email: EMAIL, is_read: true }];
    const { result } = renderHook(() => useNotificationsFeed(), { wrapper });
    await waitFor(() => expect(result.current.items.length).toBe(5));
    await waitFor(() =>
      expect(result.current.items.find((i) => i.id === 'n_manual')?.unread).toBe(false),
    );
  });

  it('ne décrémente le compteur que pour la notification réellement ouverte', async () => {
    const { result } = renderHook(() => useNotificationsFeed(), { wrapper });
    await waitFor(() => expect(result.current.unreadCount).toBe(5));

    act(() => markNotificationRead('n_manual'));

    await waitFor(() => expect(result.current.unreadCount).toBe(4));
    expect(result.current.items.find((i) => i.id === 'n_manual')?.unread).toBe(false);
    expect(mockNotificationReadCreate).toHaveBeenCalledWith(
      expect.objectContaining({ notification_id: 'n_manual', user_email: EMAIL, is_read: true }),
    );
  });

  it('supprime une notification : masquée tout de suite, marquée deleted côté serveur', async () => {
    const { result } = renderHook(() => useNotificationsFeed(), { wrapper });
    await waitFor(() => expect(result.current.items.length).toBe(5));

    act(() => deleteNotification('n_manual'));

    await waitFor(() => expect(result.current.items.length).toBe(4));
    expect(result.current.items.some((i) => i.id === 'n_manual')).toBe(false);
    expect(result.current.unreadCount).toBe(4);
    await waitFor(() =>
      expect(mockNotificationReadCreate).toHaveBeenCalledWith(
        expect.objectContaining({ notification_id: 'n_manual', user_email: EMAIL, deleted: true }),
      ),
    );
  });

  it('supprime aussi une ligne dérivée (commande) via son identifiant composite', async () => {
    const { result } = renderHook(() => useNotificationsFeed(), { wrapper });
    await waitFor(() => expect(result.current.items.length).toBe(5));

    act(() => result.current.remove('order:ord_00000001:ready'));

    await waitFor(() =>
      expect(result.current.items.some((i) => i.id === 'order:ord_00000001:ready')).toBe(false),
    );
  });

  it('met à jour la ligne NotificationRead existante plutôt que d’en créer une à la suppression', async () => {
    mockReads = [{ id: 'r1', notification_id: 'n_all', user_email: EMAIL, is_read: true }];
    const { result } = renderHook(() => useNotificationsFeed(), { wrapper });
    await waitFor(() => expect(result.current.items.length).toBe(5));

    act(() => deleteNotification('n_all'));

    await waitFor(() =>
      expect(mockNotificationReadUpdate).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({ deleted: true }),
      ),
    );
    expect(mockNotificationReadCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ notification_id: 'n_all' }),
    );
  });

  it('remet le compteur à zéro via « tout marquer comme lu »', async () => {
    const { result } = renderHook(() => useNotificationsFeed(), { wrapper });
    await waitFor(() => expect(result.current.unreadCount).toBeGreaterThan(0));

    act(() => result.current.markAllRead());
    await waitFor(() => expect(result.current.unreadCount).toBe(0));
    expect(result.current.items.every((i) => !i.unread)).toBe(true);
  });

  it('ouvrir l’écran (« vu ») vide la bulle sans marquer les notifications comme lues', async () => {
    const { result } = renderHook(() => useNotificationsFeed(), { wrapper });
    await waitFor(() => expect(result.current.badgeCount).toBeGreaterThan(0));
    const unread = result.current.unreadCount;
    expect(result.current.badgeCount).toBe(unread);

    act(() => result.current.markSeen());
    await waitFor(() => expect(result.current.badgeCount).toBe(0));
    expect(result.current.unreadCount).toBe(unread);
    expect(mockNotificationReadCreate).not.toHaveBeenCalled();
  });
});

describe('useNotificationsFeed — demandes de retour', () => {
  const rejected = {
    id: 'ret_1',
    order_id: 'ord_00000001',
    status: 'rejected',
    rejection_reason: 'Produit ouvert',
    created_date: '2026-09-17T09:00:00.000000',
    updated_date: '2026-09-17T10:30:00.000000',
  };

  it('signale chaque changement de statut d’un retour avec le motif de l’admin', async () => {
    mockReturns = [rejected];
    const { result } = renderHook(() => useNotificationsFeed(), { wrapper });
    await waitFor(() =>
      expect(result.current.items.some((i) => i.id === 'return:ret_1:rejected')).toBe(true),
    );
    const item = result.current.items.find((i) => i.id === 'return:ret_1:rejected')!;
    expect(item.kind).toBe('return');
    expect(item.returnId).toBe('ret_1');
    expect(item.title).toBe('Retour · commande #00000001');
    expect(item.body).toBe('Votre demande de retour a été refusée. Motif : Produit ouvert');
    expect(item.unread).toBe(true);
  });

  it('alerte l’appareil pour un nouveau statut, pas pour l’existant au premier chargement', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications');
    mockReturns = [{ ...rejected, status: 'approved', admin_message: 'Le livreur passe demain.' }];
    const first = renderHook(() => useNotificationsFeed(), { wrapper });
    await waitFor(() =>
      expect(first.result.current.items.some((i) => i.id === 'return:ret_1:approved')).toBe(true),
    );
    await waitFor(() => expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled());
    first.unmount();

    // L'admin termine le retour : nouvel identifiant → notification locale.
    mockReturns = [{ ...rejected, status: 'completed', resolution_type: 'refund', refund_amount: 15.39 }];
    const second = renderHook(() => useNotificationsFeed(), { wrapper });
    await waitFor(() =>
      expect(second.result.current.items.some((i) => i.id === 'return:ret_1:completed')).toBe(true),
    );
    await waitFor(() => expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1));
    const call = Notifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(call.content.body).toBe('Votre retour est terminé. 15,39 € ont été crédités sur votre portefeuille.');
    expect(call.content.data).toEqual({ relatedType: 'return', relatedId: 'ret_1' });
  });
});

describe('alertNewNotifications — notifications du téléphone sans serveur', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { alertNewNotifications } = require('../useNotificationsFeed');

  const item = (over: Record<string, unknown>) => ({
    id: 'x',
    kind: 'custom',
    title: 'AfriGo',
    body: 'Bonjour',
    date: '2026-10-10T10:00:00.000000',
    unread: false,
    ...over,
  });
  const admin = item({ id: 'n_promo', title: 'Livraison offerte', body: 'Ce week-end seulement' });
  const baseline = [item({ id: 'n_old', title: 'Ancienne' })];
  const shown = () =>
    Notifications.scheduleNotificationAsync.mock.calls.map((c: [{ content: { title: string; body: string; data: unknown } }]) => c[0].content);

  it('premier passage : mémorise l’existant sans rien afficher', async () => {
    await alertNewNotifications(baseline);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('nouvelle notification de l’admin sur base44 → vraie notification sur le téléphone', async () => {
    await alertNewNotifications(baseline);
    await alertNewNotifications([...baseline, admin]);
    expect(shown()).toEqual([
      { title: 'Livraison offerte', body: 'Ce week-end seulement', data: { relatedType: 'none' }, sound: 'default' },
    ]);
  });

  it('jamais deux fois la même notification, même si deux vérifications tombent en même temps', async () => {
    await alertNewNotifications(baseline);
    await Promise.all([
      alertNewNotifications([...baseline, admin]),
      alertNewNotifications([...baseline, admin]),
    ]);
    await alertNewNotifications([...baseline, admin]);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('ouvre la commande liée à l’appui', async () => {
    await alertNewNotifications(baseline);
    await alertNewNotifications([
      ...baseline,
      item({ id: 'n_liv', kind: 'order', orderId: 'ord_9', title: 'En route', body: 'Le livreur arrive' }),
    ]);
    expect(shown()[0].data).toEqual({ relatedType: 'order', relatedId: 'ord_9' });
  });

  it('rien pour une notification déjà lue sur un autre appareil', async () => {
    await alertNewNotifications(baseline);
    await alertNewNotifications([...baseline, admin], { serverReadIds: ['n_promo'] });
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('rien pour la commande que le client vient de passer, mais le statut suivant est signalé', async () => {
    await alertNewNotifications(baseline);
    const order = (status: string) =>
      item({ id: `order:o1:${status}`, kind: 'order', orderId: 'o1', orderStatus: status, derived: true, title: 'Commande #O1', body: status });
    await alertNewNotifications([...baseline, order('pending')]);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    await alertNewNotifications([...baseline, order('confirmed')]);
    expect(shown()).toHaveLength(1);
    expect(shown()[0].body).toBe('confirmed');
  });

  it('rien si le serveur l’a déjà poussée (push_sent)', async () => {
    await alertNewNotifications(baseline);
    await alertNewNotifications([...baseline, { ...admin, pushSent: true }]);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('push serveur en erreur : la notification locale prend le relais', async () => {
    // Les deux requêtes du fil (ciblées puis diffusion) passent par ce faux filtre.
    const fakeFilter = async (q: Record<string, unknown>) =>
      q.target_audience === 'all'
        ? [
            { id: 'n_srv_ok', title: 'Partie', message: 'ok', type: 'manual', target_audience: 'all', push_sent: true, created_date: '2026-10-10T10:00:00.000000' },
            { id: 'n_srv_ko', title: 'Échouée', message: 'ko', type: 'manual', target_audience: 'all', push_sent: true, push_error: 'Accusé Expo InvalidCredentials', created_date: '2026-10-10T10:01:00.000000' },
          ]
        : [];
    (mockAppNotificationFilter as jest.Mock)
      .mockImplementationOnce(fakeFilter)
      .mockImplementationOnce(fakeFilter);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadNotificationsFeed } = require('../useNotificationsFeed');
    const feed = await loadNotificationsFeed(EMAIL);
    await alertNewNotifications(baseline);
    await alertNewNotifications([...baseline, ...feed.items]);
    const titles = shown().map((c: { title: string }) => c.title);
    expect(titles).toContain('Échouée');
    expect(titles).not.toContain('Partie');
  });

  it('une salve est résumée : 3 notifications puis « 3 autres nouveautés »', async () => {
    await alertNewNotifications(baseline);
    const burst = Array.from({ length: 6 }, (_, i) =>
      item({ id: `n_${i}`, title: `Notif ${i}`, date: `2026-10-10T1${i}:00:00.000000` }),
    );
    await alertNewNotifications([...baseline, ...burst]);
    const titles = shown().map((c: { title: string }) => c.title);
    expect(titles).toEqual(['Notif 5', 'Notif 4', 'Notif 3', 'AfriGo']);
    expect(shown()[3].body).toBe('3 autres nouveautés vous attendent.');
  });

  it('fil incomplet au premier passage (réseau) : pas de référence, donc pas d’avalanche ensuite', async () => {
    await alertNewNotifications([], { complete: false });
    await alertNewNotifications([...baseline, admin]);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    await alertNewNotifications([...baseline, admin, item({ id: 'n_new', title: 'Nouvelle' })]);
    expect(shown().map((c: { title: string }) => c.title)).toEqual(['Nouvelle']);
  });
});

describe('réclamations et remboursements annoncés par le serveur', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { alertNewNotifications, loadNotificationsFeed } = require('../useNotificationsFeed');

  const serverRows = [
    {
      id: 'an_ret',
      title: 'Réclamation acceptée',
      message: 'Votre réclamation (commande #00000001) a été acceptée.',
      type: 'manual',
      target_audience: 'specific',
      target_emails: [EMAIL],
      related_type: 'return',
      related_id: 'ret_1',
      created_date: '2026-10-11T09:00:00.000000',
    },
    {
      id: 'an_ref',
      title: 'Remboursement effectué',
      message: '24,50 € ont été crédités sur votre portefeuille AfriGo.',
      type: 'manual',
      target_audience: 'specific',
      target_emails: [EMAIL],
      related_type: 'refund',
      related_id: 'rf_1',
      created_date: '2026-10-11T10:00:00.000000',
    },
  ];
  const fake = async (q: Record<string, unknown>) => (q.target_emails === EMAIL ? serverRows : []);

  it('ouvre la réclamation ou « Mes remboursements », sans doublon avec le retour dérivé', async () => {
    mockReturns = [{ id: 'ret_1', order_id: 'ord_00000001', status: 'approved', updated_date: '2026-10-11T08:59:00.000000' }];
    (mockAppNotificationFilter as jest.Mock).mockImplementationOnce(fake).mockImplementationOnce(fake);
    const feed = await loadNotificationsFeed(EMAIL);
    const ret = feed.items.find((i: { id: string }) => i.id === 'an_ret');
    const ref = feed.items.find((i: { id: string }) => i.id === 'an_ref');
    expect(ret).toMatchObject({ kind: 'return', returnId: 'ret_1', returnStatus: 'approved' });
    expect(ref).toMatchObject({ kind: 'refund' });
    // Le retour dérivé « return:ret_1:approved » est remplacé par la notification serveur.
    expect(feed.items.some((i: { id: string }) => i.id.startsWith('return:ret_1'))).toBe(false);
  });

  it('notification locale de secours : un remboursement ouvre « Mes remboursements »', async () => {
    await alertNewNotifications([]);
    await alertNewNotifications([
      { id: 'an_ref', kind: 'refund', title: 'Remboursement effectué', body: 'ok', date: '2026-10-11T10:00:00.000000', unread: false },
    ]);
    expect(Notifications.scheduleNotificationAsync.mock.calls[0][0].content.data).toEqual({ relatedType: 'refund' });
  });

  it('statut lu localement il y a moins de 2 min : attendu (le serveur va l’annoncer), puis signalé s’il reste seul', async () => {
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString().replace('Z', '000');
    const derived = (date: string) => ({
      id: 'order:o9:confirmed', kind: 'order', orderId: 'o9', orderStatus: 'confirmed', derived: true,
      title: 'Commande #O9', body: 'confirmée', date, unread: false,
    });
    await alertNewNotifications([]);
    await alertNewNotifications([derived(iso(now - 30_000))]);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    // 3 minutes plus tard, toujours sans notification serveur : signalé.
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now + 3 * 60_000);
    await alertNewNotifications([derived(iso(now - 30_000))]);
    spy.mockRestore();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });
});

describe('annonce serveur sortie de la fenêtre des dernières notifications', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { alertNewNotifications, loadNotificationsFeed } = require('../useNotificationsFeed');

  it('« Livraison manquée » ne fait pas ressurgir une ancienne commande comme une nouveauté', async () => {
    // 1er passage : « Commande livrée » (n_delivery) couvre ord_00000002.
    const first = await loadNotificationsFeed(EMAIL);
    expect(first.items.some((i: { id: string }) => i.id.startsWith('order:ord_00000002'))).toBe(false);
    await alertNewNotifications(first.items);

    // La nouvelle notification pousse n_delivery hors des REMOTE_LIMIT dernières.
    const missed = {
      id: 'n_missed',
      title: '⚠️ Livraison manquée (1ère)',
      message: "Votre commande #00000001 n'a pas pu être livrée. Motif : Pas de réponse",
      type: 'delivery_status',
      target_audience: 'specific',
      target_emails: [EMAIL],
      related_type: 'order',
      related_id: 'ord_00000001',
      created_date: '2026-10-13T21:37:13.312000',
    };
    const shifted = async (q: Record<string, unknown>) =>
      q.target_emails === EMAIL ? [missed, mockTargeted[0]] : mockBroadcast;
    (mockAppNotificationFilter as jest.Mock).mockImplementationOnce(shifted).mockImplementationOnce(shifted);
    const second = await loadNotificationsFeed(EMAIL);

    expect(second.items.some((i: { id: string }) => i.id.startsWith('order:ord_00000002'))).toBe(false);
    await alertNewNotifications(second.items);
    const titles = Notifications.scheduleNotificationAsync.mock.calls.map(
      (c: [{ content: { title: string } }]) => c[0].content.title,
    );
    expect(titles).toEqual(['⚠️ Livraison manquée (1ère)']);
  });
});

describe('changement de compte sur le même téléphone', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications');
  const { alertNewNotifications, loadNotificationsFeed, computeBadgeCount, claimNotificationsState } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../useNotificationsFeed');

  it('A → déconnexion → B : B part de zéro, sans salve de notifications', async () => {
    const a = await loadNotificationsFeed('autre@x.fr');
    await alertNewNotifications(a.items);
    deleteNotification('n_all');

    // La déconnexion ne touche pas au fil ; B se connecte ensuite.
    const b = await loadNotificationsFeed(EMAIL);
    await alertNewNotifications(b.items);

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    // n_all, supprimée par A, reste visible et non lue pour B.
    expect(b.items).toHaveLength(5);
    await expect(computeBadgeCount(b.items)).resolves.toBe(5);
  });

  it('A → déconnexion → A : l’état est conservé', async () => {
    const first = await loadNotificationsFeed(EMAIL);
    await alertNewNotifications(first.items);
    deleteNotification('n_all');

    // Même compte, e-mail saisi autrement à la reconnexion.
    await claimNotificationsState(' Salma@X.fr ');
    const again = await loadNotificationsFeed(EMAIL);
    await alertNewNotifications(again.items);

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    await expect(computeBadgeCount(again.items)).resolves.toBe(4);
  });
});

describe('fil — rappels de panier répétés, suppressions et alertes uniques', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const feed = require('../useNotificationsFeed');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { kv } = require('@/services/storage');

  const reminder = (id: string, hoursAgo: number, related = EMAIL) => ({
    id,
    title: '🛒 Vous avez oublié votre panier !',
    message: 'Il semble que vous ayez laissé 2 article(s) dans votre panier.',
    type: 'cart_reminder',
    target_audience: 'specific',
    target_emails: [EMAIL],
    related_type: 'cart',
    related_id: related,
    created_date: new Date(Date.now() - hoursAgo * 3600_000).toISOString().replace('Z', '000'),
  });
  const withRows = (rows: Record<string, unknown>[]) => {
    const fake = async (q: Record<string, unknown>) => (q.target_emails === EMAIL ? rows : []);
    (mockAppNotificationFilter as jest.Mock).mockImplementationOnce(fake).mockImplementationOnce(fake);
  };

  it('un seul rappel de panier affiché (le plus récent), un par sorte', async () => {
    withRows([reminder('r_old', 9), reminder('r_new', 1), reminder('r_mid', 5), reminder('low_1', 2, `lowstock:${EMAIL}`)]);
    const { items } = await feed.loadNotificationsFeed(EMAIL);
    const ids = items.map((i: { id: string }) => i.id);
    expect(ids).toContain('r_new');
    expect(ids).toContain('low_1');
    expect(ids).not.toContain('r_old');
    expect(ids).not.toContain('r_mid');
  });

  it('le rappel supprimé ne laisse pas revenir les plus anciens', async () => {
    mockReads = [{ id: 'rd1', notification_id: 'r_new', user_email: EMAIL, deleted: true }];
    withRows([reminder('r_old', 9), reminder('r_new', 1)]);
    const { items } = await feed.loadNotificationsFeed(EMAIL);
    expect(items.some((i: { id: string }) => i.id === 'r_new' || i.id === 'r_old')).toBe(false);
  });

  it('les suppressions sont relues à part (jamais perdues au-delà des 500 lignes récentes)', async () => {
    const filterSpy = jest.fn(async () => []);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const entities = require('@/api/entities');
    const original = entities.NotificationRead;
    entities.NotificationRead = () => ({ filter: filterSpy, create: jest.fn(), update: jest.fn() });
    try {
      await feed.loadNotificationsFeed(EMAIL);
    } finally {
      entities.NotificationRead = original;
    }
    expect(filterSpy).toHaveBeenCalledWith({ user_email: EMAIL, deleted: true }, '-created_date', 1000);
  });

  it('suppression multiple : masquées, enregistrées une à une, retirées du centre de notifications', async () => {
    Notifications.getPresentedNotificationsAsync.mockResolvedValueOnce([
      { request: { identifier: 'n_manual', content: { data: {} } } },
      { request: { identifier: 'remote-xyz', content: { data: { notificationId: 'n_all' } } } },
      { request: { identifier: 'autre', content: { data: { notificationId: 'n_zzz' } } } },
    ]);
    const { result } = renderHook(() => feed.useNotificationsFeed(), { wrapper });
    await waitFor(() => expect(result.current.items.length).toBe(5));

    act(() => result.current.removeMany(['n_manual', 'n_all']));
    await waitFor(() => expect(result.current.items.length).toBe(3));
    await waitFor(() => expect(mockNotificationReadCreate).toHaveBeenCalledTimes(2));
    expect(mockNotificationReadCreate).toHaveBeenCalledWith(expect.objectContaining({ notification_id: 'n_all', deleted: true }));
    await waitFor(() => expect(Notifications.dismissNotificationAsync).toHaveBeenCalledTimes(2));
    expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('n_manual');
    expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('remote-xyz');
  });

  it('plusieurs écrans abonnés au même fil : une seule vérification d’alertes par chargement', async () => {
    const getSpy = jest.spyOn(kv, 'get');
    const checks = () => getSpy.mock.calls.filter((c: unknown[]) => c[0] === 'notifications_alerted_ids').length;
    // Accueil, onglets et écran Notifications lisent le même fil.
    const { result } = renderHook(() => [feed.useNotificationsFeed(), feed.useNotificationsFeed(), feed.useNotificationsFeed()], {
      wrapper,
    });
    await waitFor(() => expect(result.current[0].items.length).toBe(5));
    await waitFor(() => expect(checks()).toBeGreaterThan(0));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(checks()).toBe(1);
    getSpy.mockRestore();
  });

  it('notification du téléphone identifiée par l’élément du fil (remplacée, jamais en double)', async () => {
    const items = [{ id: 'b1', kind: 'custom', title: 'A', body: 'a', date: '2026-10-10T10:00:00.000000', unread: false }];
    await feed.alertNewNotifications(items);
    await feed.alertNewNotifications([...items, { ...items[0], id: 'b2', title: 'Nouveau' }]);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'b2', content: expect.objectContaining({ title: 'Nouveau' }) }),
    );
  });

  it('fil inchangé : la mémoire « déjà signalé » n’est pas réécrite à chaque rafraîchissement', async () => {
    const items = [{ id: 'a1', kind: 'custom', title: 'A', body: 'a', date: '2026-10-10T10:00:00.000000', unread: false }];
    await feed.alertNewNotifications(items);
    const setSpy = jest.spyOn(kv, 'set');
    await feed.alertNewNotifications(items);
    await feed.alertNewNotifications(items);
    expect(setSpy.mock.calls.filter((c: unknown[]) => c[0] === 'notifications_alerted_ids')).toHaveLength(0);
    // Une nouveauté, elle, est mémorisée (et signalée).
    await feed.alertNewNotifications([...items, { ...items[0], id: 'a2', title: 'B' }]);
    expect(setSpy.mock.calls.filter((c: unknown[]) => c[0] === 'notifications_alerted_ids')).toHaveLength(1);
    setSpy.mockRestore();
  });
});
