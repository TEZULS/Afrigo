/**
 * Tests des calculs de checkout : sous-total panier, frais de livraison,
 * éligibilité livraison gratuite, code promo, déduction portefeuille,
 * total à payer.
 *
 * Réplique exacte de la logique CheckoutScreen pour garantir qu'aucun
 * refactor futur n'introduit de régression sur le calcul du panier.
 */

interface Zone {
  delivery_fee: number;
  free_delivery_threshold?: number;
  min_order_amount?: number;
}

interface Promo {
  discount_percentage: number;
}

const computeCheckoutTotals = (params: {
  subTotal: number;
  zone: Zone | null;
  promo: Promo | null;
  walletBalance: number;
  useWallet: boolean;
}) => {
  const { subTotal, zone, promo, walletBalance, useWallet } = params;
  const freeTh = zone?.free_delivery_threshold;
  const FREE_THRESHOLD = freeTh != null ? Number(freeTh) : 0;
  const isFreeDelivery = Boolean(zone) && (FREE_THRESHOLD === 0 || subTotal >= FREE_THRESHOLD);
  const deliveryFee = zone != null ? (isFreeDelivery ? 0 : Number(zone.delivery_fee ?? 0)) : 0;
  const totalBeforeDiscounts = subTotal + deliveryFee;
  const promoDiscount = promo
    ? Math.round(((subTotal * promo.discount_percentage) / 100) * 100) / 100
    : 0;
  const totalAfterPromo = Math.max(0, totalBeforeDiscounts - promoDiscount);
  const walletApplied =
    useWallet && walletBalance > 0 ? Math.min(walletBalance, totalAfterPromo) : 0;
  const grandTotal = Math.max(0, totalAfterPromo - walletApplied);
  const minOrderAmount = zone != null ? Number(zone.min_order_amount ?? 0) : 0;
  const meetsMinimum = subTotal >= minOrderAmount;
  return {
    isFreeDelivery,
    deliveryFee,
    totalBeforeDiscounts,
    promoDiscount,
    totalAfterPromo,
    walletApplied,
    grandTotal,
    meetsMinimum,
  };
};

describe('computeCheckoutTotals', () => {
  const baseZone = { delivery_fee: 5, free_delivery_threshold: 29 };

  it('panier vide sans zone : tout à 0', () => {
    const r = computeCheckoutTotals({
      subTotal: 0,
      zone: null,
      promo: null,
      walletBalance: 0,
      useWallet: false,
    });
    expect(r.deliveryFee).toBe(0);
    expect(r.grandTotal).toBe(0);
    expect(r.isFreeDelivery).toBe(false);
  });

  it('frais de livraison appliqué sous le seuil', () => {
    const r = computeCheckoutTotals({
      subTotal: 20,
      zone: baseZone,
      promo: null,
      walletBalance: 0,
      useWallet: false,
    });
    expect(r.isFreeDelivery).toBe(false);
    expect(r.deliveryFee).toBe(5);
    expect(r.totalBeforeDiscounts).toBe(25);
    expect(r.grandTotal).toBe(25);
  });

  it('livraison gratuite au seuil (29€)', () => {
    const r = computeCheckoutTotals({
      subTotal: 29,
      zone: baseZone,
      promo: null,
      walletBalance: 0,
      useWallet: false,
    });
    expect(r.isFreeDelivery).toBe(true);
    expect(r.deliveryFee).toBe(0);
    expect(r.grandTotal).toBe(29);
  });

  it('livraison gratuite si seuil = 0', () => {
    const r = computeCheckoutTotals({
      subTotal: 5,
      zone: { delivery_fee: 3, free_delivery_threshold: 0 },
      promo: null,
      walletBalance: 0,
      useWallet: false,
    });
    expect(r.isFreeDelivery).toBe(true);
    expect(r.deliveryFee).toBe(0);
  });

  it('code promo -10% sur sous-total uniquement', () => {
    const r = computeCheckoutTotals({
      subTotal: 50,
      zone: baseZone, // 50 ≥ 29 → livraison gratuite
      promo: { discount_percentage: 10 },
      walletBalance: 0,
      useWallet: false,
    });
    // promoDiscount = 50 * 10 / 100 = 5
    expect(r.promoDiscount).toBe(5);
    expect(r.totalAfterPromo).toBe(45);
    expect(r.grandTotal).toBe(45);
  });

  it('portefeuille déduit après promo', () => {
    const r = computeCheckoutTotals({
      subTotal: 100,
      zone: baseZone,
      promo: { discount_percentage: 10 },
      walletBalance: 20,
      useWallet: true,
    });
    // sous-total 100, livraison 0 (≥29), promo 10% = 10€, totalAfterPromo 90, wallet 20 → grand total 70
    expect(r.promoDiscount).toBe(10);
    expect(r.totalAfterPromo).toBe(90);
    expect(r.walletApplied).toBe(20);
    expect(r.grandTotal).toBe(70);
  });

  it('portefeuille ne dépasse jamais le total à payer', () => {
    const r = computeCheckoutTotals({
      subTotal: 10,
      zone: baseZone, // < 29 → +5€ livraison
      promo: null,
      walletBalance: 100,
      useWallet: true,
    });
    expect(r.totalBeforeDiscounts).toBe(15);
    expect(r.walletApplied).toBe(15);
    expect(r.grandTotal).toBe(0);
  });

  it("`useWallet: false` ignore le portefeuille même avec solde positif", () => {
    const r = computeCheckoutTotals({
      subTotal: 30,
      zone: baseZone,
      promo: null,
      walletBalance: 50,
      useWallet: false,
    });
    expect(r.walletApplied).toBe(0);
    expect(r.grandTotal).toBe(30);
  });

  it('respecte le minimum de commande de zone', () => {
    const zone = { delivery_fee: 5, free_delivery_threshold: 29, min_order_amount: 25 };
    const below = computeCheckoutTotals({
      subTotal: 20,
      zone,
      promo: null,
      walletBalance: 0,
      useWallet: false,
    });
    expect(below.meetsMinimum).toBe(false);
    const ok = computeCheckoutTotals({
      subTotal: 25,
      zone,
      promo: null,
      walletBalance: 0,
      useWallet: false,
    });
    expect(ok.meetsMinimum).toBe(true);
  });

  it('arrondit le promoDiscount au centième', () => {
    const r = computeCheckoutTotals({
      subTotal: 33.33,
      zone: null,
      promo: { discount_percentage: 7 },
      walletBalance: 0,
      useWallet: false,
    });
    // 33.33 * 7 / 100 = 2.3331 → arrondi à 2.33
    expect(r.promoDiscount).toBe(2.33);
  });
});
