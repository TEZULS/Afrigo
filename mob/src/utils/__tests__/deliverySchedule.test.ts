/**
 * Tests du calcul « Prochaine livraison disponible » (bloc vert du checkout).
 */
import {
  getNextDelivery,
  isCurrentlyInSlot,
  slotNotPassed,
  type ScheduleDay,
} from '@/utils/deliverySchedule';

/** 2026-03-04 est un mercredi. */
const wednesday10h = new Date(2026, 2, 4, 10, 0, 0);
const wednesday22h = new Date(2026, 2, 4, 22, 0, 0);

const schedule: ScheduleDay[] = [
  { day: 'Mercredi', time_slots: ['09:00 - 12:00', '14:00 - 18:00'] },
  { day: 'Vendredi', time_slots: ['10:00 - 20:00'] },
];

describe('isCurrentlyInSlot', () => {
  it('détecte la plage en cours', () => {
    expect(isCurrentlyInSlot('09:00 - 12:00', wednesday10h)).toBe(true);
    expect(isCurrentlyInSlot('14:00 - 18:00', wednesday10h)).toBe(false);
  });

  it('renvoie false pour une plage non parsable', () => {
    expect(isCurrentlyInSlot('toute la journée', wednesday10h)).toBe(false);
  });
});

describe('slotNotPassed', () => {
  it('exclut les plages terminées', () => {
    expect(slotNotPassed('09:00 - 12:00', wednesday10h)).toBe(true);
    expect(slotNotPassed('09:00 - 12:00', wednesday22h)).toBe(false);
  });
});

describe('getNextDelivery', () => {
  it("propose aujourd'hui et masque les plages déjà passées", () => {
    const next = getNextDelivery(schedule, 0, new Date(2026, 2, 4, 13, 0, 0));
    expect(next?.label).toBe("Aujourd'hui");
    expect(next?.isToday).toBe(true);
    expect(next?.slots).toEqual(['14:00 - 18:00']);
  });

  it('bascule au jour ouvré suivant quand toutes les plages sont passées', () => {
    const next = getNextDelivery(schedule, 0, wednesday22h);
    expect(next?.label).toBe('Après-demain');
    expect(next?.offset).toBe(2);
    expect(next?.dateStr).toBe('6 mars');
  });

  it('respecte min_days_before_delivery', () => {
    const next = getNextDelivery(schedule, 1, wednesday10h);
    expect(next?.label).toBe('Après-demain');
    expect(next?.slots).toEqual(['10:00 - 20:00']);
  });

  it('affiche « Demain » à J+1', () => {
    // Jeudi 5 mars → prochaine livraison le vendredi 6.
    const next = getNextDelivery(schedule, 0, new Date(2026, 2, 5, 10, 0, 0));
    expect(next?.label).toBe('Demain');
  });

  it('retourne null sans planning', () => {
    expect(getNextDelivery([], 0, wednesday10h)).toBeNull();
    expect(getNextDelivery(undefined, 0, wednesday10h)).toBeNull();
  });

  it('gère une journée sans plage horaire (journée entière)', () => {
    const next = getNextDelivery([{ day: 'Mercredi' }], 0, wednesday22h);
    expect(next?.isToday).toBe(true);
    expect(next?.slots).toEqual([]);
  });
});

/**
 * Formats réellement présents en base (entité DeliveryZone) : les créneaux sont
 * saisis « 09h00-18h30 » et non « 09:00 - 18:30 ». Une plage vide ou un texte
 * libre ne doivent pas casser le calcul.
 */
describe('formats de créneaux réels', () => {
  const realSchedule: ScheduleDay[] = [
    { day: 'Mercredi', time_slots: ['09h00-18h30'] },
    { day: 'Jeudi', time_slots: ['09h00-18h30'] },
  ];

  it('parse le format « 09h00-18h30 »', () => {
    expect(isCurrentlyInSlot('09h00-18h30', wednesday10h)).toBe(true);
    expect(isCurrentlyInSlot('09h00-18h30', wednesday22h)).toBe(false);
    expect(slotNotPassed('09h00-18h30', wednesday22h)).toBe(false);
  });

  it('bascule à demain quand la plage « 09h00-18h30 » est terminée', () => {
    const next = getNextDelivery(realSchedule, 0, wednesday22h);
    expect(next?.label).toBe('Demain');
  });

  it('ignore les plages vides saisies par erreur (journée entière)', () => {
    const next = getNextDelivery([{ day: 'Mercredi', time_slots: ['', '  '] }], 0, wednesday22h);
    expect(next?.isToday).toBe(true);
    expect(next?.slots).toEqual([]);
  });

  it('laisse passer un texte libre non horaire sans le considérer comme expiré', () => {
    expect(slotNotPassed('Dans 2h', wednesday22h)).toBe(true);
    expect(isCurrentlyInSlot('Dans 2h', wednesday10h)).toBe(false);
  });
});

describe('format objet des créneaux (admin base44 depuis 2026-09)', () => {
  /** Tel que stocké en production : `{ time_slot, max_orders }` au lieu d'une chaîne. */
  const objectSchedule = [
    { day: 'Mercredi', time_slots: [{ time_slot: '09h00-18h30', max_orders: 10 }] },
    { day: 'Jeudi', time_slots: [{ time_slot: '09h00-18h30', max_orders: 100 }, '14h00-16h00'] },
  ] as ScheduleDay[];

  it('ne plante pas et lit la plage de l’objet', () => {
    const next = getNextDelivery(objectSchedule, 0, wednesday10h);
    expect(next?.isToday).toBe(true);
    expect(next?.slots).toEqual(['09h00-18h30']);
  });

  it('mélange objets et chaînes, et bascule au lendemain le soir', () => {
    const next = getNextDelivery(objectSchedule, 0, wednesday22h);
    expect(next?.label).toBe('Demain');
    expect(next?.slots).toEqual(['09h00-18h30', '14h00-16h00']);
  });
});
