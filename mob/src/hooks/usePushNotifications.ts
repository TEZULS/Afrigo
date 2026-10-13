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
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { markOpenedFromPush, navigateWhenReady } from '@/navigation/navigationRef';
import {
  configureNotificationHandler,
  ensureAndroidChannel,
  registerPushToken,
  setAppBadgeCount,
} from '@/services/pushNotifications';
import {
  disableBackgroundNotifications,
  enableBackgroundNotifications,
} from '@/services/backgroundNotifications';
import { useNotificationsFeed } from '@/hooks/useNotificationsFeed';

/**
 * Charge utile posée par les cloud functions `pushAppNotification` /
 * `dispatchPushNotifications`, calquée sur le schéma `AppNotification`.
 */
interface PushPayload {
  notificationId?: string;
  type?: string;
  relatedType?: 'order' | 'product' | 'promotion' | 'none' | 'cart' | 'return' | 'refund';
  relatedId?: string;
}

const routeForPayload = (data: PushPayload | undefined) => {
  if (data?.relatedType === 'order' && data.relatedId) {
    return () => navigateWhenReady('OrderDetails', { id: String(data.relatedId) });
  }
  if (data?.relatedType === 'return' && data.relatedId) {
    return () => navigateWhenReady('ReturnDetails', { id: String(data.relatedId) });
  }
  if (data?.relatedType === 'refund') {
    return () => navigateWhenReady('MyRefunds');
  }
  if (data?.relatedType === 'cart') {
    return () => navigateWhenReady('ClientTabs', { screen: 'CartTab' });
  }
  if (data?.relatedType === 'product' && data.relatedId) {
    return () => navigateWhenReady('ProductDetails', { id: String(data.relatedId) });
  }
  return () => navigateWhenReady('ClientTabs', { screen: 'NotificationsTab' });
};

/** Réenregistrement des jetons au retour dans l'app : au plus toutes les 10 min. */
export const PUSH_REREGISTER_MS = 10 * 60 * 1000;

export const usePushNotifications = () => {
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const { badgeCount } = useNotificationsFeed();
  const handledColdStart = useRef(false);
  /** Une même notification n'ouvre son écran qu'une fois (écouteur + démarrage à froid). */
  const handledResponses = useRef(new Set<string>());

  // Handler d'affichage + canal Android : indispensables avant toute réception.
  useEffect(() => {
    configureNotificationHandler();
    void ensureAndroidChannel();
  }, []);

  // Jetons push liés au compte connecté : à la connexion (avec la demande
  // d'autorisation), puis au retour dans l'app et quand le système change le
  // jeton (sans jamais redemander). La déconnexion les retire elle-même
  // (AuthContext.logout), tant que la session est encore valide.
  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;
    let lastRun = Date.now();
    void registerPushToken().catch(() => null);
    // Notifications app fermée : le téléphone réveille l'app pour relire le fil.
    void enableBackgroundNotifications(user.email);
    const again = (force = false) => {
      if (!force && Date.now() - lastRun < PUSH_REREGISTER_MS) return;
      lastRun = Date.now();
      void registerPushToken({ prompt: false }).catch(() => null);
    };
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      // Retour dans l'app : nouveautés affichées sans attendre le prochain passage.
      void queryClient.invalidateQueries({ queryKey: ['notificationsFeed'] });
      again();
    });
    const tokenChange = Notifications.addPushTokenListener(() => again(true));
    return () => {
      appState.remove();
      tokenChange.remove();
    };
  }, [isAuthenticated, user?.email, queryClient]);

  // Déconnexion : plus de vérification en arrière-plan pour l'ancien compte.
  const wasAuthenticated = useRef(isAuthenticated);
  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) void disableBackgroundNotifications();
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
      const id = event?.notification?.request?.identifier;
      if (id && handledResponses.current.has(id)) return;
      if (id) handledResponses.current.add(id);
      markOpenedFromPush();
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
        const id = event.notification?.request?.identifier;
        if (id && handledResponses.current.has(id)) return;
        if (id) handledResponses.current.add(id);
        markOpenedFromPush();
        const data = event.notification?.request?.content?.data as PushPayload | undefined;
        // Conteneur pas encore prêt : la navigation attend son onReady.
        routeForPayload(data)();
        // Sinon un rechargement (mise à jour OTA) rejouerait la même ouverture.
        void Notifications.clearLastNotificationResponseAsync?.().catch(() => undefined);
      })
      .catch(() => {});
  }, []);

  // Pastille sur l'icône de l'app alignée sur le compteur 🔔.
  useEffect(() => {
    void setAppBadgeCount(isAuthenticated ? badgeCount : 0);
  }, [badgeCount, isAuthenticated]);
};
