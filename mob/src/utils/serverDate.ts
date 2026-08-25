/**
 * Dates renvoyées par base44.
 *
 * `created_date` / `updated_date` sont en **UTC sans indicateur de fuseau**
 * (`2026-09-12T07:29:00.123000`), alors que les dates écrites par les apps
 * (`delivered_date`, `read_date`…) portent un `Z`. Or JavaScript interprète
 * une date-heure ISO sans fuseau comme une heure **locale** : une commande
 * passée à 09:29 (Paris, UTC+2) s'affichait « 07:29 », et le délai de retour
 * de 2 h après livraison était consommé d'avance.
 *
 * Règle : sans indicateur de fuseau → UTC. Une date seule (`2026-09-14`,
 * livraison prévue) reste une date locale.
 */

/** Date-heure ISO sans `Z` ni décalage `±hh:mm`. */
const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

const normalizeNaive = (iso: string): string => {
  // Fraction limitée à 3 chiffres : tous les moteurs n'acceptent pas les microsecondes.
  const trimmed = iso.replace(' ', 'T').replace(/(\.\d{3})\d+$/, '$1');
  return `${trimmed}Z`;
};

/** `Date` correspondant à une valeur serveur ; `Invalid Date` si illisible. */
export const parseServerDate = (value: string | number | Date | null | undefined): Date => {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  if (!value) return new Date(NaN);
  const s = String(value).trim();
  return new Date(NAIVE_DATETIME.test(s) ? normalizeNaive(s) : s);
};

/** Horodatage en ms, `0` si absent ou illisible. */
export const serverDateMs = (value: string | number | Date | null | undefined): number => {
  const ms = parseServerDate(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

/** Heures écoulées depuis une date serveur ; `Infinity` si absente/illisible. */
export const hoursSince = (value: string | number | Date | null | undefined, now = Date.now()): number => {
  const ms = parseServerDate(value).getTime();
  if (!Number.isFinite(ms)) return Infinity;
  return (now - ms) / 36e5;
};
