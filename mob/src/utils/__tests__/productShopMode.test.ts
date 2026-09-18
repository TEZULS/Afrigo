import { passesShopMode } from '../productShopMode';

describe('passesShopMode', () => {
  const food = [
    { category: 'fruits_legumes' },
    { category: 'viandes_poissons' },
    { category: 'epices' },
    { category: 'sec' },
    { category: 'frais' },
    { category: 'boissons' },
  ];
  const cosmetique = { category: 'cosmetique' };
  /*
    Les 7 sous-catégories réellement créées par le back-office base44 —
    l'app n'en connaissait qu'une, si bien qu'un « Beurre de karité » rangé
    dans « Corps » se retrouvait dans le rayon Alimentation.
  */
  const cosmetiqueSubCategories = [
    { category: 'cosmetique_parfum' },
    { category: 'cosmetique_soins_corps' },
    { category: 'cosmetique_soins_cheveux' },
    { category: 'cosmetique_bebe' },
    { category: 'cosmetique_visage' },
    { category: 'cosmetique_soins_beaute' },
    // « Entretien » est rangé dans le rayon Cosmétiques sur l'app (demande client).
    { category: 'entretien' },
  ];

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

  it('mode cosmetique : inclut les sous-catégories cosmétiques de base44', () => {
    cosmetiqueSubCategories.forEach((p) => {
      expect(passesShopMode(p, 'cosmetique')).toBe(true);
      expect(passesShopMode(p, 'food')).toBe(false);
    });
  });

  it("mode food : inclut « apéritif », catégorie ajoutée côté back-office", () => {
    expect(passesShopMode({ category: 'apéritif' }, 'food')).toBe(true);
  });
});
