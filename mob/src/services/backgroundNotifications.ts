/**
 * Notifications app fermée, sans rien côté serveur (demande du 2026-10-10).
 *
 * Le téléphone réveille l'app en arrière-plan de temps en temps (iOS :
 * « Actualisation en arrière-plan », Android : alarme système, même après
 * avoir fermé l'app ou redémarré le téléphone). À chaque réveil, l'app relit
 * le fil base44 du client et affiche une vraie notification système pour
 * chaque nouveauté : notification de l'admin, statut de commande ou de retour,
 * réponse du service client.
 *
 * Limites imposées par Apple / Google, à connaître :
 *   - le rythme est décidé par le système : au mieux toutes les 15 min,
 *     souvent moins sur iPhone (selon l'usage de l'app, la batterie, le mode
 *     économie d'énergie) ;
 *   - sur iPhone, rien ne tourne si le client a balayé l'app vers le haut
 *     (fermeture forcée) ou désactivé l'actualisation en arrière-plan, jusqu'à
 *     sa prochaine ouverture.
 * Une notification instantanée app fermée exige un envoi serveur (APNs/FCM) :
 * c'est le rôle de `base44/functions/dispatchPushNotifications`, si elle est
 * un jour déployée. Les deux voies ne font pas doublon (`push_sent`).
 *
 * `defineTask` doit s'exécuter au chargement du bundle : ce module est importé
 * par `index.ts`, avant l'enregistrement du composant racine.
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { hydrateBase44, tokenStore } from '@/api/base44Client';
import { hydrateKvFromDisk, kv } from '@/services/storage';
import {
  alertNewNotifications,
  computeBadgeCount,
  loadNotificationsFeed,
} from '@/hooks/useNotificationsFeed';
import { configureNotificationHandler, setAppBadgeCount } from '@/services/pushNotifications';

export const NOTIFICATIONS_TASK = 'afrigo-notifications-check';
/** Compte dont l'app relit le fil en arrière-plan (posé à la connexion). */
const OWNER_EMAIL_KEY = 'notifications_owner_email';
/** Minimum demandé au système (secondes) ; le rythme réel est le sien. */
export const BACKGROUND_CHECK_INTERVAL_S = 15 * 60;

/** Une vérification complète : fil du compte → notifications → pastille. */
export const runNotificationsCheck = async (): Promise<BackgroundFetch.BackgroundFetchResult> => {
  try {
    await hydrateKvFromDisk();
    const email = kv.get<string>(OWNER_EMAIL_KEY);
    if (!email) return BackgroundFetch.BackgroundFetchResult.NoData;
    await hydrateBase44();
    if (!tokenStore.peek()) return BackgroundFetch.BackgroundFetchResult.NoData;

    configureNotificationHandler();
    const feed = await loadNotificationsFeed(email);
    const fresh = await alertNewNotifications(feed.items, {
      serverReadIds: feed.serverReadIds,
      complete: feed.complete !== false,
    });
    await setAppBadgeCount(await computeBadgeCount(feed.items));
    // Le système peut arrêter l'app dès la fin de la tâche : sans cette attente,
    // la mémoire « déjà signalé » pouvait ne pas être écrite, et la même
    // notification réapparaissait au réveil suivant.
    await kv.flush();
    return fresh.length
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
};

try {
  TaskManager.defineTask(NOTIFICATIONS_TASK, () => runNotificationsCheck());
} catch {
  /* module natif absent (web) : pas de vérification en arrière-plan */
}

export type BackgroundRefreshState = 'available' | 'denied' | 'restricted' | 'unavailable';

/** État de l'actualisation en arrière-plan (désactivable par le client sur iPhone). */
export const getBackgroundRefreshState = async (): Promise<BackgroundRefreshState> => {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Available) return 'available';
    if (status === BackgroundFetch.BackgroundFetchStatus.Denied) return 'denied';
    if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) return 'restricted';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
};

/** À la connexion : relire ce compte en arrière-plan. */
export const enableBackgroundNotifications = async (email: string): Promise<BackgroundRefreshState> => {
  kv.set(OWNER_EMAIL_KEY, email);
  const state = await getBackgroundRefreshState();
  if (state !== 'available') return state;
  try {
    if (!(await TaskManager.isTaskRegisteredAsync(NOTIFICATIONS_TASK))) {
      await BackgroundFetch.registerTaskAsync(NOTIFICATIONS_TASK, {
        minimumInterval: BACKGROUND_CHECK_INTERVAL_S,
        stopOnTerminate: false, // Android : continue après fermeture de l'app
        startOnBoot: true, // Android : reprend après redémarrage du téléphone
      });
    }
  } catch {
    return 'unavailable';
  }
  return state;
};

/** À la déconnexion : plus aucune vérification pour l'ancien compte. */
export const disableBackgroundNotifications = async (): Promise<void> => {
  kv.remove(OWNER_EMAIL_KEY);
  try {
    if (await TaskManager.isTaskRegisteredAsync(NOTIFICATIONS_TASK)) {
      await BackgroundFetch.unregisterTaskAsync(NOTIFICATIONS_TASK);
    }
  } catch {
    /* rien à désinscrire */
  }
};
