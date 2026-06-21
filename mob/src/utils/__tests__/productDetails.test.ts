/**
 * Tests des helpers du ProductDetailsScreen :
 * - suffixe d'unité affiché à côté du prix
 * - calcul du prix avec variant + promotion
 * - détection promotion
 */

const UNIT_PRICE_SUFFIX: Record<string, string> = {
  piece: 'pièce',
  unite: 'unité',
  kg: 'kilo',
  litre: 'litre',
  metre: 'mètre',
  bouteille: 'bouteille',
  pack: 'pack',
  lot: 'lot',
  carton: 'carton',
  sac: 'sac',
  sache: 'sachet',
  boite: 'boîte',
};

const unitSuffix = (unit?: string): string =>
  unit && UNIT_PRICE_SUFFIX[unit] ? ` / ${UNIT_PRICE_SUFFIX[unit]}` : '';

interface VariantLite {
  promotion_price?: number;
  price_modifier?: number;
}

interface ProductLite {
  price: number;
  promotion_price?: number;
  is_promotion?: boolean;
}

const computeUnitPrice = (product: ProductLite, variant: VariantLite | null): number => {
  const variantPromoPrice = variant?.promotion_price;
  const isPromotion = Boolean(
    variantPromoPrice || (product.is_promotion && product.promotion_price),
  );
  const baseFromVariant = variantPromoPrice
    ? Number(variantPromoPrice)
    : isPromotion && product.promotion_price
      ? product.promotion_price
      : product.price;
  return variantPromoPrice
    ? Number(variantPromoPrice)
    : baseFromVariant + (variant?.price_modifier ?? 0);
};

describe('unitSuffix', () => {
  it("retourne ' / kilo' pour kg", () => {
    expect(unitSuffix('kg')).toBe(' / kilo');
  });
  it("retourne ' / sachet' pour sache", () => {
    expect(unitSuffix('sache')).toBe(' / sachet');
  });
  it("retourne ' / unité' pour unite", () => {
    expect(unitSuffix('unite')).toBe(' / unité');
  });
  it("retourne ' / litre' pour litre", () => {
    expect(unitSuffix('litre')).toBe(' / litre');
  });
  it('retourne chaîne vide pour une unité inconnue', () => {
    expect(unitSuffix('xyz')).toBe('');
    expect(unitSuffix(undefined)).toBe('');
    expect(unitSuffix('')).toBe('');
  });
});

describe('computeUnitPrice', () => {
  it('produit normal : retourne le prix de base', () => {
    expect(computeUnitPrice({ price: 4.99 }, null)).toBe(4.99);
  });

  it('produit en promotion : retourne le prix promo', () => {
    expect(
      computeUnitPrice({ price: 5, promotion_price: 3.99, is_promotion: true }, null),
    ).toBe(3.99);
  });

  it('variante avec promotion_price : remplace le prix produit', () => {
    expect(
      computeUnitPrice({ price: 5 }, { promotion_price: 4.5 }),
    ).toBe(4.5);
  });

  it('variante avec price_modifier : ajoute au prix de base', () => {
    expect(
      computeUnitPrice({ price: 10 }, { price_modifier: 2 }),
    ).toBe(12);
  });

  it('variante avec price_modifier négatif', () => {
    expect(
      computeUnitPrice({ price: 10 }, { price_modifier: -1 }),
    ).toBe(9);
  });

  it("priorité variant.promotion_price sur product.promotion_price", () => {
    expect(
      computeUnitPrice(
        { price: 10, promotion_price: 8, is_promotion: true },
        { promotion_price: 6 },
      ),
    ).toBe(6);
  });

  it('is_promotion sans promotion_price : ignoré', () => {
    expect(computeUnitPrice({ price: 10, is_promotion: true }, null)).toBe(10);
  });
});
