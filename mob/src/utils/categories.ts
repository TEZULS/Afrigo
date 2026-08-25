/**
 * Taxonomie des rayons — **source de vérité unique** côté mobile.
 *
 * Les identifiants et libellés reproduisent exactement l'énumération
 * `Product.category` du back-office base44 déployé (vérifié le 2026-09-09,
 * puis le 2026-09-14 pour `boissons_snacks`, sur
 * `https://afri-go-6fad2204.base44.app`). Le fichier versionné
 * `base44/entities/Product.jsonc` est en retard sur la production : il ne
 * connaît que `cosmetique`, alors que l'admin déployé crée des produits en
 * `cosmetique_soins_corps`, `cosmetique_parfum`, etc.
 *
 * Conséquence du décalage (le bug corrigé ici) : un produit rangé dans
 * « Corps » n'était reconnu ni comme cosmétique ni par le filtre de
 * catégories, donc le sélecteur Alimentation / Cosmétiques restait masqué et
 * le produit apparaissait dans le rayon alimentaire.
 */

export interface CategoryDef {
  id: string;
  label: string;
  emoji: string;
}

/** Rayon « Alimentation » (tout ce qui n'est pas cosmétique). */
export const FOOD_CATEGORIES: CategoryDef[] = [
  { id: 'fruits_legumes', label: 'Fruits & Légumes', emoji: '🍎' },
  { id: 'viandes_poissons', label: 'Viandes & Poissons', emoji: '🥩' },
  { id: 'produits_laitiers', label: 'Produits Laitiers', emoji: '🥛' },
  { id: 'epices', label: 'Épices', emoji: '🌶️' },
  { id: 'boissons', label: 'Boissons', emoji: '🍷' },
  { id: 'surgeles', label: 'Surgelés', emoji: '❄️' },
  { id: 'entretien', label: 'Entretien', emoji: '🧹' },
  { id: 'sec', label: 'Sec', emoji: '🌾' },
  { id: 'frais', label: 'Frais', emoji: '🥬' },
  { id: 'apéritif', label: 'Apéritif', emoji: '🥜' },
  // Ajoutée côté admin le 2026-09 (`boissons_snacks`, vérifié dans le bundle
  // web déployé) — distincte de `boissons`.
  { id: 'boissons_snacks', label: 'Boissons et snacks', emoji: '🧃' },
];

/** Rayon « Cosmétiques » — 7 sous-catégories en production. */
export const COSMETIQUE_CATEGORIES: CategoryDef[] = [
  { id: 'cosmetique', label: 'Cosmétique', emoji: '✨' },
  { id: 'cosmetique_parfum', label: 'Parfum', emoji: '🌸' },
  { id: 'cosmetique_soins_corps', label: 'Corps', emoji: '🧴' },
  { id: 'cosmetique_soins_cheveux', label: 'Cheveux', emoji: '💇' },
  { id: 'cosmetique_bebe', label: 'Soins Bébé', emoji: '👶' },
  { id: 'cosmetique_visage', label: 'Visage', emoji: '😌' },
  { id: 'cosmetique_soins_beaute', label: 'Soins & Beauté', emoji: '💄' },
];

export const FOOD_CATEGORY_IDS: string[] = FOOD_CATEGORIES.map((c) => c.id);
export const COSMETIQUE_CATEGORY_IDS: string[] = COSMETIQUE_CATEGORIES.map((c) => c.id);

/** Catalogue complet, pastille « Tous » en tête (barre de filtres, recherche). */
export const CATEGORIES: CategoryDef[] = [
  { id: 'all', label: 'Tous', emoji: '🛒' },
  ...FOOD_CATEGORIES,
  ...COSMETIQUE_CATEGORIES,
];

/**
 * Libellés d'affichage. `hygiene` et `epicerie` ne sont plus proposés à la
 * création mais subsistent sur d'anciens produits : le web déployé les garde
 * dans sa table de libellés, on fait pareil.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  ...Object.fromEntries([...FOOD_CATEGORIES, ...COSMETIQUE_CATEGORIES].map((c) => [c.id, c.label])),
  hygiene: 'Hygiène',
  epicerie: 'Épicerie',
};

/** Le produit appartient-il au rayon cosmétiques ? */
export function isCosmetiqueCategory(category?: string | null): boolean {
  return COSMETIQUE_CATEGORY_IDS.includes(category ?? '');
}
