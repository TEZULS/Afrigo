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

jest.mock('@/api/entities', () => ({
  Order: () => ({ filter: jest.fn(async () => mockOrders) }),
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
});
