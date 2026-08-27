/**
 * Calcul du prochain créneau de livraison disponible pour une zone.
 *
 * Port fidèle de `src/components/checkout/DeliveryScheduleInfo.jsx` (web) afin
 * que le client voie exactement la même information sur mobile et sur le web :
 * « Prochaine livraison disponible → Aujourd'hui / Demain / … » avec les
 * plages horaires de la zone.
 *
 * `now` est injectable pour rendre la logique testable.
 */

export interface ScheduleDay {
  /** Nom du jour en français, tel que saisi dans AdminDeliveryZones (« Lundi »). */
  day: string;
  /** Plages « HH:MM - HH:MM ». Vide = journée entière. */
  time_slots?: string[];
}

export interface NextDelivery {
  /** « Aujourd'hui », « Demain », « Après-demain » ou le nom du jour. */
  label: string;
  /** Date formatée courte (« 14 mars ») — affichée à partir de J+2. */
  dateStr: string;
  date: Date;
  slots: string[];
  isToday: boolean;
  /** Nombre de jours entre aujourd'hui et la livraison. */
  offset: number;
}

export const DAY_NAMES_FR = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
] as const;

const MONTHS_FR = [
  'jan.',
  'fév.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sep.',
  'oct.',
  'nov.',
  'déc.',
] as const;

const formatDate = (date: Date): string => `${date.getDate()} ${MONTHS_FR[date.getMonth()]}`;

const parseSlot = (slot: string): { start: string; end: string } | null => {
  const parts = slot.split('-');
  if (parts.length < 2) return null;
  return { start: parts[0]!.trim(), end: parts[1]!.trim() };
};

/**
 * Accepte les formats réellement saisis dans AdminDeliveryZones : « 09h00 »,
 * « 09:00 », « 9h », « 9 ». Retourne null si la valeur n'est pas une heure
 * (ex. « Dans 2h ») — la plage est alors affichée telle quelle, sans calcul.
 */
const toMinutes = (raw: string): number | null => {
  const match = /^(\d{1,2})\s*[:hH.]?\s*(\d{1,2})?$/.exec(raw.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = match[2] != null ? Number(match[2]) : 0;
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
};

/** La plage est-elle en cours à l'instant `now` ? (pastille « 🟢 » côté UI) */
export const isCurrentlyInSlot = (slot: string, now: Date = new Date()): boolean => {
  const parsed = parseSlot(slot);
  if (!parsed) return false;
  const start = toMinutes(parsed.start);
  const end = toMinutes(parsed.end);
  if (start == null || end == null) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  return current >= start && current < end;
};

/** La plage est-elle encore ouverte aujourd'hui ? */
export const slotNotPassed = (slot: string, now: Date = new Date()): boolean => {
  const parsed = parseSlot(slot);
  if (!parsed) return true;
  const end = toMinutes(parsed.end);
  if (end == null) return true;
  return now.getHours() * 60 + now.getMinutes() < end;
};

/**
 * Première date de livraison possible en respectant `min_days_before_delivery`.
 * Retourne `null` si la zone n'a aucun jour ouvré dans les 30 prochains jours.
 */
export const getNextDelivery = (
  schedule: ScheduleDay[] | undefined,
  minDays = 0,
  now: Date = new Date(),
): NextDelivery | null => {
  const days = schedule ?? [];
  if (days.length === 0) return null;

  for (let offset = 0; offset <= 30; offset++) {
    if (offset < minDays) continue;

    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);

    const entry = days.find((d) => d.day === DAY_NAMES_FR[candidate.getDay()]);
    if (!entry) continue;

    // Les plages vides (« » saisi par erreur en admin) valent « journée entière ».
    const slots = (entry.time_slots ?? []).map((s) => s.trim()).filter(Boolean);
    const isToday = offset === 0;

    let availableSlots = slots;
    if (isToday) {
      availableSlots = slots.filter((s) => slotNotPassed(s, now));
      // Tous les créneaux du jour sont passés → on regarde le jour suivant.
      if (slots.length > 0 && availableSlots.length === 0) continue;
    }

    const label = isToday
      ? "Aujourd'hui"
      : offset === 1
        ? 'Demain'
        : offset === 2
          ? 'Après-demain'
          : DAY_NAMES_FR[candidate.getDay()]!;

    return {
      label,
      date: candidate,
      dateStr: formatDate(candidate),
      slots: availableSlots,
      isToday,
      offset,
    };
  }

  return null;
};
