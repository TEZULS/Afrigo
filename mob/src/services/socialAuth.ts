import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { env } from '@/config/env';

export type SocialAuthPayload =
  | {
      action: 'apple_login';
      identityToken: string;
      fullName?: string;
      email?: string;
    }
  | {
      action: 'google_login';
      idToken: string;
    };

let googleConfigured = false;

export function isGoogleSignInConfigured(): boolean {
  return Boolean(env.google.webClientId);
}

export function configureGoogleSignIn(): void {
  if (!env.google.webClientId || googleConfigured) return;
  GoogleSignin.configure({
    webClientId: env.google.webClientId,
    iosClientId: env.google.iosClientId || undefined,
    offlineAccess: false,
  });
  googleConfigured = true;
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

export async function getAppleSignInPayload(): Promise<SocialAuthPayload> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Connexion Apple annulée');
  }

  const fullName = credential.fullName
    ? AppleAuthentication.formatFullName(credential.fullName)
    : undefined;

  return {
    action: 'apple_login',
    identityToken: credential.identityToken,
    fullName,
    email: credential.email ?? undefined,
  };
}

export async function getGoogleSignInPayload(): Promise<SocialAuthPayload> {
  if (!isGoogleSignInConfigured()) {
    throw new Error('Connexion Google non configurée (client OAuth manquant).');
  }

  configureGoogleSignIn();

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') {
    throw new Error('Connexion Google annulée');
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error('Impossible de récupérer le jeton Google');
  }

  return {
    action: 'google_login',
    idToken,
  };
}

export function isSocialAuthCancelled(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return (
    code === 'ERR_REQUEST_CANCELED' ||
    code === statusCodes.SIGN_IN_CANCELLED ||
    code === statusCodes.IN_PROGRESS
  );
}
