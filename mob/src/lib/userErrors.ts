/**
 * Traduction des erreurs techniques en messages destinés aux clients.
 *
 * Règle du produit : **aucun texte de développeur ne doit atteindre l'écran**.
 * Ni message anglais du SDK Stripe ou de Base44, ni identifiant de code
 * (`paymentIntentClientSecret`), ni préfixe interne (`init_failed:`), ni trace
 * technique. Tout ce qui n'est pas une phrase française compréhensible est
 * remplacé par un message générique — le détail brut reste disponible côté
 * serveur (`payment_failure_reason`) et dans les logs de développement.
 *
 * Pour les erreurs d'authentification, voir `@/lib/authErrors` qui couvre les
 * formulations propres à Base44.
 */

import { isDev } from '@/config/env';

/** Message par défaut quand l'erreur n'est pas exploitable par le client. */
export const GENERIC_USER_ERROR = 'Une erreur est survenue. Merci de réessayer dans un instant.';

/** Message par défaut quand un paiement n'a pas abouti. */
export const GENERIC_PAYMENT_ERROR =
  'Le paiement n’a pas pu aboutir. Aucun montant n’a été débité, vous pouvez réessayer.';

interface Rule {
  test: RegExp;
  /** `$1`, `$2`… sont remplacés par les groupes capturés. */
  fr: string;
}

/** Ordre important : les règles les plus spécifiques d'abord. */
const RULES: Rule[] = [
  // — Carte bancaire / Stripe —
  {
    test: /insufficient\s+funds|fonds\s+insuffisants/i,
    fr: 'Fonds insuffisants sur cette carte. Essayez un autre moyen de paiement.',
  },
  {
    test: /card\s+(was\s+)?declined|do_not_honor|do\s+not\s+honou?r|transaction\s+(was\s+)?(declined|refused)/i,
    fr: 'Votre banque a refusé le paiement. Essayez une autre carte ou contactez votre banque.',
  },
  {
    test: /(card|carte).{0,20}(expired|expir)|expiration\s+date\s+is\s+(in)?correct|invalid\s+expiry/i,
    fr: 'La date d’expiration de la carte est incorrecte ou la carte est expirée.',
  },
  {
    test: /security\s+code|cvc|cvv/i,
    fr: 'Le code de sécurité (au dos de la carte) est incorrect.',
  },
  {
    test: /card\s+number\s+is\s+(in)?correct|invalid\s+card\s+number|incomplete\s+card/i,
    fr: 'Le numéro de carte saisi est incorrect.',
  },
  {
    test: /authentication\s+(failed|required)|3d\s*secure/i,
    fr: 'La vérification de votre banque n’a pas abouti. Réessayez et validez la demande envoyée par votre banque.',
  },
  {
    test: /payment\s+(was\s+)?(canceled|cancelled)|paiement\s+annulé/i,
    fr: 'Le paiement a été annulé. Aucun montant n’a été débité.',
  },
  {
    test: /stripe|payment\s*(intent|sheet)|clientsecret/i,
    fr: GENERIC_PAYMENT_ERROR,
  },

  // — Panier / stock / commande —
  {
    test: /out\s+of\s+stock|insufficient\s+stock|not\s+enough\s+stock|stock\s+insuffisant/i,
    fr: 'Un article de votre panier n’est plus disponible en quantité suffisante.',
  },
  {
    test: /(product|item)\s+(not\s+found|unavailable)/i,
    fr: 'Un article de votre panier n’est plus disponible.',
  },
  {
    test: /minimum\s+order|order\s+(total\s+)?(is\s+)?below/i,
    fr: 'Le montant minimum de commande n’est pas atteint.',
  },
  {
    test: /(promo|coupon|discount)\s*(code)?\s*(is\s+)?(invalid|expired|not\s+found)|invalid\s+(promo|coupon)/i,
    fr: 'Ce code promo n’est pas valide ou a expiré.',
  },

  // — Réseau / serveur / quotas —
  {
    test: /network\s+(error|request\s+failed)|failed\s+to\s+fetch|offline|ERR_NETWORK|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i,
    fr: 'Connexion impossible. Vérifiez votre connexion internet, puis réessayez.',
  },
  {
    test: /timeout|timed\s+out|ETIMEDOUT|aborted/i,
    fr: 'Le serveur met trop de temps à répondre. Réessayez dans un instant.',
  },
  {
    test: /too\s+many\s+(requests|attempts)|rate\s*limit|\b429\b/i,
    fr: 'Trop de tentatives. Patientez quelques minutes avant de réessayer.',
  },
  {
    test: /internal\s+server\s+error|service\s+unavailable|bad\s+gateway|gateway\s+timeout|\b50[0-4]\b/i,
    fr: 'Le service rencontre un problème temporaire. Réessayez dans quelques minutes.',
  },
  {
    test: /(unauthorized|not\s+authenticated|token\s+(is\s+)?(expired|invalid)|session\s+expired|\b401\b)/i,
    fr: 'Votre session a expiré. Reconnectez-vous pour continuer.',
  },
  {
    test: /forbidden|permission\s+denied|not\s+allowed|\b403\b/i,
    fr: 'Vous n’avez pas les droits nécessaires pour cette action.',
  },
  {
    test: /not\s+found|\b404\b/i,
    fr: 'Cet élément est introuvable. Il a peut-être été supprimé.',
  },
];

/**
 * Le texte ressemble-t-il à du langage de développeur ?
 *
 * Sert de garde-fou final : même en français, un message contenant un
 * identifiant de code, une trace ou du JSON ne doit pas être montré au client.
 */
export function isTechnicalMessage(msg: string): boolean {
  return (
    /[`{}[\]<>\\|]/.test(msg) ||
    /https?:\/\//i.test(msg) ||
    /\b[a-z][a-z0-9]*_[a-z0-9_]+\b/.test(msg) || // snake_case (init_failed, client_secret…)
    /\b[a-z]+[A-Z][A-Za-z0-9]*\b/.test(msg) || // camelCase (paymentIntentClientSecret…)
    /\b(null|undefined|NaN|true|false)\b/.test(msg) ||
    /\b\w*(Error|Exception)\b\s*:/.test(msg) ||
    /\bat\s+\w+\s*\(/.test(msg) ||
    /\b(status|code)\s*[:=]\s*\d+/i.test(msg)
  );
}

/** Le message est-il déjà rédigé en français lisible ? */
export function looksFrench(msg: string): boolean {
  if (/[àâäçéèêëîïôöûùüÿœ’]/i.test(msg)) return true;
  return /\b(le|la|les|un|une|des|du|votre|vos|nous|est|sont|pas|plus|merci|veuillez|impossible|commande|panier|adresse|compte|paiement|livraison)\b/i.test(
    msg,
  );
}

/** Extrait le message brut d'une erreur (Error, réponse HTTP, chaîne…). */
export function rawUserMessage(error: unknown): string {
  if (typeof error === 'string') return error.trim();

  const e = error as {
    response?: { data?: unknown; status?: number };
    data?: unknown;
    message?: string;
    code?: string;
  };

  const fromPayload = (payload: unknown): string | null => {
    if (typeof payload === 'string') return payload;
    if (payload && typeof payload === 'object') {
      const o = payload as Record<string, unknown>;
      for (const key of ['message', 'error', 'detail', 'error_description'] as const) {
        const v = o[key];
        if (typeof v === 'string' && v) return v;
      }
    }
    return null;
  };

  const raw =
    fromPayload(e?.response?.data) ??
    fromPayload(e?.data) ??
    (typeof e?.message === 'string' ? e.message : null) ??
    (typeof e?.code === 'string' ? e.code : null);

  return (raw ?? '').trim();
}

/**
 * Traduit un message brut en message client.
 *
 * - motif connu → phrase dédiée ;
 * - phrase française sans jargon → conservée telle quelle ;
 * - tout le reste (anglais, identifiants, traces) → `fallback`.
 */
export function translateUserError(
  rawMessage: string | undefined | null,
  fallback: string = GENERIC_USER_ERROR,
): string {
  const msg = (rawMessage ?? '').trim();
  if (!msg) return fallback;

  for (const rule of RULES) {
    const match = msg.match(rule.test);
    if (match) {
      return rule.fr.replace(/\$(\d)/g, (_, i: string) => match[Number(i)] ?? '');
    }
  }

  if (!isTechnicalMessage(msg) && looksFrench(msg)) return msg;

  if (isDev) {
    console.warn('[error] message technique masqué au client :', msg);
  }
  return fallback;
}

/** Message client à afficher pour une erreur quelconque. */
export function userErrorMessage(error: unknown, fallback: string = GENERIC_USER_ERROR): string {
  return translateUserError(rawUserMessage(error), fallback);
}

/*
  Motifs internes stockés sur la commande par l'app (`cancellation_reason`).
  Ils précèdent le message brut du SDK, qu'on ne montre jamais au client.
*/
const REASON_PREFIXES: { prefix: string; fr: string }[] = [
  {
    prefix: 'init_failed',
    fr: 'Le paiement n’a pas pu être lancé. Aucun montant n’a été débité.',
  },
  {
    prefix: 'stripe_error',
    fr: 'Le paiement a été refusé. Aucun montant n’a été débité.',
  },
  {
    prefix: 'payment_failed',
    fr: 'Le paiement n’a pas abouti. Aucun montant n’a été débité.',
  },
];

/**
 * Rend lisible un motif d'annulation / de non-livraison enregistré sur la
 * commande. Les motifs saisis par un humain (admin, livreur, client) sont
 * conservés ; les motifs techniques sont remplacés par leur équivalent client.
 */
export function orderIssueMessage(
  reason: string | null | undefined,
  fallback = 'Cette commande n’a pas pu être finalisée.',
): string {
  const raw = (reason ?? '').trim();
  if (!raw) return fallback;

  const lower = raw.toLowerCase();
  for (const { prefix, fr } of REASON_PREFIXES) {
    if (lower.startsWith(`${prefix}:`) || lower === prefix) return fr;
  }

  const translated = translateUserError(raw, '');
  if (translated) return translated;
  // Motif saisi par l'admin dans base44 (« Client absent ») : affiché tel quel.
  return isTechnicalMessage(raw) ? fallback : raw;
}
