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
import { invokeFunction } from '@/api/entities';
import {
  getAppleSignInPayload,
  getGoogleSignInPayload,
  isSocialAuthCancelled,
  type SocialAuthPayload,
} from '@/services/socialAuth';

export type AuthUser = {
  id: string;
  email: string;
  full_name?: string;
  role?: 'user' | 'admin' | 'deliverer';
  is_active?: boolean;
  customer_id?: string;
  tier?: 'normal' | 'argent' | 'or' | 'diamant';
  /**
   * Paiement à la livraison interdit pour ce client (coché par l'admin dans
   * base44 → « Paiement à la livraison »). Seuls la carte et le portefeuille
   * restent proposés au paiement.
   */
  cash_on_delivery_disabled?: boolean;
  privacy_policy_accepted_version?: number;
  [key: string]: unknown;
};

export type AuthError =
  | { type: 'auth_required'; message: string }
  | { type: 'user_not_registered'; message: string }
  | { type: 'account_disabled'; message: string }
  | { type: 'unknown'; message: string };

/**
 * Champs de profil saisis dans le formulaire d'inscription.
 *
 * `civility` / `firstName` / `lastName` composent l'état civil dont base44 a
 * besoin : le web bloque le passage de commande tant que `civility`,
 * `first_name`, `last_name`, `phone`, `address`, `postal_code` et `city` ne
 * sont pas renseignés. On les collecte donc dès l'inscription.
 */
export interface RegisterProfile {
  civility?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
}

/**
 * Résultat d'une inscription.
 *
 * Base44 crée le compte puis envoie un code à 6 chiffres par email ; tant que
 * ce code n'est pas validé, `POST /auth/login` répond « Invalid email or
 * password ». L'échec de la connexion automatique n'est donc PAS un échec
 * d'inscription : on le remonte via `verification_required` pour enchaîner sur
 * la saisie du code, au lieu d'afficher « Inscription impossible ».
 */
export type RegisterOutcome =
  | { status: 'signed_in' }
  | { status: 'verification_required' };

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  authError: AuthError | null;
  appPublicSettings: Record<string, unknown> | null;
  /** Connexion email / mot de passe (API Base44 native, sans navigateur). */
  loginWithEmailPassword: (email: string, password: string) => Promise<void>;
  /**
   * Inscription, puis connexion automatique si l’API ne demande pas d’OTP.
   * Renvoie `verification_required` quand le code email doit être saisi.
   */
  registerWithEmailPassword: (
    params: { email: string; password: string } & RegisterProfile,
  ) => Promise<RegisterOutcome>;
  /** Valide le code à 6 chiffres reçu par email, puis connecte l’utilisateur. */
  verifyEmailOtp: (params: {
    email: string;
    otpCode: string;
    /** Permet la connexion automatique quand l’API ne renvoie pas de token. */
    password?: string;
    profile?: RegisterProfile;
  }) => Promise<void>;
  /** Renvoie un nouveau code de vérification par email. */
  resendEmailOtp: (email: string) => Promise<void>;
  /** OAuth / magic link via page web (fallback). */
  loginWithBase44: () => Promise<void>;
  /** Sign in with Apple (natif iOS — requis App Store si Google est proposé). */
  loginWithApple: () => Promise<void>;
  /** Sign in with Google (natif). */
  loginWithGoogle: () => Promise<void>;
  /** Demande de réinitialisation mot de passe (email Base44). */
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /**
   * Recharge silencieusement le profil (`auth.me()`) — solde du portefeuille,
   * adresse… — sans repasser par `isLoadingAuth`, qui démonte le
   * `NavigationContainer` et renvoie l'utilisateur à l'écran initial.
   */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface OAuthLoginResponse {
  access_token?: string;
  error?: string;
}

const exchangeSocialLogin = async (payload: SocialAuthPayload): Promise<string> => {
  const res = await invokeFunction<OAuthLoginResponse>('handleCustomAuth', payload);
  if (res?.error) throw new Error(res.error);
  if (!res?.access_token) throw new Error('Réponse de connexion invalide');
  return res.access_token;
};

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

  /** Pousse les champs du formulaire d'inscription sur le profil connecté. */
  const applyRegisterProfile = useCallback(
    async (profile: RegisterProfile | undefined) => {
      if (!profile) return;
      const profilePatch: Record<string, unknown> = {};
      const first = profile.firstName?.trim();
      const last = profile.lastName?.trim();
      if (profile.civility?.trim()) profilePatch.civility = profile.civility.trim();
      if (first) profilePatch.first_name = first;
      if (last) profilePatch.last_name = last;
      /*
        `full_name` reste alimenté : c'est lui qu'affichent les écrans qui ne
        connaissent pas encore `first_name`/`last_name` (admin, e-mails).
      */
      const fullName = [first, last].filter(Boolean).join(' ');
      if (fullName) profilePatch.full_name = fullName;
      if (profile.phone?.trim()) profilePatch.phone = profile.phone.trim();
      if (profile.address?.trim()) profilePatch.address = profile.address.trim();
      if (profile.postalCode?.trim()) profilePatch.postal_code = profile.postalCode.trim();
      if (profile.city?.trim()) profilePatch.city = profile.city.trim();
      if (Object.keys(profilePatch).length === 0) return;
      try {
        await getBase44().auth.updateMe(profilePatch);
        await checkUserAuth();
      } catch {
        /* profil peut être mis à jour plus tard depuis « Mon compte » */
      }
    },
    [checkUserAuth],
  );

  const registerWithEmailPassword = useCallback(
    async (
      params: { email: string; password: string } & RegisterProfile,
    ): Promise<RegisterOutcome> => {
      setAuthError(null);
      const trimmed = params.email.trim().toLowerCase();
      const { email: _email, password, ...profile } = params;

      // Une erreur ICI est un vrai échec d'inscription (email déjà pris,
      // mot de passe trop court…) : on la laisse remonter à l'écran.
      await getBase44().auth.register({ email: trimmed, password });

      try {
        await loginWithEmailPassword(trimmed, password);
      } catch {
        // Le compte EST créé et Base44 vient d'envoyer le code par email.
        // La connexion ne passera qu'une fois l'email vérifié.
        return { status: 'verification_required' };
      }

      await applyRegisterProfile(profile);
      return { status: 'signed_in' };
    },
    [loginWithEmailPassword, applyRegisterProfile],
  );

  const verifyEmailOtp = useCallback(
    async (params: {
      email: string;
      otpCode: string;
      password?: string;
      profile?: RegisterProfile;
    }) => {
      setAuthError(null);
      const trimmed = params.email.trim().toLowerCase();
      const res = (await getBase44().auth.verifyOtp({
        email: trimmed,
        otpCode: params.otpCode.trim(),
      })) as { access_token?: string } | undefined;

      if (res?.access_token) {
        await setBase44Token(res.access_token);
        await checkUserAuth();
      } else if (params.password) {
        // L'API ne renvoie pas toujours de token : l'email étant vérifié,
        // la connexion classique fonctionne désormais.
        await loginWithEmailPassword(trimmed, params.password);
      } else {
        return;
      }

      await applyRegisterProfile(params.profile);
    },
    [checkUserAuth, loginWithEmailPassword, applyRegisterProfile],
  );

  const resendEmailOtp = useCallback(async (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) throw new Error('Email requis');
    await getBase44().auth.resendOtp(trimmed);
  }, []);

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

  const loginWithApple = useCallback(async () => {
    setAuthError(null);
    try {
      const payload = await getAppleSignInPayload();
      const token = await exchangeSocialLogin(payload);
      await setBase44Token(token);
      await checkUserAuth();
    } catch (err) {
      if (isSocialAuthCancelled(err)) return;
      throw err;
    }
  }, [checkUserAuth]);

  const loginWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const payload = await getGoogleSignInPayload();
      const token = await exchangeSocialLogin(payload);
      await setBase44Token(token);
      await checkUserAuth();
    } catch (err) {
      if (isSocialAuthCancelled(err)) return;
      throw err;
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

  const refreshUser = useCallback(async () => {
    if (!tokenStore.peek()) return;
    try {
      const me = (await getBase44().auth.me()) as AuthUser & { disabled?: boolean | null };
      if (me && me.is_active !== false && me.disabled !== true) setUser(me);
    } catch {
      /* hors ligne / session expirée : on garde le profil en mémoire */
    }
  }, []);

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
      verifyEmailOtp,
      resendEmailOtp,
      loginWithBase44,
      loginWithApple,
      loginWithGoogle,
      requestPasswordReset,
      logout,
      refresh,
      refreshUser,
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
      verifyEmailOtp,
      resendEmailOtp,
      loginWithBase44,
      loginWithApple,
      loginWithGoogle,
      requestPasswordReset,
      logout,
      refresh,
      refreshUser,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
