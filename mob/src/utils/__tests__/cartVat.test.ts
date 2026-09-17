import { computeVatTotals, normalizeVatRate } from '../cartVat';

describe('computeVatTotals', () => {
  it('décompose un prix TTC en HT + TVA avec le taux du produit', () => {
    // Crabe Madagascar : 10 € TTC à 10 % → 9,09 € HT + 0,91 € de TVA.
    const t = computeVatTotals([{ unitPrice: 10, quantity: 1, vatRate: 10 }]);
    expect(t).toEqual({
      ttc: 10,
      ht: 9.09,
      vat: 0.91,
      byRate: [{ rate: 10, ht: 9.09, ttc: 10, vat: 0.91 }],
    });
  });

  it('traite un taux absent comme 0 % (produits anciens : le prix est le prix client)', () => {
    const t = computeVatTotals([
      { unitPrice: 29.9, quantity: 1 },
      { unitPrice: 4.25, quantity: 1, vatRate: null },
    ]);
    expect(t.ttc).toBe(34.15);
    expect(t.ht).toBe(34.15);
    expect(t.vat).toBe(0);
    expect(t.byRate).toEqual([{ rate: 0, ht: 34.15, ttc: 34.15, vat: 0 }]);
  });

  it('regroupe par taux, du plus bas au plus haut, et multiplie par la quantité', () => {
    // Commande réelle du 2026-09-16 : Poisson 20,99 (0 %), Adja 4,25 (0 %), Crabe 10 (10 %).
    const t = computeVatTotals([
      { unitPrice: 20.99, quantity: 1, vatRate: 0 },
      { unitPrice: 4.25, quantity: 1, vatRate: 0 },
      { unitPrice: 10, quantity: 2, vatRate: 10 },
    ]);
    expect(t.ttc).toBe(45.24);
    expect(t.byRate.map((r) => r.rate)).toEqual([0, 10]);
    expect(t.byRate[1]).toEqual({ rate: 10, ht: 18.18, ttc: 20, vat: 1.82 });
    expect(t.ht).toBe(43.42);
    expect(t.vat).toBe(1.82);
  });

  it('ignore les lignes vides ou à quantité nulle', () => {
    const t = computeVatTotals([{ unitPrice: 5, quantity: 0, vatRate: 20 }]);
    expect(t).toEqual({ ttc: 0, ht: 0, vat: 0, byRate: [] });
  });

  it('normalise les taux invalides', () => {
    expect(normalizeVatRate(undefined)).toBe(0);
    expect(normalizeVatRate(NaN)).toBe(0);
    expect(normalizeVatRate(-5)).toBe(0);
    expect(normalizeVatRate(5.5)).toBe(5.5);
  });
});
