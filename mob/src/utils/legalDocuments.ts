/**
 * Documents légaux de base44 : `InternalRegulations` (règlement intérieur,
 * Markdown) et `PrivacyPolicy` (politique de confidentialité, texte brut).
 *
 * Règles d'acceptation reprises du site afrigo.app (relevées dans le bundle
 * déployé le 2026-09-18) :
 * - règlement : le document **actif** de version la plus haute ; l'acceptation
 *   est locale à l'appareil, par compte (`email` ou `guest`), et doit
 *   correspondre à la fois à la version et à l'identifiant du document ;
 * - politique : le document actif ; pour un client connecté l'acceptation
 *   vit sur le profil (`privacy_policy_accepted_version`), pour un invité en
 *   local. Une nouvelle version redemande l'accord.
 */

import { serverDateMs } from './serverDate';

export interface RegulationsDoc {
  id: string;
  title?: string;
  content?: string;
  version?: number | string;
  is_active?: boolean;
  effective_date?: string;
  updated_date?: string;
  created_date?: string;
}

export interface PrivacyPolicyDoc {
  id: string;
  content?: string;
  version?: number | string;
  is_active?: boolean;
  updated_date?: string;
  created_date?: string;
}

export interface RegulationsAcceptance {
  regulationId: string;
  regulationVersion: number | string;
  acceptedAt: string;
}

export interface PrivacyAcceptance {
  version: number | string;
  acceptedAt: string;
}

const versionNumber = (v: number | string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const newest = <T extends { updated_date?: string; created_date?: string }>(a: T, b: T) =>
  serverDateMs(b.updated_date ?? b.created_date) - serverDateMs(a.updated_date ?? a.created_date);

/** Règlement à faire accepter : le plus haut numéro de version parmi les actifs. */
export const activeRegulations = (docs: RegulationsDoc[]): RegulationsDoc | null =>
  [...docs]
    .filter((d) => d.is_active === true)
    .sort((a, b) => versionNumber(b.version) - versionNumber(a.version) || newest(a, b))[0] ?? null;

/** Politique à faire accepter : la première active (comme le site). */
export const activePrivacyPolicy = (docs: PrivacyPolicyDoc[]): PrivacyPolicyDoc | null =>
  [...docs].filter((d) => d.is_active === true).sort(newest)[0] ?? null;

/**
 * Document à faire accepter et à afficher dans « Paramètres › Règlement et
 * confidentialité » : l'actif s'il existe, sinon le plus récent.
 *
 * Le repli sur le plus récent est volontaire : les textes publiés dans base44
 * restent souvent `is_active: false`, et l'accord doit malgré tout être demandé
 * à tout le monde au lancement (demande du 2026-09-19).
 */
export const displayableRegulations = (docs: RegulationsDoc[]): RegulationsDoc | null =>
  activeRegulations(docs) ?? [...docs].sort(newest)[0] ?? null;

export const displayablePrivacyPolicy = (docs: PrivacyPolicyDoc[]): PrivacyPolicyDoc | null =>
  activePrivacyPolicy(docs) ?? [...docs].sort(newest)[0] ?? null;

/**
 * Accord donné **une seule fois par appareil**, avant toute connexion ou
 * inscription (demande du 2026-09-28) : se connecter ou créer son compte
 * ensuite ne le redemande pas. Seule une nouvelle version le redemande.
 */
export const REGULATIONS_ACCEPTANCE_KEY = 'legal_regulations_accepted';
export const PRIVACY_ACCEPTANCE_KEY = 'legal_privacy_accepted';

/**
 * Anciennes clés, par compte (`guest` hors connexion, sinon l'e-mail) : encore
 * lues pour ne pas redemander un accord déjà donné avec une version précédente
 * de l'app.
 */
export const legacyAcceptanceKeys = (base: string, email?: string | null): string[] =>
  ['guest', email?.trim().toLowerCase()].filter(Boolean).map((who) => `${base}:${who}`);

export const regulationsAccepted = (
  doc: RegulationsDoc | null,
  acceptance: RegulationsAcceptance | null | undefined,
): boolean => {
  if (!doc) return true;
  if (!acceptance) return false;
  return (
    acceptance.regulationId === doc.id &&
    String(acceptance.regulationVersion) === String(doc.version ?? '')
  );
};

/**
 * Politique acceptée ? Pour un client connecté, la version portée par le
 * profil fait foi ; à défaut, l'acceptation locale (invité, ou profil pas
 * encore rechargé après l'accord).
 */
export const privacyAccepted = (
  doc: PrivacyPolicyDoc | null,
  profileVersion: number | string | null | undefined,
  local: PrivacyAcceptance | null | undefined,
): boolean => {
  if (!doc) return true;
  const target = String(doc.version ?? '');
  if (profileVersion != null && String(profileVersion) === target) return true;
  return local != null && String(local.version) === target;
};

// --- Rendu du contenu -------------------------------------------------------

export type LegalBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'rule' };

/** Segment de texte avec sa graisse (`**gras**`). */
export interface LegalSpan {
  text: string;
  bold: boolean;
}

/** Ligne de date de mise à jour en tête des textes : masquée à l'affichage (demande du 2026-09-28). */
const UPDATED_ON_LINE = /^derni[èe]re\s+mise\s+à\s+jour\b/i;

/**
 * Titre écrit en capitales dans un texte brut (« POLITIQUE DE
 * CONFIDENTIALITÉ », « 1. COLLECTE DES DONNÉES ») : aucune minuscule, au
 * moins trois lettres, ligne courte. Sans expression régulière Unicode.
 */
const isUppercaseHeading = (line: string): boolean => {
  if (line.length > 90 || line !== line.toUpperCase()) return false;
  const letters = [...line].filter((ch) => ch.toLowerCase() !== ch.toUpperCase()).length;
  return letters >= 3;
};

const decodeEntities = (s: string): string =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/** Retire les balises HTML éventuelles (le champ est « HTML/Markdown »). */
const stripHtml = (s: string): string =>
  decodeEntities(
    s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  );

/**
 * Découpe un contenu Markdown simple (titres `#`, listes `-`/`*`, règles
 * `---`, gras `**…**`) en blocs prêts à afficher. Les lignes consécutives d'un
 * même paragraphe sont jointes par des espaces.
 */
export const parseLegalContent = (raw: string | null | undefined): LegalBlock[] => {
  const lines = stripHtml(String(raw ?? '')).replace(/\r\n/g, '\n').split('\n');
  const blocks: LegalBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flush();
      continue;
    }
    if (UPDATED_ON_LINE.test(line)) continue;
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({
        type: 'heading',
        level: heading[1]!.length as 1 | 2 | 3,
        text: heading[2]!.trim(),
      });
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      flush();
      blocks.push({ type: 'rule' });
      continue;
    }
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      blocks.push({ type: 'bullet', text: bullet[1]!.trim() });
      continue;
    }
    if (isUppercaseHeading(line)) {
      flush();
      blocks.push({ type: 'heading', level: /^\d/.test(line) ? 3 : 2, text: line });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return blocks;
};

/** Découpe `**gras**` en segments ; les autres marqueurs (`*`, `_`) sont ignorés. */
export const splitBold = (text: string): LegalSpan[] => {
  const spans: LegalSpan[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index), bold: false });
    spans.push({ text: m[1]!, bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last), bold: false });
  return spans.length ? spans : [{ text, bold: false }];
};
