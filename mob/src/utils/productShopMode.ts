/** Règle identique au web déployé pour le catalogue (rayon Alimentation / Cosmétiques). */
import { COSMETIQUE_CATEGORY_IDS, isCosmetiqueCategory } from '@/utils/categories';

export { COSMETIQUE_CATEGORY_IDS };

/** Produit inclus dans la zone sous le sélecteur Alimentation / Cosmétiques. */
export function passesShopMode(
  product: { category?: string | null },
  mode: 'food' | 'cosmetique',
): boolean {
  const cosmetique = isCosmetiqueCategory(product.category);
  return mode === 'cosmetique' ? cosmetique : !cosmetique;
}
