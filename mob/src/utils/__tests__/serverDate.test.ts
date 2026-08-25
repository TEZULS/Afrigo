import { hoursSince, parseServerDate, serverDateMs } from '../serverDate';
import { formatDateTime } from '../format';

describe('parseServerDate', () => {
  it('lit une date-heure sans fuseau (created_date base44) comme de l’UTC', () => {
    // Commande passée à 09:29 heure de Paris (UTC+2) → base44 stocke 07:29 sans `Z`.
    const d = parseServerDate('2026-09-12T07:29:00.123000');
    expect(d.toISOString()).toBe('2026-09-12T07:29:00.123Z');
  });

  it('respecte un fuseau explicite (delivered_date écrit par l’app)', () => {
    expect(parseServerDate('2026-09-13T17:53:12.748Z').toISOString()).toBe(
      '2026-09-13T17:53:12.748Z',
    );
    expect(parseServerDate('2026-09-13T19:53:12+02:00').toISOString()).toBe(
      '2026-09-13T17:53:12.000Z',
    );
  });

  it('même instant que la date `Z` écrite au même moment', () => {
    // Cas réel : delivered_date (Z) et updated_date (sans Z) à 0,25 s d’écart.
    const delivered = parseServerDate('2026-09-13T17:53:12.748Z').getTime();
    const updated = parseServerDate('2026-09-13T17:53:12.997000').getTime();
    expect(Math.abs(updated - delivered)).toBeLessThan(1000);
  });

  it('garde une date seule (livraison prévue) telle quelle', () => {
    const d = parseServerDate('2026-09-14');
    expect(Number.isNaN(d.getTime())).toBe(false);
    expect(d.getFullYear()).toBe(2026);
  });

  it('accepte Date, nombre, et renvoie Invalid Date sinon', () => {
    const now = new Date();
    expect(parseServerDate(now)).toBe(now);
    expect(parseServerDate(now.getTime()).getTime()).toBe(now.getTime());
    expect(Number.isNaN(parseServerDate('not-a-date').getTime())).toBe(true);
    expect(Number.isNaN(parseServerDate(undefined).getTime())).toBe(true);
    expect(serverDateMs(null)).toBe(0);
  });
});

describe('hoursSince', () => {
  it('compte depuis l’instant UTC, pas depuis l’heure locale', () => {
    const now = Date.parse('2026-09-12T08:29:00Z');
    expect(hoursSince('2026-09-12T07:29:00.000000', now)).toBeCloseTo(1, 5);
    expect(hoursSince('2026-09-12T07:29:00.000Z', now)).toBeCloseTo(1, 5);
  });

  it('Infinity sans date', () => {
    expect(hoursSince(undefined)).toBe(Infinity);
    expect(hoursSince('')).toBe(Infinity);
  });
});

describe('formatDateTime', () => {
  it('affiche l’heure locale d’une date serveur sans fuseau', () => {
    const naive = '2026-09-12T07:29:00.000000';
    const expected = formatDateTime(new Date('2026-09-12T07:29:00.000Z'));
    expect(formatDateTime(naive)).toBe(expected);
  });
});
