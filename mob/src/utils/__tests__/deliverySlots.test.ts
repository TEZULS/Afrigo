import type { ScheduleDay } from '../deliverySchedule';
import {
  availableZoneSlotsOn,
  formatRelativeDeliveryDay,
  nextTableSlots,
  zoneCandidateDays,
  formatDeliveryDay,
  formatPlannedDelivery,
  formatSlotDay,
  formatSlotRange,
  hasZoneTimeSlots,
  normalizeZoneSlot,
  slotHasStarted,
  splitSlotRange,
  toYmd,
  zoneDaySlots,
} from '../deliverySlots';

/** Mercredi 23 septembre 2026, 10 h. */
const wednesday10h = new Date(2026, 8, 23, 10, 0);

/** Horaires au format admin actuel (objets), saisis dans le désordre. */
const schedule: ScheduleDay[] = [
  {
    day: 'Mercredi',
    time_slots: [
      { time_slot: '14h00-15h00', max_orders: 10 },
      { time_slot: '10h00-11h00', max_orders: 10 },
      { time_slot: '11h00-12h00', max_orders: 10 },
      { time_slot: '09h00-10h00', max_orders: 10 },
    ],
  },
  { day: 'Jeudi', time_slots: [{ time_slot: '09h00-18h30', max_orders: 10 }] },
];

describe('availableZoneSlotsOn', () => {
  it('à 10:00, ne propose que les créneaux d’aujourd’hui pas encore commencés, triés par heure', () => {
    const options = availableZoneSlotsOn(schedule, wednesday10h, {}, wednesday10h);
    // 09h00 et 10h00 ont commencé ; 11h00 puis 14h00 restent.
    expect(options.map((o) => o.time_slot)).toEqual(['11h00-12h00', '14h00-15h00']);
  });

  it('un jour futur propose tous ses créneaux, même ceux du matin', () => {
    const thursday = new Date(2026, 8, 24);
    expect(availableZoneSlotsOn(schedule, thursday, {}, wednesday10h).map((o) => o.time_slot)).toEqual([
      '09h00-18h30',
    ]);
  });

  it('écarte un créneau complet', () => {
    const options = availableZoneSlotsOn(schedule, wednesday10h, { '11h00': 10 }, wednesday10h);
    expect(options.map((o) => o.time_slot)).toEqual(['14h00-15h00']);
  });

  it('garde une clé stable (position dans la journée) pour distinguer deux plages identiques', () => {
    const twins: ScheduleDay[] = [{ day: 'Mercredi', time_slots: ['12h00-13h00', '12h00-13h00'] }];
    expect(availableZoneSlotsOn(twins, wednesday10h, {}, wednesday10h).map((o) => o.key)).toEqual([
      'zone-0',
      'zone-1',
    ]);
  });
});

describe('zoneCandidateDays', () => {
  it('commence par aujourd’hui tant qu’il reste un créneau', () => {
    expect(zoneCandidateDays(schedule, wednesday10h).map(toYmd).slice(0, 3)).toEqual([
      '2026-09-23',
      '2026-09-24',
      '2026-09-30',
    ]);
  });

  it('plus rien aujourd’hui : le premier jour proposé est demain', () => {
    const evening = new Date(2026, 8, 23, 20, 0);
    expect(toYmd(zoneCandidateDays(schedule, evening)[0]!)).toBe('2026-09-24');
  });

  it('saute les jours sans livraison jusqu’au prochain jour livrable', () => {
    const mondayOnly: ScheduleDay[] = [{ day: 'Lundi', time_slots: ['09h00-12h00'] }];
    expect(toYmd(zoneCandidateDays(mondayOnly, wednesday10h)[0]!)).toBe('2026-09-28');
    expect(zoneCandidateDays([], wednesday10h)).toEqual([]);
  });
});

describe('nextTableSlots', () => {
  const row = (id: string, date: string, time_slot: string, extra = {}) => ({
    id,
    date,
    time_slot,
    max_orders: 5,
    current_orders: 0,
    is_available: true,
    ...extra,
  });

  it('garde les lignes d’aujourd’hui disponibles, non complètes et pas commencées', () => {
    const next = nextTableSlots(
      [
        row('late', '2026-09-23', '17:00-18:00'),
        row('started', '2026-09-23', '09:30-10:30'),
        row('tomorrow', '2026-09-24', '11:00-12:00'),
        row('full', '2026-09-23', '12:00-13:00', { current_orders: 5 }),
        row('off', '2026-09-23', '13:00-14:00', { is_available: false }),
        row('soon', '2026-09-23', '11:00 - 12:00'),
      ],
      wednesday10h,
    );
    expect(next?.date).toBe('2026-09-23');
    expect(next?.options.map((o) => o.key)).toEqual(['soon', 'late']);
    expect(next?.options[0]!.tableRow?.id).toBe('soon');
  });

  it('plus rien aujourd’hui : passe au jour suivant qui a des créneaux', () => {
    const next = nextTableSlots(
      [row('started', '2026-09-23', '09:30-10:30'), row('tomorrow', '2026-09-24', '08:00-09:00')],
      wednesday10h,
    );
    expect(next?.date).toBe('2026-09-24');
    expect(next?.options.map((o) => o.key)).toEqual(['tomorrow']);
    expect(nextTableSlots([row('old', '2026-09-22', '11:00-12:00')], wednesday10h)).toBeNull();
  });
});

describe('heures', () => {
  it('un créneau commence à son heure de début (formats « h » et « : »)', () => {
    expect(slotHasStarted('10h00-11h00', wednesday10h)).toBe(true);
    expect(slotHasStarted('11h00-12h00', wednesday10h)).toBe(false);
    expect(slotHasStarted('09:59-10:30', wednesday10h)).toBe(true);
    // Texte libre : jamais considéré comme commencé.
    expect(slotHasStarted('Dans 2h', wednesday10h)).toBe(false);
  });

  it('découpe et met en forme la plage', () => {
    expect(splitSlotRange('09h00-18h30')).toEqual({ start: '09h00', end: '18h30' });
    expect(formatSlotRange('09h00-23h30')).toBe('09h00 - 23h30');
  });
});

describe('horaires de zone', () => {
  it('lit les deux formats et applique la capacité par défaut', () => {
    expect(normalizeZoneSlot('09h00-18h30')).toEqual({ time_slot: '09h00-18h30', max_orders: 10 });
    expect(normalizeZoneSlot({ time_slot: ' 09h00-12h00 ', max_orders: 100 })).toEqual({
      time_slot: '09h00-12h00',
      max_orders: 100,
    });
    expect(normalizeZoneSlot({ time_slot: '09h00-12h00' }).max_orders).toBe(10);
  });

  it('renvoie les créneaux du jour de la semaine, sans les plages vides', () => {
    expect(zoneDaySlots(schedule, new Date(2026, 8, 24)).map((s) => s.time_slot)).toEqual([
      '09h00-18h30',
    ]);
    expect(zoneDaySlots([{ day: 'Jeudi', time_slots: ['', '  '] }], new Date(2026, 8, 24))).toEqual([]);
    expect(hasZoneTimeSlots([])).toBe(false);
    expect(hasZoneTimeSlots(schedule)).toBe(true);
  });
});

describe('libellés de date', () => {
  it('affiche le jour comme le site, en heure locale', () => {
    expect(formatDeliveryDay(new Date(2026, 8, 23))).toBe('Mercredi 23 Sept.');
    expect(formatSlotDay('2026-09-27')).toBe('Dimanche 27 Sept.');
    expect(formatSlotDay('2026-01-01')).toBe('Jeudi 01 Janv.');
    expect(toYmd(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatRelativeDeliveryDay(new Date(2026, 8, 23), wednesday10h)).toBe(
      "Aujourd'hui · Mercredi 23 Sept.",
    );
    expect(formatRelativeDeliveryDay(new Date(2026, 8, 24), wednesday10h)).toBe('Demain · Jeudi 24 Sept.');
    expect(formatRelativeDeliveryDay(new Date(2026, 8, 30), wednesday10h)).toBe('Mercredi 30 Sept.');
  });
});

describe('formatPlannedDelivery', () => {
  /** Loin des dates testées : le jour s'écrit en chiffres. */
  const later = new Date(2026, 10, 15);
  /** Jeudi 24 septembre 2026, 10 h. */
  const thursday = new Date(2026, 8, 24, 10, 0);

  it('jour proche en toutes lettres', () => {
    const at = (estimated_delivery: string) =>
      formatPlannedDelivery({ estimated_delivery, delivery_time_slot: '17:00-18:30' }, thursday);
    expect(at('2026-09-24')).toBe("Aujourd'hui entre 17:00 - 18:30");
    expect(at('2026-09-25')).toBe('Demain entre 17:00 - 18:30');
    expect(at('2026-09-26')).toBe('Après-demain entre 17:00 - 18:30');
    expect(at('2026-09-23')).toBe('Hier entre 17:00 - 18:30');
    expect(at('2026-09-27')).toBe('27-09-2026 entre 17:00 - 18:30');
    // Facture : toujours la date en chiffres.
    expect(
      formatPlannedDelivery({ estimated_delivery: '2026-09-25', delivery_time_slot: '17:00-18:30' }, thursday, false),
    ).toBe('25-09-2026 entre 17:00 - 18:30');
  });

  it('jour au format JJ-MM-AAAA puis le créneau', () => {
    expect(
      formatPlannedDelivery({
        estimated_delivery: '2026-09-27',
        delivery_time: '17:00',
        delivery_time_slot: '17:00-18:30',
      }, later),
    ).toBe('27-09-2026 entre 17:00 - 18:30');
  });

  it('sans créneau : l’heure seule, sinon la date', () => {
    expect(formatPlannedDelivery({ estimated_delivery: '2026-09-27', delivery_time: '17:00' }, later)).toBe(
      '27-09-2026 à 17:00',
    );
    expect(formatPlannedDelivery({ estimated_delivery: '2026-09-27' }, later)).toBe('27-09-2026');
    expect(formatPlannedDelivery({ estimated_delivery: '' })).toBe('');
  });
});
