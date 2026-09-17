/**
 * Décomposition HT / TVA / TTC d'un ensemble de lignes (panier, récapitulatif
 * de commande, facture).
 *
 * Les prix manipulés par l'app sont **TTC** (`price_ttc`, `unit_price`), avec
 * le taux de TVA du produit à part (`Product.vat_rate`, recopié dans
 * `Order.items[].vat_rate`). Le HT se retrouve donc par
 * `HT = TTC / (1 + taux/100)` — même formule que la fiche produit web.
 * Un taux absent (produits anciens, jamais renseigné par l'admin) vaut 0 % :
 * le prix saisi est alors le prix client, sans TVA distincte.
 */

import { round2 } from './checkoutMath';

export interface VatLine {
  /** Prix unitaire TTC. */
  unitPrice: number;
  quantity: number;
  /** Taux de TVA en % ; `null`/`undefined` = 0 %. */
  vatRate?: number | null;
}

export interface VatRateTotal {
  rate: number;
  ht: number;
  vat: number;
  ttc: number;
}

export interface VatTotals {
  /** Total TTC des lignes. */
  ttc: number;
  /** Total hors taxes. */
  ht: number;
  /** Montant total de TVA inclus dans le TTC. */
  vat: number;
  /** Détail par taux, du plus bas au plus haut (taux nul inclus). */
  byRate: VatRateTotal[];
}

/** Taux exploitable : nombre fini ≥ 0, sinon 0. */
export const normalizeVatRate = (rate?: number | null): number => {
  const n = Number(rate);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const computeVatTotals = (lines: VatLine[]): VatTotals => {
  const buckets = new Map<number, { ht: number; ttc: number }>();
  for (const line of lines) {
    const qty = Math.max(0, Number(line.quantity) || 0);
    const ttc = (Number(line.unitPrice) || 0) * qty;
    if (ttc <= 0) continue;
    const rate = normalizeVatRate(line.vatRate);
    const ht = rate > 0 ? ttc / (1 + rate / 100) : ttc;
    const b = buckets.get(rate) ?? { ht: 0, ttc: 0 };
    b.ht += ht;
    b.ttc += ttc;
    buckets.set(rate, b);
  }

  const byRate: VatRateTotal[] = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, b]) => {
      const ht = round2(b.ht);
      const ttc = round2(b.ttc);
      return { rate, ht, ttc, vat: round2(ttc - ht) };
    });

  const ttc = round2(byRate.reduce((s, r) => s + r.ttc, 0));
  const ht = round2(byRate.reduce((s, r) => s + r.ht, 0));
  return { ttc, ht, vat: round2(ttc - ht), byRate };
};
