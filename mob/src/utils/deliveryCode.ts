/**
 * Code de confirmation de livraison à 4 chiffres (principe Uber).
 *
 * Généré à la création de la commande, affiché au client dans le suivi de
 * commande, et exigé du livreur avant de pouvoir marquer la commande comme
 * livrée. Il garantit que le colis a bien été remis à la bonne personne.
 *
 * Ce n'est pas un secret cryptographique : c'est une preuve de remise en main
 * propre, au même titre que le code Uber Eats.
 */

/** Statuts pour lesquels le code doit rester visible côté client. */
const ACTIVE_STATUSES = new Set([
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'shipped',
  'out_for_delivery',
]);

/** Génère un code à 4 chiffres, 1000-9999 (jamais de zéro en tête). */
export const generateDeliveryCode = (): string =>
  String(1000 + Math.floor(Math.random() * 9000));

/** Ne garde que les chiffres et limite à 4 caractères. */
export const normalizeDeliveryCode = (input: string): string =>
  input.replace(/\D/g, '').slice(0, 4);

export const isDeliveryCodeComplete = (input: string): boolean =>
  normalizeDeliveryCode(input).length === 4;

/** Comparaison tolérante aux espaces / caractères parasites saisis au clavier. */
export const verifyDeliveryCode = (input: string, expected?: string | null): boolean => {
  if (!expected) return false;
  const a = normalizeDeliveryCode(input);
  const b = normalizeDeliveryCode(String(expected));
  return a.length === 4 && a === b;
};

/** Le client doit-il voir son code ? (masqué une fois livrée ou annulée) */
export const shouldShowDeliveryCode = (status?: string, code?: string | null): boolean =>
  Boolean(code) && ACTIVE_STATUSES.has(status ?? '');
