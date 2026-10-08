/**
 * Stockage clé/valeur pour AfriGo Mobile.
 *
 * `react-native-mmkv` v3 exige la nouvelle architecture (codegen TurboModules) ;
 * avec l’ancienne arch (stabilité Expo), on utilise un cache mémoire + AsyncStorage.
 *
 * - `secureStorage` : expo-secure-store (token, données sensibles).
 * - `kv`            : lecture/écriture synchrone en mémoire, persistance AsyncStorage.
 * - `asyncStorage`  : TanStack Query persister, etc.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KV_ASYNC_PREFIX = '__afrigo_kv__:';

const memoryKvCache = new Map<string, string>();

/**
 * Écritures disque en cours : `kv.flush()` les attend. Indispensable en tâche
 * d'arrière-plan, que le système peut arrêter dès qu'elle se termine — une
 * écriture non terminée y était perdue (notification de nouveau signalée).
 */
const pendingWrites = new Set<Promise<unknown>>();
const track = (p: Promise<unknown>) => {
  const tracked = p.catch(() => undefined).finally(() => pendingWrites.delete(tracked));
  pendingWrites.add(tracked);
};

function parseStored<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

function serializeValue(value: unknown): string | null {
  if (value == null) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Hydratation du cache mémoire depuis AsyncStorage au démarrage. */
let kvHydratePromise: Promise<void> | null = null;

function scheduleKvHydrateFromDisk() {
  if (kvHydratePromise) return kvHydratePromise;
  kvHydratePromise = (async () => {
    try {
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(KV_ASYNC_PREFIX));
      const pairs = await AsyncStorage.multiGet(keys);
      for (const [full, val] of pairs) {
        if (val != null) memoryKvCache.set(full.slice(KV_ASYNC_PREFIX.length), val);
      }
    } catch {
      /* noop */
    }
  })();
  return kvHydratePromise;
}

void scheduleKvHydrateFromDisk();

export const kv = {
  get: <T = unknown>(key: string): T | null => {
    const raw = memoryKvCache.get(key);
    if (raw == null) return null;
    return parseStored<T>(raw);
  },
  set: (key: string, value: unknown): void => {
    if (value == null) {
      memoryKvCache.delete(key);
      track(AsyncStorage.removeItem(KV_ASYNC_PREFIX + key));
      return;
    }
    const s = serializeValue(value);
    if (s == null) {
      memoryKvCache.delete(key);
      track(AsyncStorage.removeItem(KV_ASYNC_PREFIX + key));
      return;
    }
    memoryKvCache.set(key, s);
    track(AsyncStorage.setItem(KV_ASYNC_PREFIX + key, s));
  },
  remove: (key: string): void => {
    memoryKvCache.delete(key);
    track(AsyncStorage.removeItem(KV_ASYNC_PREFIX + key));
  },
  /** Attend que toutes les écritures disque lancées soient terminées. */
  flush: async (): Promise<void> => {
    while (pendingWrites.size > 0) await Promise.all([...pendingWrites]);
  },
  clear: (): void => {
    memoryKvCache.clear();
    void (async () => {
      const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(KV_ASYNC_PREFIX));
      if (keys.length) await AsyncStorage.multiRemove(keys);
    })();
  },
};

/** À appeler après hydrate du token / avant d’écrire des clés critiques. */
export const hydrateKvFromDisk = (): Promise<void> => scheduleKvHydrateFromDisk();

export const secureStorage = {
  get: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  set: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  },
  remove: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* noop */
    }
  },
};

export const asyncStorage = AsyncStorage;

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'base44_access_token',
  APP_ID: 'base44_app_id',
  GUEST_CART: 'guest_cart',
  HOME_FILTERS: 'home_filters',
  REGULATIONS_ACCEPTED: 'regulations_acceptances',
  PRIVACY_ACCEPTED: 'privacy_policy_acceptances',
  ONBOARDING_DONE: 'onboarding_done',
  THEME_MODE: 'theme_mode',
  PUSH_TOKEN: 'expo_push_token',
  SEARCH_HISTORY: 'search_history',
} as const;
