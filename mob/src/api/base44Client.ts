/**
 * Adaptateur Base44 SDK pour React Native (AfriGo Mobile).
 *
 * Le SDK officiel `@base44/sdk` est isomorphe (axios + simple storage). En RN
 * on doit :
 *   1. Lui fournir un App ID et l'API key publique côté Expo (via env).
 *   2. Lui passer un token OAuth récupéré via deep link (`afrigo://auth?...`)
 *      ou via expo-web-browser → on le persiste dans expo-secure-store.
 *   3. NE PAS dépendre de window.localStorage. On wrappe donc le SDK avec un
 *      proxy storage clé/valeur (AsyncStorage + mémoire) / SecureStore.
 *
 * Toute la logique métier (entities, integrations, functions) reste intacte
 * et compatible avec le projet web.
 */

import { createClient } from '@base44/sdk';
import { env } from '@/config/env';
import { kv, secureStorage, STORAGE_KEYS, hydrateKvFromDisk } from '@/services/storage';

let cachedToken: string | null = null;

export const tokenStore = {
  async load(): Promise<string | null> {
    if (cachedToken) return cachedToken;
    cachedToken = await secureStorage.get(STORAGE_KEYS.AUTH_TOKEN);
    return cachedToken;
  },
  async save(token: string): Promise<void> {
    cachedToken = token;
    await secureStorage.set(STORAGE_KEYS.AUTH_TOKEN, token);
  },
  async clear(): Promise<void> {
    cachedToken = null;
    await secureStorage.remove(STORAGE_KEYS.AUTH_TOKEN);
  },
  peek(): string | null {
    return cachedToken;
  },
};

interface Base44ClientOptions {
  token?: string | null;
}

export const buildBase44Client = ({ token }: Base44ClientOptions = {}) => {
  const headers = env.base44.apiKey ? { api_key: env.base44.apiKey } : undefined;

  return createClient({
    appId: env.base44.appId,
    serverUrl: env.base44.serverUrl,
    ...(headers ? { headers } : {}),
    ...(token ? { token } : {}),
    ...(env.base44.functionsVersion
      ? { functionsVersion: env.base44.functionsVersion }
      : {}),
    requiresAuth: false,
  });
};

/**
 * Singleton mutable : on remplace l'instance lorsqu'un nouveau token est
 * chargé après login. Les écrans accèdent à `getBase44()` plutôt que d'importer
 * un `base44` figé pour bénéficier du token frais.
 */
let instance = buildBase44Client();

export const setBase44Token = async (token: string | null): Promise<void> => {
  if (token) {
    await tokenStore.save(token);
  } else {
    await tokenStore.clear();
  }
  instance = buildBase44Client({ token: token ?? null });
};

export const getBase44 = () => instance;

/**
 * Hydrate le client avec le token persisté en SecureStore au démarrage.
 * À appeler une seule fois dans App.tsx avant de monter les providers.
 */
export const hydrateBase44 = async (): Promise<void> => {
  await hydrateKvFromDisk();
  const persisted = await tokenStore.load();
  if (persisted) {
    instance = buildBase44Client({ token: persisted });
  }
  // App ID en cache KV, utile à la couche analytics offline
  kv.set(STORAGE_KEYS.APP_ID, env.base44.appId);
};
