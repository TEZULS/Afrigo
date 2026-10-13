/**
 * Demandes de retour (`Return`) — vocabulaire partagé par le formulaire, la
 * liste « Mes retours » et le détail d'une demande.
 *
 * Schéma base44 (vérifié le 2026-09-17 via `entity-schemas/Return`) :
 * - `reason` : `wrong_product` | `expired`. « Produit abîmé » n'est plus
 *   proposé (2026-10-13) ; les anciennes demandes ainsi marquées (mention
 *   {@link DAMAGED_MARKER} en tête de description) restent lisibles.
 * - `resolution_type`, choisi par l'admin : `exchange` (le produit est
 *   remplacé) | `refund` (le livreur reprend le produit, crédit sur le
 *   portefeuille) | `refund_keep` (le client garde le produit et est
 *   remboursé sur son portefeuille).
 * - `status` : `pending` → `approved` → `completed`, ou `rejected`
 * - `photos` : prises en direct, minimum 2
 * - `description` obligatoire, `admin_message` / `rejection_reason` renseignés
 *   par l'admin.
 */

export type ReturnReason = 'wrong_product' | 'expired';
export type ReturnResolution = 'exchange' | 'refund' | 'refund_keep';
export type ReturnStatus = 'pending' | 'approved' | 'completed' | 'rejected';

export const RETURN_REASONS: { value: ReturnReason; label: string }[] = [
  { value: 'wrong_product', label: 'Mauvais produit' },
  { value: 'expired', label: 'Date expirée' },
];

/**
 * Mention des anciennes demandes « Produit abîmé » (enregistrées en
 * `wrong_product`, mention en tête de description) : toujours affichée.
 */
export const DAMAGED_MARKER = 'Produit abîmé';

export const RETURN_RESOLUTIONS: { value: ReturnResolution; label: string; hint: string }[] = [
  { value: 'exchange', label: 'Changer le produit', hint: 'Le livreur reprend le produit et le remplace.' },
  {
    value: 'refund',
    label: 'Remboursement',
    hint: 'Le montant est crédité sur votre portefeuille AfriGo.',
  },
  {
    value: 'refund_keep',
    label: 'Garder le produit + remboursement',
    hint: 'Vous gardez le produit et le montant est crédité sur votre portefeuille AfriGo.',
  },
];

/** Résolution avec remboursement sur le portefeuille (produit repris ou gardé). */
export const isRefundResolution = (resolution?: string | null): boolean =>
  resolution === 'refund' || resolution === 'refund_keep';

/** Nombre minimum de photos prises en direct pour déposer une demande. */
export const MIN_RETURN_PHOTOS = 2;

/** Les trois étapes du suivi, dans l'ordre (mêmes libellés que le web). */
export const RETURN_STEPS: { key: Exclude<ReturnStatus, 'rejected'>; label: string }[] = [
  { key: 'pending', label: 'En attente' },
  { key: 'approved', label: 'Approuvé' },
  { key: 'completed', label: 'Terminé' },
];

export const RETURN_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvé',
  completed: 'Terminé',
  rejected: 'Refusé',
};

/** Phrase d'explication sous le statut (même ton que « Mes remboursements »). */
export const RETURN_STATUS_DESCRIPTIONS: Record<string, string> = {
  pending: 'Votre demande est en cours d’examen par notre équipe.',
  approved: 'Demande acceptée : le livreur passera récupérer le produit.',
  completed: 'Retour terminé. Le remboursement, le cas échéant, a été crédité sur votre portefeuille.',
  rejected: 'Votre demande de retour a été refusée.',
};

/** Phrase sous le statut, adaptée à la résolution choisie par l'admin. */
export const returnStatusDescription = (
  status?: string | null,
  resolution?: string | null,
): string => {
  if (status === 'approved' && resolution === 'refund_keep') {
    return 'Demande acceptée : vous gardez le produit, le remboursement sera crédité sur votre portefeuille.';
  }
  return RETURN_STATUS_DESCRIPTIONS[status ?? 'pending'] ?? RETURN_STATUS_DESCRIPTIONS.pending;
};

export const returnStatusLabel = (status?: string | null): string =>
  RETURN_STATUS_LABELS[status ?? 'pending'] ?? RETURN_STATUS_LABELS.pending;

export const returnReasonLabel = (reason?: string | null, description?: string | null): string => {
  if (reason === 'wrong_product' && description?.startsWith(`${DAMAGED_MARKER} —`)) {
    return DAMAGED_MARKER;
  }
  return RETURN_REASONS.find((r) => r.value === reason)?.label ?? (reason || '—');
};

export const returnResolutionLabel = (resolution?: string | null): string => {
  if (resolution === 'exchange') return 'Échange du produit';
  if (resolution === 'refund') return 'Remboursement sur le portefeuille';
  if (resolution === 'refund_keep') return 'Garder le produit + remboursement';
  return '—';
};

/**
 * Index de l'étape atteinte dans `RETURN_STEPS` ; `-1` pour une demande
 * refusée (le suivi laisse alors place à l'encart « Demande refusée »).
 */
export const returnStepIndex = (status?: string | null): number => {
  if (status === 'rejected') return -1;
  const idx = RETURN_STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
};
