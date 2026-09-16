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

/**
 * Fenêtre pour demander un retour : **1 h** après la confirmation de livraison
 * (règle métier AfriGo, 2026-09). Fixe côté mobile — `AppSettings.
 * return_time_limit_hours` (3 h en production) n'est plus consulté.
 */
export const RETURN_WINDOW_HOURS = 1;

export interface ReturnRequestRow {
  order_id?: string;
  status?: string;
}

/**
 * Statuts d'une demande de retour qui ferment la commande à toute nouvelle
 * demande. Le client peut en déposer plusieurs (une refusée, une en
 * attente…) tant qu'aucune n'a été approuvée ou terminée.
 */
export const RETURN_LOCKING_STATUSES: readonly string[] = ['approved', 'completed'];

/** Une demande approuvée ou terminée existe-t-elle déjà pour cette commande ? */
export const hasLockingReturn = (
  returns: ReturnRequestRow[] | undefined,
  orderId: string,
): boolean =>
  (returns ?? []).some(
    (r) => r.order_id === orderId && RETURN_LOCKING_STATUSES.includes(r.status ?? ''),
  );

/**
 * Bouton « Demander un retour » : commande livrée, moins de `windowHours`
 * (1 h) après la livraison effective (`delivered_date`, sinon `updated_date`),
 * et aucune demande déjà approuvée ou terminée (`locked`). Le bouton reste
 * affiché tant qu'une demande n'est qu'en attente ou refusée, et disparaît de
 * lui-même une fois le délai passé.
 */
export const canRequestReturn = (
  o: RefundableOrder,
  opts: { locked?: boolean; windowHours?: number } = {},
): boolean => {
  if (o.status !== 'delivered' || opts.locked) return false;
  const ref = o.delivered_date ?? o.updated_date;
  if (!ref) return false;
  const window = opts.windowHours ?? RETURN_WINDOW_HOURS;
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

/**
 * La commande a été réglée : paiement carte abouti, portefeuille ayant tout
 * couvert, ou paiement à la livraison d'une commande livrée. Une commande
 * dont le paiement a échoué, est abandonné ou encore en attente n'a pas de
 * facture à proposer.
 */
export const isOrderPaid = (o: RefundableOrder): boolean => {
  if (paymentFailed(o)) return false;
  if (o.payment_status === 'completed') return true;
  if (paidByWalletOnly(o)) return true;
  if (o.payment_method === 'delivery') return o.status === 'delivered';
  return false;
};
