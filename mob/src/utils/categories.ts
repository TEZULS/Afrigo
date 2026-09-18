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

import type { ImageSourcePropType } from 'react-native';

export interface CategoryDef {
  id: string;
  label: string;
  /** Repli quand aucune illustration n'est fournie pour la catégorie. */
  emoji: string;
  /** Illustration (même visuel que le web) — prioritaire sur l'emoji. */
  image?: ImageSourcePropType;
}

/** Hébergement des visuels générés par l'admin (mêmes fichiers que le site). */
const MEDIA = 'https://media.base44.com/images/public/6947869a3a13c81a6fad2204';

/**
 * Illustrations des rayons : exactement celles des filtres de
 * https://afrigo.app (relevées dans le bundle déployé le 2026-09-18). Les
 * rayons sans image sur le site (Boissons, Surgelés, Sec, Frais, Apéritif,
 * Cosmétique, Parfum) gardent leur emoji, comme sur le site.
 */
export const CATEGORY_IMAGES: Partial<Record<string, ImageSourcePropType>> = {
  fruits_legumes: { uri: `${MEDIA}/898efdce0_generated_image.png` },
  viandes_poissons: { uri: `${MEDIA}/66f21d1d8_generated_image.png` },
  produits_laitiers: { uri: `${MEDIA}/2e2de65de_generated_image.png` },
  epices: { uri: `${MEDIA}/487a171d0_generated_image.png` },
  entretien: { uri: `${MEDIA}/f7d96ffe3_generated_image.png` },
  boissons_snacks: { uri: `${MEDIA}/274f60c45_generated_image.png` },
  cosmetique_soins_corps: { uri: `${MEDIA}/91d9e1764_generated_image.png` },
  cosmetique_soins_cheveux: { uri: `${MEDIA}/ee84b069f_generated_image.png` },
  cosmetique_bebe: { uri: `${MEDIA}/ee6e0a7cb_generated_image.png` },
  cosmetique_visage: { uri: `${MEDIA}/b6c9c96a3_generated_image.png` },
  cosmetique_soins_beaute: { uri: `${MEDIA}/72a70a318_generated_image.png` },
};

const withImage = (c: Omit<CategoryDef, 'image'>): CategoryDef => {
  const image = CATEGORY_IMAGES[c.id];
  return image ? { ...c, image } : c;
};

/** Rayon « Alimentation » (tout ce qui n'est pas cosmétique). */
export const FOOD_CATEGORIES: CategoryDef[] = ([
  { id: 'fruits_legumes', label: 'Fruits & Légumes', emoji: '🍎' },
  { id: 'viandes_poissons', label: 'Viandes & Poissons', emoji: '🥩' },
  { id: 'produits_laitiers', label: 'Produits Laitiers', emoji: '🥛' },
  { id: 'epices', label: 'Épices', emoji: '🌶️' },
  { id: 'boissons', label: 'Boissons', emoji: '🍷' },
  { id: 'surgeles', label: 'Surgelés', emoji: '❄️' },
  { id: 'sec', label: 'Sec', emoji: '🌾' },
  { id: 'frais', label: 'Frais', emoji: '🥬' },
  { id: 'apéritif', label: 'Apéritif', emoji: '🥜' },
  // Ajoutée côté admin le 2026-09 (`boissons_snacks`, vérifié dans le bundle
  // web déployé) — distincte de `boissons`.
  { id: 'boissons_snacks', label: 'Boissons et snacks', emoji: '🧃' },
] as Omit<CategoryDef, 'image'>[]).map(withImage);

/**
 * Rayon « Cosmétiques » — les 7 sous-catégories cosmétiques de production,
 * plus « Entretien » (produits d'entretien / hygiène de la maison), rangé ici
 * à la demande du client : sur le site il reste dans l'alimentaire.
 */
export const COSMETIQUE_CATEGORIES: CategoryDef[] = ([
  { id: 'cosmetique', label: 'Cosmétique', emoji: '✨' },
  { id: 'cosmetique_parfum', label: 'Parfum', emoji: '🌸' },
  { id: 'cosmetique_soins_corps', label: 'Corps', emoji: '🧴' },
  { id: 'cosmetique_soins_cheveux', label: 'Cheveux', emoji: '💇' },
  { id: 'cosmetique_bebe', label: 'Soins Bébé', emoji: '👶' },
  { id: 'cosmetique_visage', label: 'Visage', emoji: '😌' },
  { id: 'cosmetique_soins_beaute', label: 'Soins & Beauté', emoji: '💄' },
  { id: 'entretien', label: 'Entretien', emoji: '🧹' },
] as Omit<CategoryDef, 'image'>[]).map(withImage);

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
