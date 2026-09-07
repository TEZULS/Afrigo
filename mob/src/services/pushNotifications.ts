/**
 * Notifications push (app fermée / téléphone verrouillé).
 *
 * Chaîne complète :
 *   1. l'app demande la permission et récupère un **jeton Expo push** ;
 *   2. ce jeton est enregistré sur le profil Base44 (`expo_push_token`) ;
 *   3. la cloud function `pushAppNotification` (cf. `base44/functions/`)
 *      relaie le message à l'API Expo, qui le remet à APNs / FCM.
 *
 * C'est APNs/FCM qui affiche la notification : elle arrive donc même si l'app
 * est en arrière-plan, fermée, ou le téléphone verrouillé.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { getBase44 } from '@/api/base44Client';
import { kv, STORAGE_KEYS } from '@/services/storage';

/** Canal Android : sans canal « high », rien ne s'affiche écran verrouillé. */
export const ANDROID_CHANNEL_ID = 'afrigo-default';

let handlerConfigured = false;

/**
 * Affichage en premier plan. Sans ce handler, une push reçue app ouverte est
 * silencieusement avalée par le système.
 */
export const configureNotificationHandler = () => {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
};

export const ensureAndroidChannel = async () => {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'AfriGo',
      description: 'Commandes, messages et actualités AfriGo',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F97316',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
    });
  } catch {
    /* canal indisponible (Expo Go / build web) */
  }
};

const projectId = (): string | undefined => {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  return extra?.eas?.projectId ?? (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
};

export type PushPermissionResult = 'granted' | 'denied' | 'unsupported';

/** Demande la permission (idempotent : ne re-demande pas si déjà accordée). */
export const requestPushPermission = async (): Promise<PushPermissionResult> => {
  if (!Device.isDevice) return 'unsupported';
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.status === 'granted') return 'granted';
    if (!current.canAskAgain) return 'denied';
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return asked.granted || asked.status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
};

/** Récupère le jeton Expo push du device (null si refus / simulateur). */
export const getExpoPushToken = async (): Promise<string | null> => {
  const permission = await requestPushPermission();
  if (permission !== 'granted') return null;
  await ensureAndroidChannel();
  try {
    const id = projectId();
    const res = await Notifications.getExpoPushTokenAsync(id ? { projectId: id } : undefined);
    return res?.data ?? null;
  } catch {
    return null;
  }
};

/**
 * Enregistre le jeton sur le profil Base44 pour que le backend puisse pousser.
 * On n'écrit que si le jeton a changé, afin de ne pas spammer l'API à chaque
 * démarrage.
 */
export const registerPushToken = async (): Promise<string | null> => {
  const token = await getExpoPushToken();
  if (!token) return null;

  if (kv.get<string>(STORAGE_KEYS.PUSH_TOKEN) === token) return token;

  try {
    await getBase44().auth.updateMe({
      expo_push_token: token,
      push_platform: Platform.OS,
      push_token_updated_at: new Date().toISOString(),
      push_enabled: true,
    });
    kv.set(STORAGE_KEYS.PUSH_TOKEN, token);
  } catch {
    // Profil non modifiable (champ absent côté Base44) : on garde quand même le
    // jeton en local pour un nouvel essai au prochain démarrage.
    return token;
  }
  return token;
};

/** À la déconnexion : le device ne doit plus recevoir les push du compte. */
export const unregisterPushToken = async (): Promise<void> => {
  const token = kv.get<string>(STORAGE_KEYS.PUSH_TOKEN);
  kv.remove(STORAGE_KEYS.PUSH_TOKEN);
  if (!token) return;
  try {
    await getBase44().auth.updateMe({ expo_push_token: null, push_enabled: false });
  } catch {
    /* noop */
  }
};

/** Pastille sur l'icône de l'app (iOS + launchers Android compatibles). */
export const setAppBadgeCount = async (count: number): Promise<void> => {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    /* noop */
  }
};
