/**
 * Créneaux de livraison proposés au client.
 *
 * Règles (demandes des 2026-09-23 et 2026-09-24) :
 * - un seul jour est proposé : **aujourd'hui** tant qu'il reste un créneau, sinon
 *   automatiquement le **prochain jour livrable** (demain, ou le suivant) ;
 * - aujourd'hui, seuls les créneaux **pas encore commencés** sont proposés : à
 *   10:00, le créneau 10:00-11:00 n'est plus choisissable, 11:00-12:00 oui ;
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
/** Nombre de jours examinés (aujourd'hui compris) pour trouver le prochain jour livrable. */
export const SLOT_LOOKAHEAD_DAYS = 14;

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

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Jours proches en toutes lettres, sinon `JJ-MM-AAAA`. */
const NEAR_DAYS: Record<number, string> = {
  [-1]: 'Hier',
  0: "Aujourd'hui",
  1: 'Demain',
  2: 'Après-demain',
};

const relativeDayLabel = (year: number, month: number, day: number, now: Date): string => {
  const target = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const offset = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  return (
    NEAR_DAYS[offset] ??
    `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`
  );
};

/** Minuit local, `offset` jours après `now`. */
const dayAfter = (now: Date, offset: number): Date =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);

/** `Aujourd'hui · Mercredi 23 Sept.`, `Demain · Jeudi 24 Sept.` ou `Vendredi 26 Sept.`. */
export const formatRelativeDeliveryDay = (day: Date, now: Date = new Date()): string => {
  const label = formatDeliveryDay(day);
  if (isSameDay(day, now)) return `Aujourd'hui · ${label}`;
  if (isSameDay(day, dayAfter(now, 1))) return `Demain · ${label}`;
  return label;
};

/**
 * Créneaux de zone proposables le jour `day` : pas complets
 * (`counts` = places prises par heure de début, via `getDeliverySlotCounts`)
 * et, si `day` est aujourd'hui, pas encore commencés.
 */
export const availableZoneSlotsOn = (
  schedule: ScheduleDay[] | undefined,
  day: Date,
  counts: Record<string, number>,
  now: Date = new Date(),
): SlotOption[] => {
  const today = isSameDay(day, now);
  return zoneDaySlots(schedule, day)
    .map((slot, index) => ({ ...slot, key: `zone-${index}` }))
    .filter((slot) => !today || !slotHasStarted(slot.time_slot, now))
    .filter((slot) => (Number(counts[splitSlotRange(slot.time_slot).start]) || 0) < slot.max_orders)
    .sort(byStart)
    .map(({ key, time_slot }) => ({ key, time_slot }));
};

/**
 * Jours où la zone livre encore, dans l'ordre (aujourd'hui s'il reste un
 * créneau pas commencé, puis les jours suivants). Les places prises ne sont
 * connues qu'une fois le jour choisi : un jour complet est sauté ensuite.
 */
export const zoneCandidateDays = (
  schedule: ScheduleDay[] | undefined,
  now: Date = new Date(),
): Date[] => {
  const days: Date[] = [];
  for (let offset = 0; offset < SLOT_LOOKAHEAD_DAYS; offset++) {
    const day = dayAfter(now, offset);
    if (availableZoneSlotsOn(schedule, day, {}, now).length > 0) days.push(day);
  }
  return days;
};

/**
 * Prochain jour de la table `DeliverySlot` qui a un créneau proposable :
 * disponible, pas complet et, aujourd'hui, pas encore commencé.
 */
export const nextTableSlots = (
  rows: DeliverySlotRow[],
  now: Date = new Date(),
): { date: string; options: SlotOption[] } | null => {
  const today = toYmd(now);
  const byDate = new Map<string, SlotOption[]>();
  for (const row of rows) {
    const date = row.date?.slice(0, 10);
    const timeSlot = row.time_slot?.trim();
    if (!date || date < today || !timeSlot) continue;
    if (row.is_available === false) continue;
    if ((row.current_orders ?? 0) >= (row.max_orders ?? Number.MAX_SAFE_INTEGER)) continue;
    if (date === today && slotHasStarted(timeSlot, now)) continue;
    const list = byDate.get(date) ?? [];
    list.push({ key: row.id, time_slot: timeSlot, tableRow: row });
    byDate.set(date, list);
  }
  const first = [...byDate.keys()].sort()[0];
  return first ? { date: first, options: byDate.get(first)!.sort(byStart) } : null;
};

/**
 * Livraison prévue d'une commande : `Demain entre 17:00 - 18:30` (créneau
 * connu), sinon `Demain à 17:00`, sinon le jour seul. Un jour proche est écrit
 * en toutes lettres (« Hier », « Aujourd'hui », « Demain », « Après-demain »),
 * les autres au format `27-09-2026`.
 */
export const formatPlannedDelivery = (
  order: {
    estimated_delivery?: string | null;
    delivery_time?: string | null;
    delivery_time_slot?: string | null;
  },
  now: Date = new Date(),
  /** `false` : toujours la date en chiffres (facture, relue plus tard). */
  relative = true,
): string => {
  const raw = (order.estimated_delivery ?? '').trim();
  if (!raw) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  const date = m
    ? relative
      ? relativeDayLabel(Number(m[1]), Number(m[2]), Number(m[3]), now)
      : `${m[3]}-${m[2]}-${m[1]}`
    : raw;
  const slot = order.delivery_time_slot?.trim();
  if (slot) return `${date} entre ${formatSlotRange(slot)}`;
  const time = order.delivery_time?.trim();
  return time ? `${date} à ${time}` : date;
};
