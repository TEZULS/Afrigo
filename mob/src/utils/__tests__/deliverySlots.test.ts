import type { ScheduleDay } from '../deliverySchedule';
import {
  availableTableSlotsToday,
  availableZoneSlotsToday,
  formatDeliveryDay,
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

describe('availableZoneSlotsToday', () => {
  it('à 10:00, ne propose que les créneaux pas encore commencés, triés par heure', () => {
    const options = availableZoneSlotsToday(schedule, {}, wednesday10h);
    // 09h00 et 10h00 ont commencé ; 11h00 puis 14h00 restent.
    expect(options.map((o) => o.time_slot)).toEqual(['11h00-12h00', '14h00-15h00']);
  });

  it('ne propose que le jour même (les créneaux du jeudi n’apparaissent pas)', () => {
    const options = availableZoneSlotsToday(schedule, {}, wednesday10h);
    expect(options.some((o) => o.time_slot === '09h00-18h30')).toBe(false);
  });

  it('écarte un créneau complet', () => {
    const options = availableZoneSlotsToday(schedule, { '11h00': 10 }, wednesday10h);
    expect(options.map((o) => o.time_slot)).toEqual(['14h00-15h00']);
  });

  it('garde une clé stable (position dans la journée) pour distinguer deux plages identiques', () => {
    const twins: ScheduleDay[] = [
      { day: 'Mercredi', time_slots: ['12h00-13h00', '12h00-13h00'] },
    ];
    expect(availableZoneSlotsToday(twins, {}, wednesday10h).map((o) => o.key)).toEqual([
      'zone-0',
      'zone-1',
    ]);
  });

  it('rien quand la zone ne livre pas aujourd’hui ou que tout a commencé', () => {
    const evening = new Date(2026, 8, 23, 20, 0);
    expect(availableZoneSlotsToday(schedule, {}, evening)).toEqual([]);
    expect(availableZoneSlotsToday([{ day: 'Lundi', time_slots: ['09h00-12h00'] }], {}, wednesday10h)).toEqual([]);
  });
});

describe('availableTableSlotsToday', () => {
  const row = (id: string, date: string, time_slot: string, extra = {}) => ({
    id,
    date,
    time_slot,
    max_orders: 5,
    current_orders: 0,
    is_available: true,
    ...extra,
  });

  it('ne garde que les lignes d’aujourd’hui, disponibles, non complètes et pas commencées', () => {
    const options = availableTableSlotsToday(
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
    expect(options.map((o) => o.key)).toEqual(['soon', 'late']);
    expect(options[0]!.tableRow?.id).toBe('soon');
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
  });
});
