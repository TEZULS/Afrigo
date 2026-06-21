/**
 * Sync panier local (Zustand) ↔ entité CartItem Base44 — même logique que le web (Home.jsx, CartDrawer).
 */
import type { CartLine } from '@/stores/cart';
import { CartItem } from '@/api/entities';

function variantsPayload(v: CartLine['variant']): Record<string, { type: string; value: string }> | null {
  if (v?.type && v?.value) return { choice: { type: v.type, value: v.value } };
  return null;
}

function sameVariants(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, { type: string; value: string }> | null,
): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Après `cart.add` / +1 : crée ou met à jour un CartItem côté API. */
export async function remoteUpsertAfterAdd(
  customerEmail: string,
  line: Omit<CartLine, 'quantity'> & { quantity?: number },
): Promise<void> {
  const qty = line.quantity ?? 1;
  const sel = variantsPayload(line.variant);
  const items = (await CartItem().filter?.({
    customer_email: customerEmail,
    product_id: line.productId,
  })) as Array<{
    id: string;
    quantity: number;
    selected_variants?: Record<string, unknown> | null;
  }>;
  const existing = items.find((it) => sameVariants(it.selected_variants, sel));
  if (existing) {
    await CartItem().update?.(existing.id, { quantity: existing.quantity + qty });
  } else {
    await CartItem().create?.({
      customer_email: customerEmail,
      product_id: line.productId,
      product_name: line.name,
      product_image: line.imageUrl,
      quantity: qty,
      unit_price: line.unitPrice,
      unit: line.unit,
      selected_variants: sel,
    });
  }
}

/** Après `cart.remove` (−1) : décrémente ou supprime le CartItem. */
export async function remoteDecrementAfterRemove(
  customerEmail: string,
  productId: string,
  variant?: CartLine['variant'],
): Promise<void> {
  const sel = variantsPayload(variant);
  const items = (await CartItem().filter?.({
    customer_email: customerEmail,
    product_id: productId,
  })) as Array<{ id: string; quantity: number; selected_variants?: unknown }>;
  const existing = items.find((it) => sameVariants(it.selected_variants as Record<string, unknown>, sel));
  if (!existing) return;
  if (existing.quantity > 1) {
    await CartItem().update?.(existing.id, { quantity: existing.quantity - 1 });
  } else {
    await CartItem().delete?.(existing.id);
  }
}

/** Après `setQuantity(..., 0)` ou corbeille : supprime la ligne côté API. */
export async function remoteDeleteLine(
  customerEmail: string,
  productId: string,
  variant?: CartLine['variant'],
): Promise<void> {
  const sel = variantsPayload(variant);
  const items = (await CartItem().filter?.({
    customer_email: customerEmail,
    product_id: productId,
  })) as Array<{ id: string; selected_variants?: unknown }>;
  const existing = items.find((it) => sameVariants(it.selected_variants as Record<string, unknown>, sel));
  if (existing) await CartItem().delete?.(existing.id);
}

/** Après `setQuantity` vers une quantité > 0. */
export async function remoteSetQuantity(
  customerEmail: string,
  productId: string,
  quantity: number,
  line: Pick<CartLine, 'name' | 'imageUrl' | 'unitPrice' | 'unit' | 'variant'>,
): Promise<void> {
  const sel = variantsPayload(line.variant);
  const items = (await CartItem().filter?.({
    customer_email: customerEmail,
    product_id: productId,
  })) as Array<{ id: string; quantity: number; selected_variants?: unknown }>;
  const existing = items.find((it) => sameVariants(it.selected_variants as Record<string, unknown>, sel));
  if (quantity <= 0 && existing) {
    await CartItem().delete?.(existing.id);
    return;
  }
  if (existing) {
    await CartItem().update?.(existing.id, { quantity });
    return;
  }
  await CartItem().create?.({
    customer_email: customerEmail,
    product_id: productId,
    product_name: line.name,
    product_image: line.imageUrl,
    quantity,
    unit_price: line.unitPrice,
    unit: line.unit,
    selected_variants: sel,
  });
}
