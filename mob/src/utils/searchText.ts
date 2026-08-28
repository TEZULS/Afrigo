/** Bornes du bloc Unicode « Combining Diacritical Marks » (accents décomposés). */
const COMBINING_FIRST = 0x300;
const COMBINING_LAST = 0x36f;

/** Retire les accents d'une chaîne déjà décomposée en NFD. */
function stripCombiningMarks(decomposed: string): string {
  let out = '';
  for (const char of decomposed) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= COMBINING_FIRST && code <= COMBINING_LAST) continue;
    out += char;
  }
  return out;
}

/**
 * Normalisation de texte pour la recherche produit : minuscules + accents
 * retirés (« Épices » → « epices »).
 *
 * La normalisation se fait **caractère par caractère** et retombe sur le
 * caractère d'origine si le repli n'en produit pas exactement un : la chaîne
 * renvoyée garde ainsi la même longueur que l'entrée, ce qui permet de
 * réutiliser les index trouvés sur la version normalisée pour découper la
 * chaîne d'origine (mise en gras de la partie déjà saisie).
 */
export function foldText(input: string): string {
  let out = '';
  for (const char of input) {
    const folded = stripCombiningMarks(char.normalize('NFD')).toLowerCase();
    out += folded.length === char.length ? folded : char.toLowerCase();
  }
  return out;
}

/**
 * Index de la première occurrence de `query` dans `text` (accents et casse
 * ignorés), ou `-1`. L'index reste valide sur `text` non normalisé.
 */
export function findMatchIndex(text: string, query: string): number {
  const q = foldText(query.trim());
  if (!q) return -1;
  return foldText(text).indexOf(q);
}
