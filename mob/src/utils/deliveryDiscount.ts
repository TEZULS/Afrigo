/**
 * Réduction sur les frais de livraison configurée par l'admin sur la zone
 * (`DeliveryZone`) — mêmes règles que le checkout du site (bundle publié,
 * relevé le 2026-09-28) :
 *
 * - `delivery_discount_percentage` : réduction de base, en % des frais ;
 * - `discount_valid_from` / `discount_valid_until` : période de validité
 *   (bornes incluses ; vide = sans limite) ;
 * - `discount_for_order_numbers` : numéros de commande du client concernés
 *   (1 = 1re commande, 2 = 2e…) ; liste vide = toutes les commandes ;
 * - `discount_for_new_customers` : 1re commande uniquement ;
 * - `tier_discounts[niveau]` : bonus ajouté selon le niveau du client.
 * Le total est plafonné à 100 % (livraison offerte).
 *
 * Le numéro de commande = commandes non annulées du client + 1 (comme le site).
 */

export interface ZoneDeliveryDiscount {
  delivery_discount_percentage?: number | null;
  discount_valid_from?: string | null;
  discount_valid_until?: string | null;
  discount_for_order_numbers?: number[] | null;
  discount_for_new_customers?: boolean | null;
  tier_discounts?: Record<string, number> | null;
}

interface DiscountContext {
  /** Numéro de la commande en cours pour ce client (1 = première). */
  orderNumber: number;
  /** Niveau du client (`normal`, `argent`, `or`, `diamant`). */
  tier?: string | null;
  /** Jour de la commande, `YYYY-MM-DD`. */
  today: string;
}

const day = (value?: string | null): string => (value ?? '').trim().slice(0, 10);

/** Réduction applicable (0 à 100 %) sur les frais de livraison de la zone. */
export const deliveryDiscountPercent = (
  zone: ZoneDeliveryDiscount | null | undefined,
  { orderNumber, tier, today }: DiscountContext,
): number => {
  if (!zone) return 0;

  const from = day(zone.discount_valid_from);
  const until = day(zone.discount_valid_until);
  if ((from && from > today) || (until && until < today)) return 0;

  // Liste absente ou vide : toutes les commandes (le site exige une liste, toujours enregistrée).
  const orderNumbers = (zone.discount_for_order_numbers ?? []).map(Number);
  if (orderNumbers.length > 0 && !orderNumbers.includes(orderNumber)) return 0;
  if (zone.discount_for_new_customers && orderNumber > 1) return 0;

  const base = Number(zone.delivery_discount_percentage) || 0;
  const tierBonus = Number(zone.tier_discounts?.[tier || 'normal']) || 0;
  return Math.max(0, Math.min(100, base + tierBonus));
};

/** Réduction qui dépend du rang de la commande (il faut connaître l'historique du client). */
export const discountDependsOnOrderNumber = (zone: ZoneDeliveryDiscount | null | undefined): boolean =>
  Boolean(zone?.discount_for_new_customers) || (zone?.discount_for_order_numbers ?? []).length > 0;

/** Frais après réduction, au centime. */
export const discountedDeliveryFee = (fee: number, percent: number): number =>
  Math.round(Math.max(0, fee) * (1 - Math.max(0, Math.min(100, percent)) / 100) * 100) / 100;
