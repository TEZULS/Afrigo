/**
 * Créneaux de livraison proposés au client.
 *
 * Règles (demande du 2026-09-23) :
 * - le client ne choisit qu'un créneau **du jour même** (ni le lendemain, ni après) ;
 * - seuls les créneaux **pas encore commencés** sont proposés : à 10:00, le
 *   créneau 10:00-11:00 n'est plus choisissable, 11:00-12:00 et les suivants oui ;
 * - un créneau complet n'est pas proposé, et le nombre de places n'est jamais affiché.
 *
 * Deux sources, dans l'ordre du site :
 * - les horaires de la zone (`DeliveryZone.delivery_schedule`), dont chaque
 *   créneau porte sa capacité ; les places prises viennent de la fonction
 *   `getDeliverySlotCounts` (commandes du jour par heure de début) ;
 * - à défaut, la table `DeliverySlot` (réglage `delivery_slots_enabled`).
 */

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  DAY_NAMES_FR,
  scheduleSlotLabel,
  type ScheduleDay,
  type ScheduleSlotObject,
} from './deliverySchedule';

/** Ligne de la table `DeliverySlot`. */
export interface DeliverySlotRow {
  id: string;
  date?: string;
  time_slot?: string;
  max_orders?: number;
  current_orders?: number;
  is_available?: boolean;
}

/** Créneau des horaires de zone, normalisé. */
export interface ZoneSlot {
  time_slot: string;
  max_orders: number;
}

/** Créneau proposable au client (quelle que soit sa source). */
export interface SlotOption {
  /** Identifiant stable dans la liste (`zone-2`, ou l'id de la ligne `DeliverySlot`). */
  key: string;
  time_slot: string;
  /** Ligne `DeliverySlot` d'origine : sa jauge est incrémentée à la commande. */
  tableRow?: DeliverySlotRow;
}

/** Capacité d'un créneau quand l'admin n'en a pas fixé (valeur du site). */
export const DEFAULT_SLOT_CAPACITY = 10;

/** Normalise un créneau de zone : ancien format (chaîne) ou nouveau (objet). */
export const normalizeZoneSlot = (raw: string | ScheduleSlotObject | null | undefined): ZoneSlot => {
  if (typeof raw === 'string') return { time_slot: raw.trim(), max_orders: DEFAULT_SLOT_CAPACITY };
  const max = Number(raw?.max_orders);
  return {
    time_slot: scheduleSlotLabel(raw).trim(),
    max_orders: Number.isFinite(max) && max > 0 ? max : DEFAULT_SLOT_CAPACITY,
  };
};

/** La zone a-t-elle au moins un créneau saisi ? (condition d'affichage du site) */
export const hasZoneTimeSlots = (schedule: ScheduleDay[] | undefined): boolean =>
  (schedule ?? []).some((d) => (d.time_slots ?? []).length > 0);

/** Créneaux (non vides) de la zone pour le jour de la semaine de `date`. */
export const zoneDaySlots = (schedule: ScheduleDay[] | undefined, date: Date): ZoneSlot[] => {
  const entry = (schedule ?? []).find((d) => d.day === DAY_NAMES_FR[date.getDay()]);
  return (entry?.time_slots ?? []).map(normalizeZoneSlot).filter((s) => s.time_slot);
};

/** `09h00-18h30` → `{ start: '09h00', end: '18h30' }`. */
export const splitSlotRange = (timeSlot?: string): { start: string; end: string } => {
  const [start = '', end = ''] = (timeSlot ?? '').split('-').map((p) => p.trim());
  return { start, end };
};

/** `09h00-18h30` → `09h00 - 18h30`. */
export const formatSlotRange = (timeSlot?: string): string => {
  const { start, end } = splitSlotRange(timeSlot);
  return end ? `${start} - ${end}` : start;
};

/** Minutes depuis minuit : « 11h00 », « 11:00 », « 11h », « 11 » ; `null` si ce n'est pas une heure. */
const toMinutes = (raw: string): number | null => {
  const m = /^(\d{1,2})\s*[:hH.]?\s*(\d{1,2})?$/.exec(raw.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] != null ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

/** Heure de début en minutes (`null` pour un texte libre comme « Dans 2h »). */
export const slotStartMinutes = (timeSlot?: string): number | null =>
  toMinutes(splitSlotRange(timeSlot).start);

/**
 * Le créneau a-t-il commencé ? (heure de début atteinte ou dépassée)
 * Un texte libre sans heure n'est jamais considéré comme commencé.
 */
export const slotHasStarted = (timeSlot: string | undefined, now: Date = new Date()): boolean => {
  const start = slotStartMinutes(timeSlot);
  if (start == null) return false;
  return now.getHours() * 60 + now.getMinutes() >= start;
};

/** Tri par heure de début (les plages sans heure en dernier), ordre de saisie conservé sinon. */
const byStart = <T extends { time_slot: string }>(a: T, b: T): number =>
  (slotStartMinutes(a.time_slot) ?? Number.MAX_SAFE_INTEGER) -
  (slotStartMinutes(b.time_slot) ?? Number.MAX_SAFE_INTEGER);

/** Date locale → `2026-09-27` (format de `Order.estimated_delivery`). */
export const toYmd = (date: Date): string => {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
};

/** `Mercredi 23 Sept.` — chaque mot en majuscule, comme le site. */
export const formatDeliveryDay = (date: Date): string =>
  format(date, 'EEEE dd MMM', { locale: fr })
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** `2026-09-27` → `Dimanche 27 Sept.` (jour lu en heure locale, sans décalage de fuseau). */
export const formatSlotDay = (ymd: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '');
  if (!m) return ymd ?? '';
  return formatDeliveryDay(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
};

/**
 * Créneaux de zone proposables **aujourd'hui** : pas encore commencés et pas
 * complets (`counts` = places prises par heure de début, via `getDeliverySlotCounts`).
 */
export const availableZoneSlotsToday = (
  schedule: ScheduleDay[] | undefined,
  counts: Record<string, number>,
  now: Date = new Date(),
): SlotOption[] =>
  zoneDaySlots(schedule, now)
    .map((slot, index) => ({ ...slot, key: `zone-${index}` }))
    .filter((slot) => !slotHasStarted(slot.time_slot, now))
    .filter((slot) => (Number(counts[splitSlotRange(slot.time_slot).start]) || 0) < slot.max_orders)
    .sort(byStart)
    .map(({ key, time_slot }) => ({ key, time_slot }));

/**
 * Lignes `DeliverySlot` proposables **aujourd'hui** : disponibles, pas encore
 * commencées et pas complètes.
 */
export const availableTableSlotsToday = (
  rows: DeliverySlotRow[],
  now: Date = new Date(),
): SlotOption[] => {
  const today = toYmd(now);
  return rows
    .filter(
      (row) =>
        row.is_available !== false &&
        row.date?.slice(0, 10) === today &&
        Boolean(row.time_slot?.trim()) &&
        (row.current_orders ?? 0) < (row.max_orders ?? Number.MAX_SAFE_INTEGER) &&
        !slotHasStarted(row.time_slot, now),
    )
    .map((row) => ({ key: row.id, time_slot: row.time_slot!.trim(), tableRow: row }))
    .sort(byStart);
};
