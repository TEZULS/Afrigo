import React from 'react';
import { renderWithProviders, screen } from '@/__tests__/test-utils';

/**
 * Illustrations de rayons : quand `CATEGORY_IMAGES` fournit un visuel pour
 * une catégorie, la pastille l'affiche à la place de l'emoji.
 */
jest.mock('@/utils/categories', () => {
  const actual = jest.requireActual('@/utils/categories');
  const image = { uri: 'https://afrigo.app/icons/corps.png' };
  const withImage = (c: { id: string }) => (c.id === 'cosmetique_soins_corps' ? { ...c, image } : c);
  return {
    ...actual,
    CATEGORIES: actual.CATEGORIES.map(withImage),
    COSMETIQUE_CATEGORIES: actual.COSMETIQUE_CATEGORIES.map(withImage),
  };
});

import { CategoryFilter } from '../CategoryFilter';

describe('CategoryFilter — illustrations', () => {
  it('affiche l’illustration fournie, et l’emoji pour les autres catégories', () => {
    renderWithProviders(
      <CategoryFilter
        selected="all"
        onSelect={jest.fn()}
        availableCategories={['cosmetique_soins_corps', 'cosmetique_parfum']}
        shopMode="cosmetique"
      />,
    );
    expect(screen.getByTestId('category-image-cosmetique_soins_corps')).toBeTruthy();
    expect(screen.queryByText('🧴')).toBeNull();
    // Parfum n'a pas d'illustration sur le site : emoji conservé.
    expect(screen.getByText('🌸')).toBeTruthy();
    expect(screen.queryByTestId('category-image-cosmetique_parfum')).toBeNull();
  });
});

describe('CategoryFilter — illustrations du site', () => {
  it('reprend les visuels de afrigo.app pour les rayons qui en ont', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CATEGORY_IMAGES } = jest.requireActual('@/utils/categories');
    for (const id of ['fruits_legumes', 'viandes_poissons', 'produits_laitiers', 'epices', 'entretien', 'boissons_snacks', 'cosmetique_bebe']) {
      expect(CATEGORY_IMAGES[id]?.uri).toMatch(/^https:\/\/media\.base44\.com\/images\/public\//);
    }
    for (const id of ['boissons', 'surgeles', 'sec', 'frais', 'apéritif', 'cosmetique', 'cosmetique_parfum']) {
      expect(CATEGORY_IMAGES[id]).toBeUndefined();
    }
  });
});
