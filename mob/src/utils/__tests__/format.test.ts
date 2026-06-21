import { formatPrice, truncate, initials, formatDate } from '../format';

describe('formatPrice', () => {
  it('formate un nombre en EUR fr-FR', () => {
    const out = formatPrice(4.99);
    expect(out).toMatch(/4,99/);
    expect(out).toContain('€');
  });

  it('accepte une chaîne numérique', () => {
    const out = formatPrice('92.07');
    expect(out).toMatch(/92,07/);
  });

  it('retourne 0,00 € pour null/undefined', () => {
    expect(formatPrice(null)).toMatch(/0,00/);
    expect(formatPrice(undefined)).toMatch(/0,00/);
  });

  it('retourne 0,00 € pour une chaîne non numérique', () => {
    expect(formatPrice('not a number')).toMatch(/0,00/);
  });
});

describe('truncate', () => {
  it('renvoie chaîne vide pour null/undefined', () => {
    expect(truncate(null, 5)).toBe('');
    expect(truncate(undefined, 5)).toBe('');
  });

  it('coupe et ajoute …', () => {
    expect(truncate('Hello world', 5)).toBe('Hell…');
  });

  it('laisse intact si la longueur est sous la limite', () => {
    expect(truncate('hi', 10)).toBe('hi');
  });
});

describe('initials', () => {
  it('renvoie les deux premières initiales en majuscules', () => {
    expect(initials('Nassim Essid')).toBe('NE');
    expect(initials('marie dupont')).toBe('MD');
  });

  it('gère un nom unique', () => {
    expect(initials('Cher')).toBe('C');
  });

  it('renvoie chaîne vide pour entrée vide', () => {
    expect(initials(undefined)).toBe('');
    expect(initials('')).toBe('');
    expect(initials('   ')).toBe('');
  });
});

describe('formatDate', () => {
  it('renvoie une chaîne pour une date valide', () => {
    const out = formatDate('2026-05-07');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(3);
  });

  it("renvoie la valeur d'origine si parse impossible", () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});
