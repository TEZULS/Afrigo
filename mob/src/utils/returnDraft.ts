/**
 * Brouillon de réclamation (2026-10-20).
 *
 * Sur Android, l'appareil photo est une autre application : pendant la prise
 * de vue, le système peut fermer AfriGo pour libérer de la mémoire. Au retour,
 * l'app repartait de zéro et la réclamation en cours « disparaissait »
 * (produits cochés, motif, description, photos) — jamais sur iPhone, où
 * l'appareil photo s'ouvre dans l'app. Le formulaire est donc gardé ici à
 * chaque modification, et écrit sur le disque avant d'ouvrir l'appareil photo.
 */
import { kv } from '@/services/storage';

export const RETURN_DRAFT_KEY = 'return_claim_draft';
/** Brouillon oublié au-delà : motif et photos ne font plus foi. */
export const RETURN_DRAFT_TTL_MS = 60 * 60 * 1000;
/** Réouverture du formulaire au démarrage : appareil photo ouvert il y a moins de 15 min. */
export const CAMERA_RESUME_WINDOW_MS = 15 * 60 * 1000;

export interface ReturnDraftPhoto {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

export interface ReturnDraft {
  orderId: string;
  /** Compte du client, en minuscules : un autre compte ne reprend jamais ce brouillon. */
  email: string;
  /** Index de la ligne de commande → quantité à retourner. */
  selected: Record<string, number>;
  reasonCode: string;
  description: string;
  photos: ReturnDraftPhoto[];
  /** Appareil photo ouvert : Android a pu fermer l'app pendant la prise de vue. */
  cameraOpenedAt?: number;
  savedAt: number;
}

const owner = (email: string | null | undefined) => (email ?? '').trim().toLowerCase();

const isDraft = (d: unknown): d is ReturnDraft =>
  Boolean(d) &&
  typeof d === 'object' &&
  typeof (d as ReturnDraft).orderId === 'string' &&
  typeof (d as ReturnDraft).email === 'string' &&
  typeof (d as ReturnDraft).savedAt === 'number';

export const saveReturnDraft = (draft: Omit<ReturnDraft, 'savedAt'>, now = Date.now()) =>
  kv.set(RETURN_DRAFT_KEY, { ...draft, email: owner(draft.email), savedAt: now });

/** Brouillon de cette commande pour ce compte, s'il est encore valable. */
export const readReturnDraft = (
  orderId: string,
  email: string | null | undefined,
  now = Date.now(),
): ReturnDraft | null => {
  const d = kv.get<ReturnDraft>(RETURN_DRAFT_KEY);
  if (!isDraft(d) || d.orderId !== orderId || !owner(email) || d.email !== owner(email)) return null;
  if (now - d.savedAt > RETURN_DRAFT_TTL_MS) return null;
  return {
    ...d,
    selected: d.selected && typeof d.selected === 'object' ? d.selected : {},
    reasonCode: typeof d.reasonCode === 'string' ? d.reasonCode : '',
    description: typeof d.description === 'string' ? d.description : '',
    photos: Array.isArray(d.photos) ? d.photos.filter((p) => p && typeof p.uri === 'string') : [],
  };
};

/** Retire le brouillon — seulement celui de cette commande si elle est précisée. */
export const clearReturnDraft = (orderId?: string) => {
  const d = kv.get<ReturnDraft>(RETURN_DRAFT_KEY);
  if (d == null) return;
  if (orderId && isDraft(d) && d.orderId !== orderId) return;
  kv.remove(RETURN_DRAFT_KEY);
};

/**
 * Réclamation à rouvrir au démarrage : l'appareil photo venait d'être ouvert
 * depuis le formulaire et l'app a redémarré entre-temps.
 */
export const returnDraftAwaitingCamera = (
  email: string | null | undefined,
  now = Date.now(),
): ReturnDraft | null => {
  const d = kv.get<ReturnDraft>(RETURN_DRAFT_KEY);
  if (!isDraft(d) || !owner(email) || d.email !== owner(email) || !d.cameraOpenedAt) return null;
  return now - d.cameraOpenedAt < CAMERA_RESUME_WINDOW_MS ? d : null;
};
