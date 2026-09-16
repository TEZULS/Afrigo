/**
 * Demandes de retour (`Return`) — vocabulaire partagé par le formulaire, la
 * liste « Mes retours » et le détail d'une demande.
 *
 * Schéma base44 (vérifié le 2026-09-17 via `entity-schemas/Return`) :
 * - `reason` : `wrong_product` | `expired`
 * - `resolution_type` : `exchange` (le produit est remplacé) | `refund`
 *   (crédit **sur le portefeuille** uniquement)
 * - `status` : `pending` → `approved` → `completed`, ou `rejected`
 * - `photos` : prises en direct, minimum 2
 * - `description` obligatoire, `admin_message` / `rejection_reason` renseignés
 *   par l'admin.
 */

export type ReturnReason = 'wrong_product' | 'expired';
export type ReturnResolution = 'exchange' | 'refund';
export type ReturnStatus = 'pending' | 'approved' | 'completed' | 'rejected';

export const RETURN_REASONS: { value: ReturnReason; label: string }[] = [
  { value: 'wrong_product', label: 'Mauvais produit' },
  { value: 'expired', label: 'Date expirée' },
];

export const RETURN_RESOLUTIONS: { value: ReturnResolution; label: string; hint: string }[] = [
  { value: 'exchange', label: 'Changer le produit', hint: 'Le livreur reprend le produit et le remplace.' },
  {
    value: 'refund',
    label: 'Remboursement',
    hint: 'Le montant est crédité sur votre portefeuille AfriGo.',
  },
];

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

export const returnStatusLabel = (status?: string | null): string =>
  RETURN_STATUS_LABELS[status ?? 'pending'] ?? RETURN_STATUS_LABELS.pending;

export const returnReasonLabel = (reason?: string | null): string =>
  RETURN_REASONS.find((r) => r.value === reason)?.label ?? (reason || '—');

export const returnResolutionLabel = (resolution?: string | null): string => {
  if (resolution === 'exchange') return 'Échange du produit';
  if (resolution === 'refund') return 'Remboursement sur le portefeuille';
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
