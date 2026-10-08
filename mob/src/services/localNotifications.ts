/**
 * Notification locale (affichée par l'appareil, sans serveur) — utilisée quand
 * l'app détecte elle-même un événement à signaler, par exemple un changement
 * de statut repéré par le rafraîchissement du fil.
 * Best-effort : sans permission ou hors appareil, rien ne se passe.
 */

import * as Notifications from 'expo-notifications';
import { configureNotificationHandler } from './pushNotifications';

export interface LocalNotificationInput {
  title: string;
  body: string;
  /** Même charge utile que les push serveur, pour ouvrir le bon écran à l'appui. */
  data?: Record<string, unknown>;
  /**
   * Identifiant de l'élément du fil : la même notification n'est jamais
   * affichée deux fois (elle remplace l'ancienne), et sa suppression dans
   * l'app la retire aussi du centre de notifications.
   */
  identifier?: string;
}

export const presentLocalNotification = async ({ title, body, data, identifier }: LocalNotificationInput) => {
  try {
    configureNotificationHandler();
    await Notifications.scheduleNotificationAsync({
      ...(identifier ? { identifier } : {}),
      content: { title, body, data, sound: 'default' },
      // `null` = immédiat ; le canal Android est celui déclaré au démarrage.
      trigger: null,
    });
  } catch {
    /* permission refusée, simulateur… : le fil in-app reste la référence */
  }
};

/**
 * Retire du centre de notifications du téléphone celles qui correspondent à
 * ces éléments du fil : notifications locales (même identifiant) et push du
 * serveur (`data.notificationId`). Appelé quand le client les supprime dans
 * l'app, pour qu'elles ne restent pas affichées sur le téléphone.
 */
export const dismissPresentedNotifications = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  try {
    const wanted = new Set(ids);
    const presented = (await Notifications.getPresentedNotificationsAsync?.()) ?? [];
    for (const n of presented) {
      const identifier = n?.request?.identifier;
      const notificationId = (n?.request?.content?.data as { notificationId?: unknown } | undefined)?.notificationId;
      if ((identifier && wanted.has(identifier)) || (typeof notificationId === 'string' && wanted.has(notificationId))) {
        await Notifications.dismissNotificationAsync(identifier);
      }
    }
  } catch {
    /* centre de notifications indisponible : sans incidence sur le fil */
  }
};
