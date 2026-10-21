/**
 * Livraisons manquées signalées par le livreur (`Order.missed_deliveries` :
 * motif + date, fonction base44 `reportMissedDelivery`). La commande reste en
 * cours de livraison : ces signalements ne la clôturent pas. Mêmes libellés
 * que le site (`src/lib/missedDeliveries.js`).
 */

export interface MissedDelivery {
  /** Motif communiqué au client. */
  reason?: string;
  /** Date et heure du signalement. */
  date?: string;
}

export const missedDeliveriesOf = (order?: { missed_deliveries?: unknown } | null): MissedDelivery[] =>
  Array.isArray(order?.missed_deliveries)
    ? (order.missed_deliveries as unknown[]).filter(
        (m): m is MissedDelivery => Boolean(m) && typeof m === 'object',
      )
    : [];

/** « 1ère livraison manquée », « 2ème livraison manquée »… */
export const missedDeliveryLabel = (index: number): string =>
  index === 0 ? '1ère livraison manquée' : `${index + 1}ème livraison manquée`;
