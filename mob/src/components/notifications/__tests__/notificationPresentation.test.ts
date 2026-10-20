import { notificationDateLabel, notificationReceivedLabel } from '../notificationPresentation';

/** Heure locale du téléphone → ISO UTC (comme une date base44 avec Z). */
const at = (y: number, m: number, d: number, h: number, min: number) => new Date(y, m - 1, d, h, min).toISOString();
const NOW = new Date(2026, 9, 20, 18, 30).getTime(); // mardi 20 octobre 2026, 18h30

describe('notificationDateLabel — « aujourd’hui, hier à 17h… »', () => {
  it('à l’instant, puis en minutes pendant la première heure', () => {
    expect(notificationDateLabel(at(2026, 10, 20, 18, 30), NOW + 30_000)).toBe("À l'instant");
    expect(notificationDateLabel(at(2026, 10, 20, 18, 29), NOW + 30_000)).toBe('Il y a 1 min');
    expect(notificationDateLabel(at(2026, 10, 20, 18, 18), NOW)).toBe('Il y a 12 min');
  });

  it('aujourd’hui et hier avec l’heure', () => {
    expect(notificationDateLabel(at(2026, 10, 20, 9, 5), NOW)).toBe("Aujourd'hui à 9h05");
    expect(notificationDateLabel(at(2026, 10, 19, 17, 0), NOW)).toBe('Hier à 17h00');
    expect(notificationDateLabel(at(2026, 10, 19, 23, 59), NOW)).toBe('Hier à 23h59');
  });

  it('jour de la semaine pendant 7 jours, puis la date', () => {
    expect(notificationDateLabel(at(2026, 10, 16, 8, 30), NOW)).toBe('Vendredi à 8h30');
    expect(notificationDateLabel(at(2026, 10, 12, 19, 33), NOW)).toBe('12 oct. à 19h33');
    expect(notificationDateLabel(at(2025, 12, 24, 10, 0), NOW)).toBe('24 déc. 2025 à 10h00');
  });

  it('date base44 sans fuseau (UTC) et date illisible', () => {
    const utcNaive = new Date(NOW - 3 * 3600_000).toISOString().replace('Z', '000');
    expect(notificationDateLabel(utcNaive, NOW)).toMatch(/^Aujourd'hui à \d{1,2}h\d{2}$/);
    expect(notificationDateLabel('pas une date', NOW)).toBe('');
    expect(notificationDateLabel(null, NOW)).toBe('');
  });

  it('fiche de détail : « Reçue hier à 17h00 », « Reçue le 12 oct. à 19h33 »', () => {
    expect(notificationReceivedLabel(at(2026, 10, 19, 17, 0), NOW)).toBe('Reçue hier à 17h00');
    expect(notificationReceivedLabel(at(2026, 10, 12, 19, 33), NOW)).toBe('Reçue le 12 oct. à 19h33');
    expect(notificationReceivedLabel(at(2026, 10, 20, 18, 18), NOW)).toBe('Reçue il y a 12 min');
  });
});
