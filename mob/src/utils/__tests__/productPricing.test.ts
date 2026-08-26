import {
  catalogPrice,
  hasPromotion,
  lowStockLabel,
  promotionDiscountPercent,
  sellingPrice,
  splitPrice,
  vatBreakdown,
} from '../productPricing';

/** Crabe Madagascar 1 kg, tel qu'en production : HT 13,99 €, TVA 10 %, TTC 15,39 €. */
const crabe = { price: 13.99, price_ttc: 15.39, vat_rate: 10 };
/** Produit ancien : pas de TVA saisie, `price` est le prix client. */
const adja = { price: 4.25 };

describe('catalogPrice / sellingPrice (TTC)', () => {
  it('affiche et facture le prix TTC quand la TVA est renseignée', () => {
    expect(catalogPrice(crabe)).toBe(15.39);
    expect(sellingPrice(crabe)).toBe(15.39);
  });

  it('retombe sur `price` pour les produits sans TVA', () => {
    expect(catalogPrice(adja)).toBe(4.25);
    expect(sellingPrice(adja)).toBe(4.25);
  });

  it('ignore un price_ttc nul ou absent', () => {
    expect(catalogPrice({ price: 3, price_ttc: 0 })).toBe(3);
    expect(catalogPrice({ price: 3, price_ttc: null })).toBe(3);
  });

  it('applique la promotion sur le prix de vente, pas sur le prix barré', () => {
    const promo = { ...crabe, is_promotion: true, promotion_price: 12 };
    expect(hasPromotion(promo)).toBe(true);
    expect(sellingPrice(promo)).toBe(12);
    expect(catalogPrice(promo)).toBe(15.39);
    expect(promotionDiscountPercent(promo)).toBe(22);
  });

  it('sans flag is_promotion, le prix promo est ignoré', () => {
    expect(hasPromotion({ ...crabe, promotion_price: 12 })).toBe(false);
    expect(promotionDiscountPercent({ ...crabe, promotion_price: 12 })).toBe(0);
  });
});

describe('vatBreakdown', () => {
  it('décompose un prix TTC en HT + TVA (première capture : 15,39 € → 13,99 € + 1,40 €)', () => {
    const v = vatBreakdown(15.39, 10)!;
    expect(v.rate).toBe(10);
    expect(v.ht.toFixed(2)).toBe('13.99');
    expect(v.vat.toFixed(2)).toBe('1.40');
  });

  it('TVA à 0 % : tout est HT', () => {
    const v = vatBreakdown(4.25, 0)!;
    expect(v.ht).toBe(4.25);
    expect(v.vat).toBe(0);
  });

  it("renvoie null quand la TVA n'a jamais été renseignée", () => {
    expect(vatBreakdown(4.25, undefined)).toBeNull();
    expect(vatBreakdown(4.25, null)).toBeNull();
  });
});

describe('splitPrice', () => {
  it('sépare entier et centimes pour l’affichage « 15.39 »', () => {
    expect(splitPrice(15.39)).toEqual({ int: '15', dec: '39' });
    expect(splitPrice(4)).toEqual({ int: '4', dec: '00' });
    expect(splitPrice(0.5)).toEqual({ int: '0', dec: '50' });
  });

  it('arrondit correctement les flottants', () => {
    expect(splitPrice(1.005)).toEqual({ int: '1', dec: '00' });
    expect(splitPrice(2.999)).toEqual({ int: '3', dec: '00' });
  });
});

describe('lowStockLabel (« Plus que 3 … »)', () => {
  it('alerte de 1 à 3 unités avec l’unité du produit', () => {
    expect(lowStockLabel(3, 'sache')).toBe('Plus que 3 sachets');
    expect(lowStockLabel(2, 'piece')).toBe('Plus que 2 pièces');
    expect(lowStockLabel(1, 'boite')).toBe('Plus que 1 boîte');
  });

  it('ne met pas de pluriel aux abréviations', () => {
    expect(lowStockLabel(2, 'kg')).toBe('Plus que 2 kg');
    expect(lowStockLabel(3, 'litre')).toBe('Plus que 3 L');
  });

  it('retombe sur « produit » sans unité', () => {
    expect(lowStockLabel(3)).toBe('Plus que 3 produits');
    expect(lowStockLabel(1, '')).toBe('Plus que 1 produit');
  });

  it('rien au-delà de 3, ni à 0 (géré par « Épuisé »)', () => {
    expect(lowStockLabel(4, 'sache')).toBeNull();
    expect(lowStockLabel(0, 'sache')).toBeNull();
    expect(lowStockLabel(undefined, 'sache')).toBeNull();
  });
});
