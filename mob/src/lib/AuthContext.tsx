import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { hydrateBase44, getBase44, setBase44Token, tokenStore } from '@/api/base44Client';
import { env } from '@/config/env';
import { kv, STORAGE_KEYS } from '@/services/storage';
import { syncCartWithServerAfterLogin } from '@/services/cartServerSync';
import { useCart } from '@/stores/cart';

export type AuthUser = {
  id: string;
  email: string;
  full_name?: string;
  role?: 'user' | 'admin' | 'deliverer';
  is_active?: boolean;
  customer_id?: string;
  tier?: 'normal' | 'argent' | 'or' | 'diamant';
  privacy_policy_accepted_version?: number;
  [key: string]: unknown;
};

export type AuthError =
  | { type: 'auth_required'; message: string }
  | { type: 'user_not_registered'; message: string }
  | { type: 'account_disabled'; message: string }
  | { type: 'unknown'; message: string };

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  authError: AuthError | null;
  appPublicSettings: Record<string, unknown> | null;
  /** Connexion email / mot de passe (API Base44 native, sans navigateur). */
  loginWithEmailPassword: (email: string, password: string) => Promise<void>;
  /** Inscription puis connexion automatique si l’API ne demande pas d’OTP. */
  registerWithEmailPassword: (params: {
    email: string;
    password: string;
    fullName?: string;
    phone?: string;
    address?: string;
    postalCode?: string;
    city?: string;
  }) => Promise<void>;
  /** OAuth / magic link via page web (fallback). */
  loginWithBase44: () => Promise<void>;
  /** Demande de réinitialisation mot de passe (email Base44). */
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const buildLoginUrl = (returnUrl: string): string => {
  const base = `${env.app.baseUrl}`.replace(/\/$/, '');
  // Le SDK Base44 expose redirectToLogin() côté web. En mobile on construit
  // l'URL de login OAuth pointant vers afrigo.app et on capte le retour via
  // un deep link `afrigo://auth?access_token=...`.
  return `${base}/login?return_url=${encodeURIComponent(returnUrl)}&app_id=${env.base44.appId}`;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const lastCartSyncedEmailRef = React.useRef<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState<AuthError | null>(null);
  const [appPublicSettings, setAppPublicSettings] = useState<Record<string, unknown> | null>(null);

  const fetchAppPublicSettings = useCallback(async () => {
    try {
      setIsLoadingPublicSettings(true);
      // L'entité AppSettings expose le réglage public (is_available, maintenance,
      // support, geo_restriction…). Si l'app exige une auth, l'API renvoie un
      // 403 avec un reason — on le détecte ci-dessous.
      const all = (await getBase44().entities.AppSettings.list?.()) as Record<string, unknown>[] | undefined;
      const settings = all?.[0] ?? null;
      setAppPublicSettings(settings);
      setIsLoadingPublicSettings(false);
      return settings;
    } catch (e: unknown) {
      const err = e as { status?: number; data?: { extra_data?: { reason?: string } }; message?: string };
      const reason = err?.data?.extra_data?.reason;
      if (err?.status === 403 && reason) {
        if (reason === 'auth_required') {
          setAuthError({ type: 'auth_required', message: 'Authentification requise' });
        } else if (reason === 'user_not_registered') {
          setAuthError({ type: 'user_not_registered', message: 'Utilisateur non enregistré' });
        } else {
          setAuthError({ type: 'unknown', message: err.message ?? 'Erreur inconnue' });
        }
      } else {
        setAuthError({ type: 'unknown', message: err?.message ?? 'Erreur de chargement' });
      }
      setIsLoadingPublicSettings(false);
      return null;
    }
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const me = (await getBase44().auth.me()) as AuthUser & { disabled?: boolean | null };
      if (me?.is_active === false || me?.disabled === true) {
        await tokenStore.clear();
        setAuthError({ type: 'account_disabled', message: 'Compte désactivé' });
        setIsAuthenticated(false);
        setUser(null);
      } else {
        setUser(me);
        setIsAuthenticated(true);
      }
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      if (err?.status === 401 || err?.status === 403) {
        await tokenStore.clear();
        setAuthError({ type: 'auth_required', message: 'Session expirée' });
      }
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    await hydrateBase44();
    await fetchAppPublicSettings();
    if (tokenStore.peek()) {
      await checkUserAuth();
    } else {
      setIsLoadingAuth(false);
    }
  }, [fetchAppPublicSettings, checkUserAuth]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  /** Panier Base44 comme sur le web : fusion invité puis rechargement des CartItem serveur */
  useEffect(() => {
    if (!user?.email || !isAuthenticated) {
      lastCartSyncedEmailRef.current = null;
      return;
    }
    if (lastCartSyncedEmailRef.current === user.email) return;
    lastCartSyncedEmailRef.current = user.email;
    void syncCartWithServerAfterLogin(user.email).catch(() => {});
  }, [user?.email, isAuthenticated]);

  // Gestion du retour OAuth via deep link `afrigo://auth?access_token=...`
  useEffect(() => {
    const handler = async ({ url }: { url: string }) => {
      try {
        const parsed = Linking.parse(url);
        const token = parsed.queryParams?.access_token as string | undefined;
        if (token) {
          await setBase44Token(token);
          await checkUserAuth();
        }
      } catch {
        /* noop */
      }
    };

    const sub = Linking.addEventListener('url', handler);
    Linking.getInitialURL().then((u) => {
      if (u) handler({ url: u });
    });
    return () => sub.remove();
  }, [checkUserAuth]);

  const loginWithEmailPassword = useCallback(
    async (email: string, password: string) => {
      setAuthError(null);
      const trimmed = email.trim().toLowerCase();
      const res = await getBase44().auth.loginViaEmailPassword(trimmed, password);
      const token = res?.access_token;
      if (!token) throw new Error('Réponse de connexion invalide');
      await setBase44Token(token);
      await checkUserAuth();
    },
    [checkUserAuth],
  );

  const registerWithEmailPassword = useCallback(
    async (params: {
      email: string;
      password: string;
      fullName?: string;
      phone?: string;
      address?: string;
      postalCode?: string;
      city?: string;
    }) => {
      setAuthError(null);
      const trimmed = params.email.trim().toLowerCase();
      await getBase44().auth.register({
        email: trimmed,
        password: params.password,
      });
      await loginWithEmailPassword(trimmed, params.password);
      // Pousser le profil saisi dans le formulaire d'inscription
      const profilePatch: Record<string, unknown> = {};
      const fn = params.fullName?.trim();
      if (fn) {
        profilePatch.full_name = fn;
        const [first, ...rest] = fn.split(' ');
        if (first) profilePatch.first_name = first;
        if (rest.length > 0) profilePatch.last_name = rest.join(' ');
      }
      if (params.phone?.trim()) profilePatch.phone = params.phone.trim();
      if (params.address?.trim()) profilePatch.address = params.address.trim();
      if (params.postalCode?.trim()) profilePatch.postal_code = params.postalCode.trim();
      if (params.city?.trim()) profilePatch.city = params.city.trim();
      if (Object.keys(profilePatch).length > 0) {
        try {
          await getBase44().auth.updateMe(profilePatch);
          await checkUserAuth();
        } catch {
          /* profil peut être mis à jour plus tard */
        }
      }
    },
    [loginWithEmailPassword, checkUserAuth],
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) throw new Error('Email requis');
    await getBase44().auth.resetPasswordRequest(trimmed);
  }, []);

  const loginWithBase44 = useCallback(async () => {
    const redirect = Linking.createURL('auth');
    const loginUrl = buildLoginUrl(redirect);
    const result = await WebBrowser.openAuthSessionAsync(loginUrl, redirect, {
      preferEphemeralSession: false,
    });
    if (result.type === 'success' && result.url) {
      const parsed = Linking.parse(result.url);
      const token = parsed.queryParams?.access_token as string | undefined;
      if (token) {
        await setBase44Token(token);
        await checkUserAuth();
      }
    }
  }, [checkUserAuth]);

  const logout = useCallback(async () => {
    try {
      await getBase44().auth.logout();
    } catch {
      /* noop */
    }
    await setBase44Token(null);
    lastCartSyncedEmailRef.current = null;
    setUser(null);
    setIsAuthenticated(false);
    useCart.getState().clear();
    kv.remove(STORAGE_KEYS.GUEST_CART);
  }, []);

  const refresh = useCallback(async () => {
    await fetchAppPublicSettings();
    if (tokenStore.peek()) await checkUserAuth();
  }, [fetchAppPublicSettings, checkUserAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      loginWithEmailPassword,
      registerWithEmailPassword,
      loginWithBase44,
      requestPasswordReset,
      logout,
      refresh,
    }),
    [
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      loginWithEmailPassword,
      registerWithEmailPassword,
      loginWithBase44,
      requestPasswordReset,
      logout,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
