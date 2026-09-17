import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Product } from '@/api/entities';
import type { CartLine } from '@/stores/cart';
import { computeVatTotals, type VatTotals } from '@/utils/cartVat';

/**
 * Taux de TVA des lignes du panier.
 *
 * Une ligne ajoutée depuis le catalogue porte déjà `vatRate` ; une ligne
 * rechargée depuis le serveur (`CartItem` ne stocke pas la TVA) ou persistée
 * par une ancienne version de l'app n'en a pas : on relit alors
 * `Product.vat_rate` pour ces produits-là seulement. Tant que la réponse
 * n'est pas arrivée, le taux vaut 0 % (HT = TTC), ce qui évite une TVA
 * inventée.
 */
export const useCartVatRates = (lines: CartLine[]) => {
  const missingIds = useMemo(
    () =>
      [...new Set(lines.filter((l) => l.vatRate == null).map((l) => l.productId))].sort(),
    [lines],
  );

  const query = useQuery<Record<string, number | null>>({
    queryKey: ['cart-vat-rates', missingIds],
    enabled: missingIds.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const entries = await Promise.all(
        missingIds.map(async (id) => {
          try {
            const p = (await Product().get?.(id)) as { vat_rate?: number | null } | null | undefined;
            return [id, p?.vat_rate ?? null] as const;
          } catch {
            return [id, null] as const;
          }
        }),
      );
      return Object.fromEntries(entries);
    },
  });

  const rates = query.data;

  const vatRateOf = useCallback(
    (line: CartLine): number | null =>
      line.vatRate != null ? line.vatRate : (rates?.[line.productId] ?? null),
    [rates],
  );

  /** Lignes enrichies du taux résolu, prêtes pour `computeVatTotals` / la commande. */
  const withVat = useCallback(
    (subset: CartLine[]): (CartLine & { vatRate: number | null })[] =>
      subset.map((l) => ({ ...l, vatRate: vatRateOf(l) })),
    [vatRateOf],
  );

  const totalsOf = useCallback(
    (subset: CartLine[]): VatTotals => computeVatTotals(withVat(subset)),
    [withVat],
  );

  return { vatRateOf, withVat, totalsOf, isResolving: query.isLoading };
};
