/**
 * Sérialisation des variantes choisies vers base44 (`selected_variants`).
 *
 * Format **imposé par l'existant** — vérifié le 2026-09-09 sur l'app web
 * déployée et sur la cloud function `updateStockAfterOrder` :
 *
 *   selected_variants = { single: { type, value, price_modifier, image_url, … } }
 *
 * Deux points comptent :
 * - la **valeur** est l'objet variante complet, pas seulement `{type, value}` :
 *   l'admin affiche `variant.type` + `variant.value` et `updateStockAfterOrder`
 *   retrouve la variante du produit par ces deux champs ;
 * - la **clé** est `single`, comme sur le web. Le mobile envoyait `choice`, si
 *   bien qu'une même variante ajoutée depuis le web puis depuis l'app créait
 *   deux lignes `CartItem` distinctes au lieu d'incrémenter la même.
 */
import type { CartVariant } from '@/stores/cart';

/** Clé utilisée par le web déployé pour une sélection à un seul axe. */
const SINGLE_KEY = 'single';

export type SelectedVariants = Record<string, CartVariant>;

/** `null` quand la ligne n'a aucune variante (produit simple). */
export function selectedVariantsPayload(variant?: CartVariant | null): SelectedVariants | null {
  if (!variant?.type || !variant?.value) return null;
  return { [SINGLE_KEY]: variant };
}

/**
 * Deux sélections désignent-elles la même variante ? On compare `type`/`value`
 * (et non l'objet entier) : le prix ou l'image d'une variante peuvent avoir
 * changé côté back-office depuis l'ajout au panier, et la clé peut être
 * `single` (web/mobile actuel) ou l'ancien `choice` des lignes déjà en base.
 */
export function sameSelectedVariants(
  a: Record<string, unknown> | null | undefined,
  b: SelectedVariants | null | undefined,
): boolean {
  const norm = (v: Record<string, unknown> | null | undefined): string[] =>
    Object.values(v ?? {})
      .map((entry) => {
        const o = (entry ?? {}) as { type?: unknown; value?: unknown };
        return `${String(o.type ?? '')}:${String(o.value ?? '')}`;
      })
      .sort();

  const left = norm(a);
  const right = norm(b);
  return left.length === right.length && left.every((v, i) => v === right[i]);
}
