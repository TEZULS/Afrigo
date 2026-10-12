import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Notifications from 'expo-notifications';

interface PushTokenNativeModule {
  getDevicePushTokenAsync(): Promise<string>;
}

let inflight: Promise<Notifications.DevicePushToken> | null = null;

/**
 * Jeton natif de l'appareil : APNs (hexadécimal) sur iPhone, FCM sur Android.
 *
 * Remplace `Notifications.getDevicePushTokenAsync` : dans expo-notifications 55,
 * la promesse interne n'est remise à zéro qu'en cas de succès. Après un premier
 * échec (hors ligne, FCM indisponible), tous les appels suivants — y compris
 * `getExpoPushTokenAsync` — renvoyaient le même échec jusqu'à la relance de
 * l'app. Ici, deux appels simultanés partagent une seule requête native, et un
 * échec n'empêche pas l'essai suivant.
 */
export const fetchDevicePushToken = (): Promise<Notifications.DevicePushToken> => {
  if (!inflight) {
    inflight = (async () => {
      const native = requireOptionalNativeModule<PushTokenNativeModule>('ExpoPushTokenManager');
      if (!native?.getDevicePushTokenAsync) return Notifications.getDevicePushTokenAsync();
      const data = await native.getDevicePushTokenAsync();
      if (typeof data !== 'string' || !data) throw new Error('Jeton natif vide');
      return { type: Platform.OS, data } as Notifications.DevicePushToken;
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
};
