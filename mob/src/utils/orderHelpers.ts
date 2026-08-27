/**
 * Règles métier sur les commandes partagées entre écrans (liste, détail).
 */

import { hoursSince } from './serverDate';

export interface RefundableOrder {
  status?: string;
  payment_method?: 'card' | 'delivery' | string;
  payment_status?: string;
  wallet_amount_used?: number;
  amount_to_pay?: number;
  delivered_date?: string;
  updated_date?: string;
}

/** Fenêtre pendant laquelle un client peut demander un remboursement après annulation. */
export const REFUND_WINDOW_HOURS = 24;

export { hoursSince };

/** Fenêtre par défaut pour demander un retour après livraison (surchargée par `AppSettings.return_time_limit_hours`). */
export const DEFAULT_RETURN_WINDOW_HOURS = 2;

/**
 * Bouton « Demander un retour » : commande livrée, moins de `windowHours`
 * après la livraison effective (`delivered_date`, sinon `updated_date`), et
 * pas de demande déjà déposée. Disparaît de lui-même une fois le délai passé.
 */
export const canRequestReturn = (
  o: RefundableOrder,
  opts: { alreadyRequested?: boolean; windowHours?: number } = {},
): boolean => {
  if (o.status !== 'delivered' || opts.alreadyRequested) return false;
  const ref = o.delivered_date ?? o.updated_date;
  if (!ref) return false;
  const window = opts.windowHours ?? DEFAULT_RETURN_WINDOW_HOURS;
  return hoursSince(ref) <= window;
};

/**
 * Le paiement de la commande a échoué ou a été abandonné : aucun montant n'a
 * été prélevé (ni carte, ni portefeuille — celui-ci n'est débité qu'après
 * acceptation Stripe).
 */
export const paymentFailed = (o: RefundableOrder): boolean =>
  o.payment_status === 'failed' || o.payment_status === 'abandoned';

/** Commande intégralement réglée avec le portefeuille (rien à encaisser). */
export const paidByWalletOnly = (o: RefundableOrder): boolean =>
  (o.wallet_amount_used ?? 0) > 0 && (o.amount_to_pay ?? 1) === 0;

/**
 * Un montant a réellement été prélevé au client : paiement carte (abouti) ou
 * portefeuille débité. Le paiement à la livraison seul n'engage rien.
 */
export const hasChargedAmount = (o: RefundableOrder): boolean => {
  if (paymentFailed(o)) return false;
  return o.payment_method === 'card' || (o.wallet_amount_used ?? 0) > 0;
};

/**
 * Éligibilité au bouton « Demande de remboursement » :
 * commande annulée, montant prélevé, paiement non échoué, moins de 24 h
 * après l'annulation, et pas de demande déjà déposée.
 */
export const canRequestRefund = (o: RefundableOrder, alreadyRequested = false): boolean => {
  if (o.status !== 'cancelled' || alreadyRequested) return false;
  if (!hasChargedAmount(o)) return false;
  const ref = o.updated_date ?? o.delivered_date;
  return hoursSince(ref) <= REFUND_WINDOW_HOURS;
};
