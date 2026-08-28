/**
 * Libellé de l'unité de vente d'un produit (`Product.unit`, choisie dans
 * l'admin base44 : Pièce, Lot, Bouteille, Carton, Sachet…).
 *
 * Table identique à celle du web déployé : une valeur inconnue est affichée
 * telle quelle plutôt que remplacée par « unité », pour qu'une nouvelle unité
 * ajoutée côté admin apparaisse sans mise à jour de l'app.
 */
export const UNIT_LABELS: Record<string, string> = {
  piece: 'pièce',
  unite: 'unité',
  kg: 'kg',
  g: 'g',
  litre: 'L',
  ml: 'ml',
  cl: 'cl',
  dl: 'dl',
  metre: 'm',
  bouteille: 'bouteille',
  pack: 'pack',
  lot: 'lot',
  carton: 'carton',
  sac: 'sac',
  sache: 'sachet',
  boite: 'boîte',
};

export const unitLabel = (unit?: string | null): string => {
  const key = (unit ?? '').toLowerCase().trim();
  if (!key) return '';
  return UNIT_LABELS[key] ?? key;
};

/** Suffixe prix « / sachet » — vide quand l'unité n'est pas renseignée. */
export const unitPriceSuffix = (unit?: string | null): string => {
  const label = unitLabel(unit);
  return label ? ` / ${label}` : '';
};
