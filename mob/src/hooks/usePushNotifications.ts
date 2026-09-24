/**
 * Branchement des notifications push côté app.
 *
 *  - enregistre le jeton Expo du device sur le profil Base44 dès la connexion ;
 *  - rafraîchit le fil de notifications quand une push arrive ;
 *  - ouvre le bon écran quand l'utilisateur appuie sur une push (y compris
 *    quand l'app était fermée : `getLastNotificationResponseAsync`) ;
 *  - tient à jour la pastille de l'icône de l'app.
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { navigateWhenReady } from '@/navigation/navigationRef';
import {
  configureNotificationHandler,
  ensureAndroidChannel,
  registerPushToken,
  setAppBadgeCount,
  unregisterPushToken,
} from '@/services/pushNotifications';
import { useNotificationsFeed } from '@/hooks/useNotificationsFeed';

/**
 * Charge utile posée par les cloud functions `pushAppNotification` /
 * `dispatchPushNotifications`, calquée sur le schéma `AppNotification`.
 */
interface PushPayload {
  notificationId?: string;
  type?: string;
  relatedType?: 'order' | 'product' | 'promotion' | 'none' | 'cart' | 'return';
  relatedId?: string;
}

const routeForPayload = (data: PushPayload | undefined) => {
  if (data?.relatedType === 'order' && data.relatedId) {
    return () => navigateWhenReady('OrderDetails', { id: String(data.relatedId) });
  }
  if (data?.relatedType === 'return' && data.relatedId) {
    return () => navigateWhenReady('ReturnDetails', { id: String(data.relatedId) });
  }
  if (data?.relatedType === 'cart') {
    return () => navigateWhenReady('ClientTabs', { screen: 'CartTab' });
  }
  if (data?.relatedType === 'product' && data.relatedId) {
    return () => navigateWhenReady('ProductDetails', { id: String(data.relatedId) });
  }
  return () => navigateWhenReady('ClientTabs', { screen: 'NotificationsTab' });
};

export const usePushNotifications = () => {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const { badgeCount } = useNotificationsFeed();
  const handledColdStart = useRef(false);

  // Handler d'affichage + canal Android : indispensables avant toute réception.
  useEffect(() => {
    configureNotificationHandler();
    void ensureAndroidChannel();
  }, []);

  // Jeton push lié au compte connecté.
  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;
    void registerPushToken().catch(() => null);
  }, [isAuthenticated, user?.email]);

  // Déconnexion → le device ne doit plus recevoir les push de ce compte.
  const wasAuthenticated = useRef(isAuthenticated);
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      void unregisterPushToken();
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  // Réception (app au premier plan) → on rafraîchit le fil pour que la
  // notification apparaisse tout de suite dans la liste et sur le badge.
  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: ['notificationsFeed'] });
    });
    const response = Notifications.addNotificationResponseReceivedListener((event) => {
      void queryClient.invalidateQueries({ queryKey: ['notificationsFeed'] });
      const data = event?.notification?.request?.content?.data as PushPayload | undefined;
      routeForPayload(data)();
    });
    return () => {
      received.remove();
      response.remove();
    };
  }, [queryClient]);

  // Démarrage à froid : l'app a été ouverte EN APPUYANT sur une notification.
  useEffect(() => {
    if (handledColdStart.current) return;
    handledColdStart.current = true;
    void Notifications.getLastNotificationResponseAsync?.()
      .then((event) => {
        if (!event) return;
        const data = event.notification?.request?.content?.data as PushPayload | undefined;
        // Léger différé : le NavigationContainer n'est pas encore prêt au tout
        // premier rendu.
        setTimeout(routeForPayload(data), 400);
      })
      .catch(() => {});
  }, []);

  // Pastille sur l'icône de l'app alignée sur le compteur 🔔.
  useEffect(() => {
    void setAppBadgeCount(isAuthenticated ? badgeCount : 0);
  }, [badgeCount, isAuthenticated]);
};
