/**
 * Centralisation des variables d'environnement Expo (préfixe EXPO_PUBLIC_).
 *
 * Toute valeur secrète (clé secrète Stripe, etc.) doit transiter par les
 * cloud functions Base44 — jamais par le client mobile.
 */
import Constants from 'expo-constants';

type AppEnv = 'development' | 'preview' | 'production';

const fromExtra = (key: string): string | undefined =>
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.[key];

const read = (key: string, fallback?: string): string =>
  process.env[key] ?? fromExtra(key) ?? fallback ?? '';

/** Hôte du backend Base44 (sans `/api` — le SDK l’ajoute). */
const DEFAULT_BASE44_SERVER = 'https://afri-go-6fad2204.base44.app';
/** Clé publique client (identique à la doc API Base44 / variables Expo). */
const DEFAULT_BASE44_API_KEY = 'c80f2fb2220d479fa6e24d1deb4bb843';

const base44ServerRaw = read('EXPO_PUBLIC_BASE44_SERVER_URL', DEFAULT_BASE44_SERVER).replace(/\/$/, '');
const base44ApiKeyRaw = read('EXPO_PUBLIC_BASE44_API_KEY', DEFAULT_BASE44_API_KEY);

export const env = {
  base44: {
    appId: read('EXPO_PUBLIC_BASE44_APP_ID', '6947869a3a13c81a6fad2204'),
    serverUrl: base44ServerRaw || DEFAULT_BASE44_SERVER,
    apiKey: base44ApiKeyRaw || DEFAULT_BASE44_API_KEY,
    functionsVersion: read('EXPO_PUBLIC_BASE44_FUNCTIONS_VERSION'),
  },
  stripe: {
    publishableKey: read('EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
    merchantId: 'merchant.app.afrigo.mobile',
  },
  app: {
    baseUrl: read('EXPO_PUBLIC_APP_BASE_URL', 'https://afrigo.app'),
    env: (read('EXPO_PUBLIC_ENV', 'development') as AppEnv),
  },
} as const;

export const isDev = env.app.env === 'development';
