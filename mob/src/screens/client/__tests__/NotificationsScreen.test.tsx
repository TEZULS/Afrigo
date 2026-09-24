import React from 'react';
import { Alert, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { renderWithProviders, screen, waitFor, fireEvent, act } from '@/__tests__/test-utils';

const mockNavigate = jest.fn();

/**
 * `useFocusEffect` est piloté à la main : le nettoyage (retour = « tout vu »)
 * est capturé pour être déclenché par le test.
 */
let focusCleanup: (() => void) | undefined;
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const React = jest.requireActual('react');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), canGoBack: () => false }),
    useFocusEffect: (effect: () => void | (() => void)) => {
      React.useEffect(() => {
        const cleanup = effect();
        focusCleanup = typeof cleanup === 'function' ? cleanup : undefined;
      }, [effect]);
    },
  };
});

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'salma@x.fr' }, isAuthenticated: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockNotifications = [
  {
    id: 'n_long',
    title: 'Tout faire pour vous',
    message:
      'Un texte volontairement long qui dépasse largement les deux lignes affichées dans la liste, ' +
      'pour vérifier que la feuille de détail montre bien le message en entier.',
    type: 'manual',
    target_audience: 'all',
    related_type: 'none',
    created_date: '2026-07-29T16:12:00.000Z',
  },
  {
    id: 'n_order',
    title: 'Commande livrée',
    message: 'Votre commande a été livrée.',
    type: 'delivery_status',
    target_audience: 'all',
    related_type: 'order',
    related_id: 'ord_00000009',
    created_date: '2026-07-28T10:00:00.000Z',
  },
];

const mockReadCreate = jest.fn(async (data: Record<string, unknown>) => ({ id: 'r', ...data }));

/** Commande liée à la notification de livraison — récapitulatif dans la feuille de détail. */
const mockOrderGet = jest.fn(async (id: string) => ({
  id,
  status: 'delivered',
  total_amount: 33.45,
  created_date: '2026-07-27T10:00:00.000Z',
  delivery_address: '3 rue des Lilas',
  delivery_postal_code: '51000',
  delivery_city: 'Châlons-en-Champagne',
  items: [
    { product_name: 'Bissap', quantity: 2 },
    { product_name: 'Attiéké', quantity: 1 },
  ],
}));

jest.mock('@/api/entities', () => ({
  Order: () => ({ filter: jest.fn(async () => []), get: mockOrderGet }),
  Message: () => ({ filter: jest.fn(async () => []) }),
  AppNotification: () => ({
    filter: jest.fn(async (q: Record<string, unknown>) =>
      q.target_audience === 'all' ? mockNotifications : [],
    ),
  }),
  NotificationRead: () => ({
    filter: jest.fn(async () => []),
    create: mockReadCreate,
    update: jest.fn(async () => ({})),
  }),
}));

import { NotificationsScreen } from '../NotificationsScreen';
import { useNotificationsFeed } from '@/hooks/useNotificationsFeed';
import { resetNotificationsReadCache } from '@/hooks/useNotificationsFeed';

const wrap = (ui: React.ReactElement) => <NavigationContainer>{ui}</NavigationContainer>;

beforeEach(() => {
  resetNotificationsReadCache();
  focusCleanup = undefined;
  jest.clearAllMocks();
});

describe('NotificationsScreen', () => {
  it('ouvre le détail au tap et affiche le message complet', async () => {
    renderWithProviders(wrap(<NotificationsScreen />));
    await waitFor(() => expect(screen.getByTestId('notification-row-n_long')).toBeTruthy());

    fireEvent.press(screen.getByTestId('notification-row-n_long'));

    await waitFor(() => expect(screen.getByTestId('notification-detail-sheet')).toBeTruthy());
    expect(screen.getAllByText(/montre bien le message en entier/).length).toBeGreaterThan(0);
    // La notification ouverte est marquée lue côté serveur.
    await waitFor(() =>
      expect(mockReadCreate).toHaveBeenCalledWith(
        expect.objectContaining({ notification_id: 'n_long', is_read: true }),
      ),
    );
  });

  it('propose « Voir la commande » pour une notification de livraison', async () => {
    renderWithProviders(wrap(<NotificationsScreen />));
    await waitFor(() => expect(screen.getByTestId('notification-row-n_order')).toBeTruthy());

    fireEvent.press(screen.getByTestId('notification-row-n_order'));
    // La carte porte déjà un libellé « Voir la commande » : on vise le bouton de la feuille.
    await waitFor(() => expect(screen.getByTestId('notification-detail-open')).toBeTruthy());
    expect(screen.getByTestId('notification-detail-open')).toHaveTextContent('Voir la commande');

    // Récapitulatif de la commande chargé dans la feuille : articles, total, adresse.
    await waitFor(() => expect(mockOrderGet).toHaveBeenCalledWith('ord_00000009'));
    await waitFor(() => expect(screen.getByText('2× Bissap')).toBeTruthy());
    expect(screen.getByText('1× Attiéké')).toBeTruthy();
    expect(screen.getByText(/33,45/)).toBeTruthy();
    expect(screen.getByText(/3 rue des Lilas, 51000 Châlons-en-Champagne/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('notification-detail-open'));
    expect(mockNavigate).toHaveBeenCalledWith('OrderDetails', { id: 'ord_00000009' });
  });

  it('supprime une notification après confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const confirm = buttons?.find((b) => b.style === 'destructive');
      confirm?.onPress?.();
    });
    renderWithProviders(wrap(<NotificationsScreen />));
    await waitFor(() => expect(screen.getByTestId('notification-delete-n_long')).toBeTruthy());

    fireEvent.press(screen.getByTestId('notification-delete-n_long'));

    await waitFor(() => expect(screen.queryByTestId('notification-row-n_long')).toBeNull());
    expect(screen.getByTestId('notification-row-n_order')).toBeTruthy();
    await waitFor(() =>
      expect(mockReadCreate).toHaveBeenCalledWith(
        expect.objectContaining({ notification_id: 'n_long', deleted: true }),
      ),
    );
    alertSpy.mockRestore();
  });

  it('ouvrir l’écran remet la bulle à zéro, mais les notifications restent non lues', async () => {
    // La bulle de la cloche (barre du bas) lit le même fil que l'écran.
    const Bubble = () => <Text testID="bell-bubble">{useNotificationsFeed().badgeCount}</Text>;
    renderWithProviders(
      wrap(
        <>
          <Bubble />
          <NotificationsScreen />
        </>,
      ),
    );
    await waitFor(() => expect(screen.getByTestId('notification-row-n_long')).toBeTruthy());

    await waitFor(() => expect(screen.getByTestId('bell-bubble')).toHaveTextContent('0'));
    // Toujours des non-lues : le bouton « tout marquer comme lu » reste proposé…
    expect(screen.getByLabelText('Tout marquer comme lu')).toBeTruthy();
    // … et quitter l'écran ne les marque plus comme lues.
    act(() => {
      focusCleanup?.();
    });
    expect(screen.getByLabelText('Tout marquer comme lu')).toBeTruthy();
    expect(mockReadCreate).not.toHaveBeenCalled();
  });
});

describe('NotificationsScreen — présentation', () => {
  it('affiche la catégorie de chaque notification (commande livrée, info AfriGo)', async () => {
    renderWithProviders(wrap(<NotificationsScreen />));
    await waitFor(() => expect(screen.getByTestId('notification-row-n_long')).toBeTruthy());
    // `n_order` est liée à une commande, `n_long` est une notification admin.
    expect(screen.getByText('COMMANDE')).toBeTruthy();
    expect(screen.getByText('AFRIGO')).toBeTruthy();
  });
});
