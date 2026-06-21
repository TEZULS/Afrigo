/** Règle identique au web (`src/pages/Home.jsx`) pour le catalogue. */
export const COSMETIQUE_CATEGORY_IDS = ['cosmetique'] as const;

/** Produit inclus dans la zone sous le sélecteur Alimentation / Cosmétiques. */
export function passesShopMode(
  product: { category?: string | null },
  mode: 'food' | 'cosmetique',
): boolean {
  const cat = product.category ?? '';
  if (mode === 'cosmetique') return (COSMETIQUE_CATEGORY_IDS as readonly string[]).includes(cat);
  return !(COSMETIQUE_CATEGORY_IDS as readonly string[]).includes(cat);
}
