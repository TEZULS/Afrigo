import { serverDateMs } from './serverDate';

/** Fenêtre « nouveauté » : produits créés depuis 7 jours (même règle que le site). */
export const NEW_PRODUCT_WINDOW_MS = 7 * 24 * 36e5;

interface NewProductCandidate {
  created_date?: string;
  featured_groups?: string[];
}

/**
 * Nouveautés du catalogue, dans l'ordre du site : « meilleure vente » d'abord,
 * puis du plus récent au plus ancien.
 */
export const selectNewProducts = <T extends NewProductCandidate>(
  products: T[],
  now = Date.now(),
): T[] => {
  const since = now - NEW_PRODUCT_WINDOW_MS;
  return products
    .filter((p) => {
      const ms = serverDateMs(p.created_date);
      return ms > 0 && ms >= since;
    })
    .sort((a, b) => {
      const aBest = a.featured_groups?.includes('meilleure_vente') ? 1 : 0;
      const bBest = b.featured_groups?.includes('meilleure_vente') ? 1 : 0;
      if (aBest !== bBest) return bBest - aBest;
      return serverDateMs(b.created_date) - serverDateMs(a.created_date);
    });
};
