/**
 * Calculs du récapitulatif de commande (Checkout) — purs, pour être testables
 * et partagés entre l'écran et la validation avant création de la commande.
 *
 * Ordre des déductions, identique au web déployé (`Checkout.jsx`) :
 * sous-total + livraison → − code promo → − portefeuille → reste à payer.
 */

export const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

export interface CheckoutTotalsInput {
  /** Total des articles TTC. */
  subTotal: number;
  /** Frais de livraison déjà résolus (0 si offerts ou zone inconnue). */
  deliveryFee: number;
  /** Remise du code promo en % (0 sans code). */
  promoPercent: number;
  /** Solde du portefeuille du client. */
  walletBalance: number;
  /**
   * Montant que le client souhaite prélever sur son portefeuille ;
   * `null` quand la case « Utiliser mon portefeuille » n'est pas cochée.
   */
  walletRequested: number | null;
}

export interface CheckoutTotals {
  totalBeforeDiscounts: number;
  promoDiscount: number;
  totalAfterPromo: number;
  /** Plafond utilisable : min(solde, total après promo). */
  maxWalletUsage: number;
  /** Montant réellement prélevé sur le portefeuille. */
  walletApplied: number;
  /** Reste à régler (carte ou livraison) — 0 si le portefeuille couvre tout. */
  grandTotal: number;
}

export const computeCheckoutTotals = (input: CheckoutTotalsInput): CheckoutTotals => {
  const subTotal = Math.max(0, Number(input.subTotal) || 0);
  const deliveryFee = Math.max(0, Number(input.deliveryFee) || 0);
  const totalBeforeDiscounts = round2(subTotal + deliveryFee);

  const promoPercent = Math.max(0, Number(input.promoPercent) || 0);
  // La remise porte sur les articles, pas sur la livraison (règle mobile
  // existante, conservée).
  const promoDiscount = promoPercent > 0 ? round2((subTotal * promoPercent) / 100) : 0;
  const totalAfterPromo = Math.max(0, round2(totalBeforeDiscounts - promoDiscount));

  const walletBalance = Math.max(0, Number(input.walletBalance) || 0);
  const maxWalletUsage = round2(Math.min(walletBalance, totalAfterPromo));
  const requested = input.walletRequested == null ? 0 : Number(input.walletRequested) || 0;
  const walletApplied = round2(Math.min(Math.max(0, requested), maxWalletUsage));
  const grandTotal = Math.max(0, round2(totalAfterPromo - walletApplied));

  return {
    totalBeforeDiscounts,
    promoDiscount,
    totalAfterPromo,
    maxWalletUsage,
    walletApplied,
    grandTotal,
  };
};

/**
 * Saisie du montant portefeuille : accepte la virgule française, ignore tout
 * autre caractère, borne à `max`. Renvoie `null` si la saisie est vide ou
 * illisible (le champ garde alors le texte tel quel).
 */
export const parseWalletAmountInput = (text: string, max: number): number | null => {
  const cleaned = String(text ?? '')
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return round2(Math.min(Math.max(0, n), Math.max(0, max)));
};

/** Format d'édition du montant (point décimal, 2 décimales, sans symbole). */
export const formatWalletAmountInput = (n: number): string => round2(n).toFixed(2);
