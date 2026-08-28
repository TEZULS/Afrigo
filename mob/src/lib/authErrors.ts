/**
 * Messages d'erreur d'authentification en français.
 *
 * Base44 renvoie ses erreurs en anglais (« Invalid email or password »,
 * « Password must be at least 8 characters long »…). On les traduit ici plutôt
 * que de les afficher telles quelles : c'est la seule source de texte anglais
 * visible par l'utilisateur dans l'app.
 */

import { isDev } from '@/config/env';

/** Message affiché quand le serveur renvoie une erreur qu'on ne connaît pas. */
export const GENERIC_AUTH_ERROR = 'Une erreur est survenue. Merci de réessayer.';

interface Rule {
  test: RegExp;
  /** `$1`, `$2`… sont remplacés par les groupes capturés (ex : longueur mini). */
  fr: string;
}

/** Ordre important : les règles les plus spécifiques d'abord. */
const RULES: Rule[] = [
  // — Mot de passe —
  {
    test: /password\s+must\s+be\s+at\s+least\s+(\d+)\s+characters?/i,
    fr: 'Le mot de passe doit contenir au moins $1 caractères.',
  },
  {
    test: /password\s+(is\s+)?too\s+(short|weak)/i,
    fr: 'Mot de passe trop faible : utilisez au moins 8 caractères, avec chiffres et lettres.',
  },
  {
    test: /passwords?\s+do\s+not\s+match|passwords?\s+don'?t\s+match/i,
    fr: 'Les mots de passe ne correspondent pas.',
  },
  {
    test: /(current|old)\s+password\s+is\s+(in)?correct|wrong\s+password/i,
    fr: 'Mot de passe actuel incorrect.',
  },

  // — Identifiants —
  {
    test: /invalid\s+(email\s+or\s+password|credentials|login)|incorrect\s+(email|password)/i,
    fr: 'Email ou mot de passe incorrect.',
  },
  {
    test: /user\s+(with\s+this\s+email\s+)?(already\s+exists|is\s+already\s+registered)|email\s+(is\s+)?already\s+(registered|in\s+use|taken)|already\s+exists/i,
    fr: 'Un compte existe déjà avec cet email.',
  },
  {
    test: /user\s+(is\s+)?not\s+(found|registered)|no\s+such\s+user|account\s+not\s+found/i,
    fr: 'Aucun compte n’est associé à cet email.',
  },
  {
    test: /invalid\s+email(\s+address)?|email\s+is\s+not\s+valid/i,
    fr: 'Adresse email invalide.',
  },
  {
    test: /(user|account)\s+(is\s+)?(disabled|deactivated|blocked|suspended)/i,
    fr: 'Ce compte a été désactivé. Contactez le support AfriGo.',
  },

  // — Vérification email / code OTP —
  // « Invalid or expired » d'abord : plus précis que la règle « expired » seule.
  {
    test: /invalid\s+(or\s+expired\s+)?(otp|code|verification\s+code)|(otp|code)\s+is\s+(invalid|incorrect)|wrong\s+code/i,
    fr: 'Code de vérification incorrect ou expiré. Vérifiez les 6 chiffres reçus par email, ou demandez un nouveau code.',
  },
  {
    test: /(otp|code|verification\s+code)\s+(has\s+)?expired|expired\s+(otp|code)/i,
    fr: 'Le code de vérification a expiré. Demandez-en un nouveau.',
  },
  {
    test: /verify\s+your\s+email|email\s+(is\s+)?not\s+verified|email\s+before\s+logging|unverified\s+email/i,
    fr: 'Votre email n’est pas encore vérifié. Saisissez le code reçu par email.',
  },
  /*
    Filet de sécurité : toute autre formulation anglaise mentionnant l'OTP
    (« OTP verification failed », « incorrect otp »…) donne un message utile
    plutôt que l'erreur générique. À garder après les règles précises ci-dessus.
  */
  {
    test: /\botp\b|verification\s+code/i,
    fr: 'Code de vérification incorrect ou expiré. Demandez un nouveau code si besoin.',
  },

  // — Quotas / réseau / serveur —
  {
    test: /too\s+many\s+(requests|attempts)|rate\s*limit/i,
    fr: 'Trop de tentatives. Patientez quelques minutes avant de réessayer.',
  },
  {
    test: /network\s+error|failed\s+to\s+fetch|timeout|timed\s+out|ECONNREFUSED|ENOTFOUND/i,
    fr: 'Connexion au serveur impossible. Vérifiez votre connexion internet.',
  },
  {
    test: /registration\s+(is\s+)?(disabled|closed|not\s+allowed)|sign\s*ups?\s+(are\s+)?disabled/i,
    fr: 'Les inscriptions sont momentanément fermées. Réessayez plus tard.',
  },
  {
    test: /(unauthorized|not\s+authenticated|token\s+(is\s+)?(expired|invalid)|session\s+expired)/i,
    fr: 'Votre session a expiré. Reconnectez-vous.',
  },
  {
    test: /forbidden|permission\s+denied|not\s+allowed/i,
    fr: 'Vous n’avez pas les droits nécessaires pour cette action.',
  },
  {
    test: /internal\s+server\s+error|service\s+unavailable|bad\s+gateway/i,
    fr: 'Le serveur rencontre un problème. Réessayez dans un instant.',
  },
];

/** Le message est-il déjà rédigé en français ? (nos propres messages). */
function looksFrench(msg: string): boolean {
  if (/[àâäçéèêëîïôöûùüÿœ]/i.test(msg)) return true;
  return /\b(le|la|les|un|une|des|votre|vos|mot de passe|email invalide|compte|adresse|veuillez|réessayer)\b/i.test(
    msg,
  );
}

/**
 * Traduit un message d'erreur backend en français.
 *
 * - message connu → traduction dédiée ;
 * - message déjà en français (validation locale) → inchangé ;
 * - message inconnu (donc en anglais) → message générique français, le texte
 *   d'origine étant seulement journalisé en développement.
 */
export function translateAuthError(rawMessage: string | undefined | null): string {
  const msg = (rawMessage ?? '').trim();
  if (!msg) return GENERIC_AUTH_ERROR;

  for (const rule of RULES) {
    const match = msg.match(rule.test);
    if (match) {
      return rule.fr.replace(/\$(\d)/g, (_, i: string) => match[Number(i)] ?? '');
    }
  }

  if (looksFrench(msg)) return msg;

  if (isDev) {
    console.warn('[auth] message serveur non traduit :', msg);
  }
  return GENERIC_AUTH_ERROR;
}

/** Extrait un message lisible d'une erreur Base44 / fetch, puis le traduit. */
export function authErrorMessage(error: unknown): string {
  const e = error as {
    response?: { data?: unknown };
    data?: unknown;
    message?: string;
  };

  const fromPayload = (payload: unknown): string | null => {
    if (typeof payload === 'string') return payload;
    if (payload && typeof payload === 'object') {
      const o = payload as Record<string, unknown>;
      for (const key of ['message', 'error', 'detail', 'error_description'] as const) {
        if (typeof o[key] === 'string' && o[key]) return o[key] as string;
      }
    }
    return null;
  };

  const raw = fromPayload(e?.response?.data) ?? fromPayload(e?.data) ?? e?.message ?? null;
  return translateAuthError(raw);
}

/** Le compte existe déjà (inscription refusée par le serveur). */
export function isEmailAlreadyRegistered(error: unknown): boolean {
  const m = rawMessageOf(error).toLowerCase();
  return (
    m.includes('already exists') ||
    m.includes('already registered') ||
    m.includes('already in use') ||
    m.includes('already taken') ||
    m.includes('déjà utilisé') ||
    m.includes('existe déjà')
  );
}

/** Le compte existe mais l'email n'a pas encore été validé. */
export function isEmailVerificationRequired(error: unknown): boolean {
  const m = rawMessageOf(error).toLowerCase();
  return (
    m.includes('verify your email') ||
    m.includes('email before logging') ||
    m.includes('not verified') ||
    m.includes('unverified') ||
    m.includes('email non vérifié')
  );
}

/**
 * Identifiants refusés.
 *
 * Base44 renvoie ce même message quand le mot de passe est faux **et** quand
 * le compte existe mais que l'email n'a jamais été vérifié : l'écran propose
 * donc aussi de saisir le code de vérification dans ce cas.
 */
export function isInvalidCredentials(error: unknown): boolean {
  const m = rawMessageOf(error).toLowerCase();
  return (
    m.includes('invalid email or password') ||
    m.includes('invalid credentials') ||
    m.includes('incorrect email') ||
    m.includes('incorrect password')
  );
}

/** Message brut (non traduit) d'une erreur, pour les tests de contenu. */
export function rawMessageOf(error: unknown): string {
  const e = error as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message ?? e?.message ?? '';
}
