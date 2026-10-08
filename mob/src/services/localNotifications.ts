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
