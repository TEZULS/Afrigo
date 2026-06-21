import { passesShopMode } from '../productShopMode';

describe('passesShopMode', () => {
  const food = [
    { category: 'fruits_legumes' },
    { category: 'viandes_poissons' },
    { category: 'epices' },
    { category: 'sec' },
    { category: 'frais' },
    { category: 'boissons' },
    { category: 'entretien' },
  ];
  const cosmetique = { category: 'cosmetique' };

  it('mode food : exclut cosmétique', () => {
    expect(passesShopMode(cosmetique, 'food')).toBe(false);
  });

  it('mode food : inclut toutes les catégories alimentaires', () => {
    food.forEach((p) => {
      expect(passesShopMode(p, 'food')).toBe(true);
    });
  });

  it('mode food : inclut un produit sans catégorie (par défaut food)', () => {
    expect(passesShopMode({}, 'food')).toBe(true);
    expect(passesShopMode({ category: null }, 'food')).toBe(true);
  });

  it('mode cosmetique : exclut le food', () => {
    food.forEach((p) => {
      expect(passesShopMode(p, 'cosmetique')).toBe(false);
    });
  });

  it('mode cosmetique : inclut uniquement la catégorie cosmétique', () => {
    expect(passesShopMode(cosmetique, 'cosmetique')).toBe(true);
  });
});
