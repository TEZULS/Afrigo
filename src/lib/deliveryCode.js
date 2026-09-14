/**
 * Code de confirmation de livraison à 4 chiffres (principe Uber).
 *
 * Généré à la création de la commande, affiché au client dans le suivi, et
 * exigé du livreur avant de pouvoir marquer la commande comme livrée.
 * Version web — miroir de `mob/src/utils/deliveryCode.ts`.
 */

/** Statuts pour lesquels le code doit rester visible côté client. */
const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'shipped', 'out_for_delivery'];

/** Génère un code à 4 chiffres, 1000-9999 (jamais de zéro en tête). */
export const generateDeliveryCode = () => String(1000 + Math.floor(Math.random() * 9000));

/** Ne garde que les chiffres et limite à 4 caractères. */
export const normalizeDeliveryCode = (input) => String(input ?? '').replace(/\D/g, '').slice(0, 4);

export const isDeliveryCodeComplete = (input) => normalizeDeliveryCode(input).length === 4;

/** Comparaison tolérante aux espaces / caractères parasites. */
export const verifyDeliveryCode = (input, expected) => {
  if (!expected) return false;
  const a = normalizeDeliveryCode(input);
  return a.length === 4 && a === normalizeDeliveryCode(expected);
};

/** Le client doit-il voir son code ? (masqué une fois livrée ou annulée) */
export const shouldShowDeliveryCode = (status, code) =>
  Boolean(code) && ACTIVE_STATUSES.includes(status);
