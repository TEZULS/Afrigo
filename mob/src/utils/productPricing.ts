/**
 * Prix produit : TTC, HT, TVA et stock faible — règles alignées sur le web
 * déployé (`https://afri-go-6fad2204.base44.app`, vérifié le 2026-09-14).
 *
 * Depuis que l'admin saisit un **prix HT + taux de TVA**, base44 porte deux
 * champs : `price` (HT) et `price_ttc` (= `price × (1 + vat_rate/100)`,
 * arrondi à 2 décimales). Les produits plus anciens n'ont que `price`, qui
 * vaut alors le prix client. Le prix affiché et facturé est donc toujours
 * `price_ttc ?? price` — utiliser `price` seul facturait le Crabe Madagascar
 * 13,99 € au lieu de 15,39 €.
 */

import { unitLabel } from './units';

export interface PricedProduct {
  price: number;
  /** Prix TTC calculé par l'admin (absent sur les produits sans TVA saisie). */
  price_ttc?: number | null;
  /** Taux de TVA en % (0 = exonéré). Absent = TVA jamais renseignée. */
  vat_rate?: number | null;
  promotion_price?: number | null;
  is_promotion?: boolean;
}

/** Prix catalogue TTC, hors promotion. */
export const catalogPrice = (p: PricedProduct): number => {
  const ttc = p.price_ttc != null ? Number(p.price_ttc) : NaN;
  if (Number.isFinite(ttc) && ttc > 0) return ttc;
  return Number(p.price ?? 0) || 0;
};

/** Promotion produit active (prix promo renseigné + flag). */
export const hasPromotion = (p: PricedProduct): boolean =>
  Boolean(p.is_promotion && p.promotion_price != null && Number(p.promotion_price) > 0);

/** Prix de vente TTC : promotion si active, sinon prix catalogue. */
export const sellingPrice = (p: PricedProduct): number =>
  hasPromotion(p) ? Number(p.promotion_price) : catalogPrice(p);

/** Pourcentage de remise affiché sur la pastille promo (0 si pas de promo). */
export const promotionDiscountPercent = (p: PricedProduct): number => {
  if (!hasPromotion(p)) return 0;
  const base = catalogPrice(p);
  if (base <= 0) return 0;
  return Math.max(0, Math.round((1 - Number(p.promotion_price) / base) * 100));
};

export interface VatBreakdown {
  /** Taux de TVA appliqué (%). */
  rate: number;
  /** Part hors taxe du prix TTC. */
  ht: number;
  /** Montant de TVA inclus dans le prix TTC. */
  vat: number;
}

/**
 * Décomposition HT / TVA d'un prix TTC (mêmes formules que la fiche produit
 * web : `HT = TTC / (1 + taux/100)`, `TVA = TTC − HT`). Renvoie `null` quand
 * la TVA n'a jamais été renseignée sur le produit : on n'affiche pas une ligne
 * « TVA 0 % » inventée.
 */
export const vatBreakdown = (priceTtc: number, vatRate?: number | null): VatBreakdown | null => {
  if (vatRate == null || !Number.isFinite(Number(vatRate))) return null;
  const rate = Math.max(0, Number(vatRate));
  const ttc = Number(priceTtc) || 0;
  const ht = rate > 0 ? ttc / (1 + rate / 100) : ttc;
  return { rate, ht, vat: ttc - ht };
};

/** Décimales en petit à côté de l'entier : `15.39` → `{ int: '15', dec: '39' }`. */
export const splitPrice = (value: number): { int: string; dec: string } => {
  const n = Number(value) || 0;
  const fixed = Math.abs(n).toFixed(2);
  const [int = '0', dec = '00'] = fixed.split('.');
  return { int: n < 0 ? `-${int}` : int, dec };
};

/** Seuil (inclus) en dessous duquel on alerte « Plus que N … ». */
export const LOW_STOCK_THRESHOLD = 3;

const pluralizeUnit = (label: string, n: number): string => {
  if (n <= 1) return label;
  // Abréviations (kg, g, L, ml…) et unités déjà plurielles restent telles quelles.
  if (label.length <= 2 || /[sx]$/i.test(label)) return label;
  return `${label}s`;
};

/**
 * Libellé de stock faible : « Plus que 3 sachets » / « Plus que 1 produit ».
 * `null` quand le stock est nul (géré par « Épuisé ») ou suffisant.
 */
export const lowStockLabel = (stock?: number | null, unit?: string | null): string | null => {
  const n = Math.floor(Number(stock) || 0);
  if (n <= 0 || n > LOW_STOCK_THRESHOLD) return null;
  const label = unitLabel(unit) || 'produit';
  return `Plus que ${n} ${pluralizeUnit(label, n)}`;
};
