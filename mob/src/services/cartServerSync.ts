/**
 * À la connexion : fusion panier invité → CartItem, puis recharge depuis le serveur.
 * Après commande payée ou à la livraison : suppression des CartItem du client (comme Checkout.jsx web).
 */
import type { CartLine } from '@/stores/cart';
import { useCart } from '@/stores/cart';
import { CartItem } from '@/api/entities';

export async function mergeGuestCartIntoServer(
  customerEmail: string,
  lines: CartLine[],
): Promise<void> {
  for (const item of lines) {
    const existingItems = (await CartItem().filter?.({
      customer_email: customerEmail,
      product_id: item.productId,
    })) as Array<{ id: string; quantity: number }>;
    if (existingItems.length > 0) {
      await CartItem().update?.(existingItems[0]!.id, {
        quantity: existingItems[0]!.quantity + item.quantity,
      });
    } else {
      await CartItem().create?.({
        customer_email: customerEmail,
        product_id: item.productId,
        product_name: item.name,
        product_image: item.imageUrl,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        unit: item.unit,
        selected_variants:
          item.variant?.type && item.variant?.value
            ? { choice: { type: item.variant.type, value: item.variant.value } }
            : null,
      });
    }
  }
}

/** Remplace le store local par les CartItem Base44 du client (source de vérité serveur). */
export async function hydrateLocalCartFromServer(customerEmail: string): Promise<void> {
  const rows = (await CartItem().filter?.({ customer_email: customerEmail })) as Array<{
    product_id: string;
    product_name?: string;
    product_image?: string;
    quantity: number;
    unit_price?: number;
    unit?: string;
    selected_variants?: Record<string, { type?: string; value?: string }> | null;
  }>;

  const lines: CartLine[] = (rows ?? []).map((row) => {
    const variants = row.selected_variants ?? null;
    const first = variants ? Object.values(variants)[0] : undefined;
    return {
      productId: row.product_id,
      name: row.product_name ?? '—',
      imageUrl: row.product_image ?? undefined,
      unitPrice: row.unit_price ?? 0,
      quantity: row.quantity,
      unit: row.unit ?? undefined,
      variant:
        first?.type != null && first?.value != null
          ? { type: String(first.type), value: String(first.value) }
          : undefined,
    };
  });

  useCart.getState().replaceLines(lines);
  useCart.getState().setSource('synced');
}

/** Supprime tous les lignes panier distant (après commande validée). */
export async function clearServerCartForCustomer(customerEmail: string): Promise<void> {
  const rows = (await CartItem().filter?.({ customer_email: customerEmail })) as Array<{ id: string }>;
  await Promise.all((rows ?? []).map((r) => CartItem().delete?.(r.id)));
}

/**
 * Étape de réconciliation panier au login / au démarrage de l'app.
 *
 * - Si le panier local est `guest` (ajouté hors-connexion) ET non vide,
 *   on fusionne avec le serveur (additionne les quantités), puis on
 *   recharge depuis le serveur (source de vérité).
 * - Si le panier local est déjà `synced` (provient d'un précédent login),
 *   on saute la fusion et on se contente de recharger depuis le serveur.
 *   Sans cette garde, chaque relance ré-additionnait les quantités locales
 *   au serveur (bug ×2 sur chaque reload).
 */
export async function syncCartWithServerAfterLogin(customerEmail: string): Promise<void> {
  const state = useCart.getState();
  const local = state.lines;
  const isGuestCart = state.source === 'guest';

  if (isGuestCart && local.length > 0) {
    await mergeGuestCartIntoServer(customerEmail, local);
  }
  await hydrateLocalCartFromServer(customerEmail);
}
