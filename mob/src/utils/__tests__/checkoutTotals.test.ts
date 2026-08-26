import {
  computeCheckoutTotals,
  formatWalletAmountInput,
  parseWalletAmountInput,
} from '../checkoutMath';

describe('computeCheckoutTotals — portefeuille', () => {
  const base = { subTotal: 30, deliveryFee: 2.5, promoPercent: 0, walletBalance: 20 };

  it('case décochée : rien n’est prélevé', () => {
    const t = computeCheckoutTotals({ ...base, walletRequested: null });
    expect(t.walletApplied).toBe(0);
    expect(t.grandTotal).toBe(32.5);
    expect(t.maxWalletUsage).toBe(20);
  });

  it('montant précis : une partie portefeuille, le reste par carte', () => {
    const t = computeCheckoutTotals({ ...base, walletRequested: 12.5 });
    expect(t.walletApplied).toBe(12.5);
    expect(t.grandTotal).toBe(20);
  });

  it('borne au solde disponible', () => {
    const t = computeCheckoutTotals({ ...base, walletRequested: 999 });
    expect(t.walletApplied).toBe(20);
    expect(t.grandTotal).toBe(12.5);
  });

  it('borne au montant de la commande : reste à payer 0 quand le solde couvre tout', () => {
    const t = computeCheckoutTotals({
      subTotal: 10,
      deliveryFee: 0,
      promoPercent: 0,
      walletBalance: 50,
      walletRequested: 50,
    });
    expect(t.maxWalletUsage).toBe(10);
    expect(t.walletApplied).toBe(10);
    expect(t.grandTotal).toBe(0);
  });

  it('applique le code promo avant le portefeuille', () => {
    const t = computeCheckoutTotals({
      subTotal: 100,
      deliveryFee: 0,
      promoPercent: 10,
      walletBalance: 20,
      walletRequested: 20,
    });
    expect(t.promoDiscount).toBe(10);
    expect(t.totalAfterPromo).toBe(90);
    expect(t.walletApplied).toBe(20);
    expect(t.grandTotal).toBe(70);
  });

  it('ignore les montants négatifs', () => {
    const t = computeCheckoutTotals({ ...base, walletRequested: -5 });
    expect(t.walletApplied).toBe(0);
  });

  it('arrondit au centime', () => {
    const t = computeCheckoutTotals({
      subTotal: 10.005,
      deliveryFee: 0,
      promoPercent: 0,
      walletBalance: 3.333,
      walletRequested: 3.333,
    });
    expect(t.walletApplied).toBe(3.33);
    expect(t.grandTotal).toBe(6.68);
  });
});

describe('parseWalletAmountInput', () => {
  it('accepte la virgule française et borne au maximum', () => {
    expect(parseWalletAmountInput('12,5', 20)).toBe(12.5);
    expect(parseWalletAmountInput('12.50', 20)).toBe(12.5);
    expect(parseWalletAmountInput('99', 20)).toBe(20);
  });

  it('ignore les caractères parasites', () => {
    expect(parseWalletAmountInput('15 €', 20)).toBe(15);
    expect(parseWalletAmountInput('abc', 20)).toBeNull();
    expect(parseWalletAmountInput('', 20)).toBeNull();
  });

  it('formate pour l’édition avec deux décimales', () => {
    expect(formatWalletAmountInput(12.5)).toBe('12.50');
    expect(formatWalletAmountInput(0)).toBe('0.00');
  });
});
