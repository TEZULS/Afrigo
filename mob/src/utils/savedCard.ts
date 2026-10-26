/**
 * Carte bancaire enregistrée du client (2026-10-27) — même modèle que le site.
 *
 * Une seule carte par client, rangée sur son profil par la fonction `saveCard` :
 * `User.saved_payment_method_id` (moyen de paiement Stripe rattaché au client
 * Stripe `User.stripe_customer_id`) et `User.saved_card_info`, une chaîne JSON
 * `{ last4, brand, exp_month, exp_year }`. `deleteCard` la détache chez Stripe
 * et vide ces deux champs. Aucun numéro de carte n'est jamais stocké.
 */

export interface SavedCard {
  paymentMethodId: string;
  /** Réseau tel que Stripe le nomme : `visa`, `mastercard`, `amex`… */
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
}

const toNumber = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Carte enregistrée du profil, ou `null` (aucune, ou informations illisibles). */
export const savedCardOf = (user: Record<string, unknown> | null | undefined): SavedCard | null => {
  const paymentMethodId = user?.['saved_payment_method_id'];
  const raw = user?.['saved_card_info'];
  if (typeof paymentMethodId !== 'string' || !paymentMethodId.trim() || raw == null || raw === '') return null;
  let info: Record<string, unknown>;
  try {
    info = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!info || typeof info !== 'object') return null;
  const last4 = String(info['last4'] ?? '').trim();
  if (!/^\d{4}$/.test(last4)) return null;
  return {
    paymentMethodId: paymentMethodId.trim(),
    brand: String(info['brand'] ?? '').trim().toLowerCase(),
    last4,
    expMonth: toNumber(info['exp_month']),
    expYear: toNumber(info['exp_year']),
  };
};

const BRAND_LABELS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  jcb: 'JCB',
  unionpay: 'UnionPay',
  cartes_bancaires: 'CB',
};

/** « Visa », « Mastercard »… ; « Carte » quand le réseau est inconnu. */
export const cardBrandLabel = (brand: string): string => BRAND_LABELS[brand] ?? 'Carte';

/** « Visa •••• 4242 ». */
export const savedCardTitle = (card: SavedCard): string => `${cardBrandLabel(card.brand)} •••• ${card.last4}`;

/** « 03/2027 », ou chaîne vide si la date manque. */
export const formatCardExpiry = (card: SavedCard): string =>
  card.expMonth && card.expYear ? `${String(card.expMonth).padStart(2, '0')}/${card.expYear}` : '';

/** Titulaire transmis à Stripe (aide la banque à valider) : prénom + nom, sinon nom complet. */
export const cardholderNameOf = (user: Record<string, unknown> | null | undefined): string | undefined => {
  const name = [user?.['first_name'], user?.['last_name']]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
    .join(' ');
  const full = typeof user?.['full_name'] === 'string' ? user['full_name'].trim() : '';
  return name || full || undefined;
};

/** Carte expirée : valable jusqu'au dernier jour de son mois d'expiration. */
export const isCardExpired = (card: SavedCard, now: Date = new Date()): boolean => {
  if (!card.expMonth || !card.expYear) return false;
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return card.expYear < year || (card.expYear === year && card.expMonth < month);
};
