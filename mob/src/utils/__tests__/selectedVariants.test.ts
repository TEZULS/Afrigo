import { selectedVariantsPayload, sameSelectedVariants } from '../selectedVariants';

describe('selectedVariantsPayload', () => {
  const variant = {
    type: 'poids',
    value: '500g',
    price_modifier: 2.49,
    stock_quantity: 0,
    image_url: 'https://base44.app/img.png',
  };

  it("sérialise sous la clé `single` attendue par l'app web déployée", () => {
    expect(selectedVariantsPayload(variant)).toEqual({ single: variant });
  });

  it("conserve l'objet variante complet (prix, image) et pas seulement type/value", () => {
    const payload = selectedVariantsPayload(variant);
    expect(payload?.single?.price_modifier).toBe(2.49);
    expect(payload?.single?.image_url).toBe('https://base44.app/img.png');
  });

  it('renvoie null pour un produit sans variante', () => {
    expect(selectedVariantsPayload(null)).toBeNull();
    expect(selectedVariantsPayload(undefined)).toBeNull();
    expect(selectedVariantsPayload({ type: 'poids' })).toBeNull();
    expect(selectedVariantsPayload({ value: '500g' })).toBeNull();
  });
});

describe('sameSelectedVariants', () => {
  const sel = selectedVariantsPayload({ type: 'poids', value: '500g', price_modifier: 2.49 });

  it('reconnaît la même variante même si le prix a changé côté back-office', () => {
    expect(
      sameSelectedVariants({ single: { type: 'poids', value: '500g', price_modifier: 3 } }, sel),
    ).toBe(true);
  });

  /* Les lignes créées par l'ancienne version du mobile utilisaient `choice`. */
  it("reconnaît une ligne héritée de l'ancienne clé `choice`", () => {
    expect(sameSelectedVariants({ choice: { type: 'poids', value: '500g' } }, sel)).toBe(true);
  });

  it('distingue deux variantes différentes du même produit', () => {
    expect(sameSelectedVariants({ single: { type: 'poids', value: '250g' } }, sel)).toBe(false);
  });

  it('ne confond pas un produit sans variante avec un produit varianté', () => {
    expect(sameSelectedVariants(null, sel)).toBe(false);
    expect(sameSelectedVariants(null, null)).toBe(true);
    expect(sameSelectedVariants({}, null)).toBe(true);
  });
});
