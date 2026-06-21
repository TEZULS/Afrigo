/**
 * Tests des règles de validation côté client (Login, ProfileEdit, Checkout).
 */

const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

const isPhone = (p: string) => /^\+?[\d\s().-]{6,}$/.test(p.trim());

const isPostalCode = (cp: string) => /^[A-Za-z0-9 -]{2,10}$/.test(cp.trim());

/** Aligné sur la conversion ProfileScreen.formatPhone côté web. */
const formatPhone = (phone: string): string => {
  if (!phone) return phone;
  const cleaned = phone.replace(/[\s\-.]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('0')) return '+33' + cleaned.slice(1);
  if (cleaned.startsWith('33') && cleaned.length >= 11) return '+' + cleaned;
  return '+33' + cleaned;
};

describe('isEmail', () => {
  it('accepte les emails valides', () => {
    expect(isEmail('test@x.fr')).toBe(true);
    expect(isEmail('user.name+tag@example.co.uk')).toBe(true);
    expect(isEmail('first.last@gmail.com')).toBe(true);
  });
  it('rejette les emails invalides', () => {
    expect(isEmail('foo')).toBe(false);
    expect(isEmail('foo@')).toBe(false);
    expect(isEmail('@x.fr')).toBe(false);
    expect(isEmail('foo@x')).toBe(false);
    expect(isEmail('foo @x.fr')).toBe(false);
    expect(isEmail('')).toBe(false);
  });
});

describe('isPhone', () => {
  it('accepte les numéros français formats variés', () => {
    expect(isPhone('+33 6 12 34 56 78')).toBe(true);
    expect(isPhone('06.12.34.56.78')).toBe(true);
    expect(isPhone('06-12-34-56-78')).toBe(true);
    expect(isPhone('0612345678')).toBe(true);
    expect(isPhone('(33) 6-12-34-56-78')).toBe(true);
  });
  it('rejette les numéros trop courts ou avec lettres', () => {
    expect(isPhone('123')).toBe(false);
    expect(isPhone('06 12 ABC')).toBe(false);
  });
});

describe('isPostalCode', () => {
  it('accepte CP français 5 chiffres', () => {
    expect(isPostalCode('55000')).toBe(true);
    expect(isPostalCode('75001')).toBe(true);
    expect(isPostalCode('51100')).toBe(true);
  });
  it('accepte CP avec lettres (UK, etc.)', () => {
    expect(isPostalCode('SW1A 1AA')).toBe(true);
  });
  it('rejette les CP trop courts ou trop longs', () => {
    expect(isPostalCode('1')).toBe(false);
    expect(isPostalCode('123456789012345')).toBe(false);
  });
});

describe('formatPhone (FR)', () => {
  it('préfixe +33 sur un numéro 0X', () => {
    expect(formatPhone('0612345678')).toBe('+33612345678');
  });
  it("garde le + initial", () => {
    expect(formatPhone('+33612345678')).toBe('+33612345678');
  });
  it("ajoute + sur un numéro commençant par 33", () => {
    expect(formatPhone('33612345678')).toBe('+33612345678');
  });
  it('strip espaces, points, tirets', () => {
    expect(formatPhone('06 12.34-56 78')).toBe('+33612345678');
  });
});
