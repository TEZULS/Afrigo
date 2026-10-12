/**
 * Notifications push (app fermée / téléphone verrouillé).
 *
 * Chaîne complète :
 *   1. l'app demande la permission et récupère un **jeton Expo push** ;
 *   2. ce jeton est enregistré sur le profil Base44 (`expo_push_token`) ;
 *   3. la tâche planifiée `dispatchPushNotifications` (cf. `base44/functions/`)
 *      pousse chaque `AppNotification` : directement par Apple (APNs) pour les
 *      iPhone si la clé APNs est configurée côté base44, sinon par Expo.
 *
 * C'est APNs/FCM qui affiche la notification : elle arrive donc même si l'app
 * est en arrière-plan, fermée, ou le téléphone verrouillé.
 *
 * Envoi direct par Apple (2026-10-10) : sur iPhone, le **jeton APNs natif**
 * est aussi enregistré (`apns_device_token`). C'est lui qu'attend la console
 * Push d'Apple (developer.apple.com → Push Notifications, environnement
 * Production) ou tout envoi APNs direct, sans passer par Expo. Il se copie
 * depuis Paramètres → Notifications.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { getBase44 } from '@/api/base44Client';
import { kv, STORAGE_KEYS } from '@/services/storage';
import { fetchDevicePushToken } from '@/services/devicePushToken';

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

/**
 * Demande la permission (idempotent : ne re-demande pas si déjà accordée).
 * `prompt: false` se contente de lire l'état, sans jamais afficher la demande.
 */
export const requestPushPermission = async (
  { prompt = true }: { prompt?: boolean } = {},
): Promise<PushPermissionResult> => {
  if (!Device.isDevice) return 'unsupported';
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || current.status === 'granted') return 'granted';
    if (!prompt || !current.canAskAgain) return 'denied';
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return asked.granted || asked.status === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
};

/** Jeton natif de l'appareil, permission déjà accordée (null si indisponible). */
const deviceTokenOrNull = async (): Promise<Notifications.DevicePushToken | null> => {
  try {
    return await fetchDevicePushToken();
  } catch {
    // Android sans configuration Firebase (FCM), simulateur, ou APNs injoignable.
    return null;
  }
};

/** Jeton Expo dérivé du jeton natif (null si Expo est injoignable). */
const fetchExpoPushToken = async (
  device: Notifications.DevicePushToken,
): Promise<string | null> => {
  try {
    const id = projectId();
    const res = await Notifications.getExpoPushTokenAsync({
      ...(id ? { projectId: id } : {}),
      devicePushToken: device,
    });
    return res?.data ?? null;
  } catch {
    return null;
  }
};

/** Jeton APNs de l'iPhone dans un jeton natif (null sur Android). */
const apnsOf = (device: Notifications.DevicePushToken | null): string | null =>
  Platform.OS === 'ios' && device && typeof device.data === 'string' && device.data ? device.data : null;

/** Récupère le jeton Expo push du device (null si refus / simulateur). */
export const getExpoPushToken = async (): Promise<string | null> => {
  const permission = await requestPushPermission();
  if (permission !== 'granted') return null;
  await ensureAndroidChannel();
  const device = await deviceTokenOrNull();
  return device ? fetchExpoPushToken(device) : null;
};

/**
 * Jeton APNs natif de l'iPhone (hexadécimal), pour un envoi direct par Apple.
 * À appeler après la permission ; null sur Android, simulateur ou échec.
 */
export const getApnsDeviceToken = async (): Promise<string | null> => {
  if (Platform.OS !== 'ios') return null;
  return apnsOf(await deviceTokenOrNull());
};

export interface PushTokens {
  permission: PushPermissionResult;
  /** Jeton Expo (envoi par base44 → Expo → Apple / Google). */
  expoToken: string | null;
  /** Jeton APNs de l'iPhone (envoi direct par Apple). */
  apnsToken: string | null;
}

/**
 * Permission puis les deux jetons : le jeton natif est lu une seule fois, et un
 * échec côté Expo (réseau) ne prive pas l'iPhone de son jeton Apple.
 */
export const getPushTokens = async (
  { prompt = true }: { prompt?: boolean } = {},
): Promise<PushTokens> => {
  const permission = await requestPushPermission({ prompt });
  if (permission !== 'granted') return { permission, expoToken: null, apnsToken: null };
  await ensureAndroidChannel();
  const device = await deviceTokenOrNull();
  if (!device) return { permission, expoToken: null, apnsToken: null };
  const expoToken = await fetchExpoPushToken(device);
  return { permission, expoToken, apnsToken: apnsOf(device) };
};

/** Jetons déjà enregistrés sur le profil, et quand (cache local). */
interface PushTokenCache {
  value: string;
  at: number;
}

/**
 * Renvoi périodique même sans changement : si l'admin ajoute les champs au
 * schéma User après coup, ou si le profil a été modifié ailleurs, les jetons
 * finissent toujours par arriver sur base44.
 */
export const PUSH_TOKEN_RESYNC_MS = 24 * 60 * 60 * 1000;

const readTokenCache = (): PushTokenCache | null => {
  const raw = kv.get<PushTokenCache | string>(STORAGE_KEYS.PUSH_TOKEN);
  if (!raw || typeof raw === 'string') return null; // ancien format (≤ 1.0.33) : on renvoie
  return typeof raw.value === 'string' && typeof raw.at === 'number' ? raw : null;
};

/**
 * Le profil renvoyé par base44 contient-il bien les jetons envoyés ? Un champ
 * absent du schéma User est ignoré sans erreur : dans ce cas on ne met rien en
 * cache, pour réessayer au prochain démarrage au lieu d'abandonner pour de bon.
 */
const profileStoredTokens = (saved: unknown, tokens: PushTokens): boolean => {
  if (!saved || typeof saved !== 'object') return true; // réponse inattendue : rien à vérifier
  const p = saved as Record<string, unknown>;
  const expoOk = !tokens.expoToken || p.expo_push_token === tokens.expoToken;
  const apnsOk = !tokens.apnsToken || p.apns_device_token === tokens.apnsToken;
  return expoOk && apnsOk;
};

/**
 * Enregistre les jetons sur le profil Base44 pour que le backend puisse pousser.
 * On n'écrit que si un jeton a changé (ou une fois par jour), afin de ne pas
 * solliciter l'API à chaque démarrage. Renvoie le jeton Expo, ou à défaut le
 * jeton APNs, ou null si aucun n'est disponible. `prompt: false` n'affiche
 * jamais la demande d'autorisation (réenregistrement au retour dans l'app).
 */
export const registerPushToken = async (
  { prompt = true }: { prompt?: boolean } = {},
): Promise<string | null> => {
  const tokens = await getPushTokens({ prompt });
  const { expoToken, apnsToken } = tokens;
  if (!expoToken && !apnsToken) return null;

  const value = `${expoToken ?? ''}|${apnsToken ?? ''}`;
  const cached = readTokenCache();
  if (cached && cached.value === value && Date.now() - cached.at < PUSH_TOKEN_RESYNC_MS) {
    return expoToken ?? apnsToken;
  }

  try {
    const saved = await getBase44().auth.updateMe({
      ...(expoToken ? { expo_push_token: expoToken } : {}),
      ...(apnsToken ? { apns_device_token: apnsToken } : {}),
      push_platform: Platform.OS,
      push_token_updated_at: new Date().toISOString(),
      push_enabled: true,
    });
    if (profileStoredTokens(saved, tokens)) {
      kv.set(STORAGE_KEYS.PUSH_TOKEN, { value, at: Date.now() } satisfies PushTokenCache);
    } else {
      kv.remove(STORAGE_KEYS.PUSH_TOKEN);
      console.warn(
        '[push] base44 n’a pas enregistré les jetons : ajoutez expo_push_token et apns_device_token au schéma User.',
      );
    }
  } catch (err) {
    // Réseau ou profil indisponible : nouvel essai au prochain démarrage.
    console.warn('[push] enregistrement des jetons impossible :', (err as Error)?.message ?? err);
  }
  return expoToken ?? apnsToken;
};

/**
 * À la déconnexion (session encore valide, cf. AuthContext.logout) : le
 * téléphone ne doit plus recevoir les push du compte. Envoyé même sans cache
 * local : base44 a pu garder un jeton sans que l'app l'ait mis en cache.
 */
export const unregisterPushToken = async (): Promise<void> => {
  kv.remove(STORAGE_KEYS.PUSH_TOKEN);
  try {
    await getBase44().auth.updateMe({
      expo_push_token: null,
      apns_device_token: null,
      push_enabled: false,
    });
  } catch {
    /* hors ligne ou session déjà close */
  }
};

/** État des notifications sur cet appareil (écran Paramètres). */
export type PushStatus = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export const getPushStatus = async (): Promise<{ status: PushStatus; canAskAgain: boolean }> => {
  if (!Device.isDevice) return { status: 'unsupported', canAskAgain: false };
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted || p.status === 'granted') return { status: 'granted', canAskAgain: false };
    if (p.status === 'undetermined') return { status: 'undetermined', canAskAgain: true };
    return { status: 'denied', canAskAgain: p.canAskAgain !== false };
  } catch {
    return { status: 'unsupported', canAskAgain: false };
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
