/**
 * Message de bienvenue (`WelcomeMessage` base44), affiché à l'accueil avec les
 * mêmes règles que le site afrigo.app (bundle déployé relevé le 2026-09-18) :
 * premier message de la liste, actif, ciblé (`all` / `guests` / `registered` /
 * `specific` + `specific_users`), et selon `display_frequency` :
 * `once` (une seule fois par appareil), `daily` (une fois par jour),
 * `every_login` (à chaque ouverture de l'app).
 */

export type WelcomeAudience = 'all' | 'guests' | 'registered' | 'specific';
export type WelcomeFrequency = 'once' | 'daily' | 'every_login';

export interface WelcomeMessageRow {
  id: string;
  title?: string;
  message?: string;
  is_active?: boolean;
  target_audience?: WelcomeAudience | string;
  specific_users?: string[];
  display_frequency?: WelcomeFrequency | string;
  button_text_guest?: string;
  button_text_registered?: string;
}

/** Clés de stockage local (même découpage que le site). */
export const WELCOME_DISMISSED_KEY = 'welcome_dismissed_ids';
export const WELCOME_DAILY_KEY = 'welcome_daily_dismissed';

export interface WelcomeDismissals {
  /** `once` : identifiants définitivement écartés. */
  dismissedIds: string[];
  /** `daily` : identifiant → `toDateString()` du dernier affichage. */
  daily: Record<string, string>;
  /** `every_login` : identifiants déjà montrés pendant cette ouverture de l'app. */
  shownThisSession: string[];
}

export const todayKey = (now = new Date()): string => now.toDateString();

const audienceMatches = (m: WelcomeMessageRow, email?: string | null): boolean => {
  switch (m.target_audience) {
    case 'all':
      return true;
    case 'guests':
      return !email;
    case 'registered':
      return Boolean(email);
    case 'specific':
      return Boolean(email) && (m.specific_users ?? []).includes(email as string);
    default:
      return false;
  }
};

/** Message à afficher maintenant, ou `null`. */
export const selectWelcomeMessage = (
  messages: WelcomeMessageRow[],
  email: string | null | undefined,
  dismissals: WelcomeDismissals,
  now = new Date(),
): WelcomeMessageRow | null => {
  const m = messages[0];
  if (!m || !m.is_active) return null;
  const frequency = (m.display_frequency || 'once') as WelcomeFrequency;
  if (frequency === 'once' && dismissals.dismissedIds.includes(m.id)) return null;
  if (frequency === 'daily' && dismissals.daily[m.id] === todayKey(now)) return null;
  if (frequency === 'every_login' && dismissals.shownThisSession.includes(m.id)) return null;
  return audienceMatches(m, email) ? m : null;
};

/** Libellé du bouton selon le profil (mêmes replis que le site). */
export const welcomeButtonLabel = (m: WelcomeMessageRow, email?: string | null): string =>
  email
    ? m.button_text_registered?.trim() || "J'ai compris"
    : m.button_text_guest?.trim() || "S'inscrire/Se connecter";
