/**
 * Tests du code de confirmation de livraison à 4 chiffres (principe Uber).
 */
import {
  generateDeliveryCode,
  isDeliveryCodeComplete,
  normalizeDeliveryCode,
  shouldShowDeliveryCode,
  verifyDeliveryCode,
} from '@/utils/deliveryCode';

describe('generateDeliveryCode', () => {
  it('génère toujours 4 chiffres entre 1000 et 9999', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateDeliveryCode();
      expect(code).toMatch(/^\d{4}$/);
      expect(Number(code)).toBeGreaterThanOrEqual(1000);
      expect(Number(code)).toBeLessThanOrEqual(9999);
    }
  });
});

describe('normalizeDeliveryCode', () => {
  it('retire les caractères non numériques et tronque à 4', () => {
    expect(normalizeDeliveryCode('12 34')).toBe('1234');
    expect(normalizeDeliveryCode('12a3456')).toBe('1234');
    expect(normalizeDeliveryCode('abcd')).toBe('');
  });
});

describe('isDeliveryCodeComplete', () => {
  it('exige exactement 4 chiffres', () => {
    expect(isDeliveryCodeComplete('123')).toBe(false);
    expect(isDeliveryCodeComplete('1234')).toBe(true);
    expect(isDeliveryCodeComplete('1 2 3 4')).toBe(true);
  });
});

describe('verifyDeliveryCode', () => {
  it('valide le bon code', () => {
    expect(verifyDeliveryCode('4821', '4821')).toBe(true);
    expect(verifyDeliveryCode(' 4821 ', '4821')).toBe(true);
  });

  it('refuse un mauvais code, un code partiel ou une commande sans code', () => {
    expect(verifyDeliveryCode('4822', '4821')).toBe(false);
    expect(verifyDeliveryCode('482', '4821')).toBe(false);
    expect(verifyDeliveryCode('4821', undefined)).toBe(false);
    expect(verifyDeliveryCode('4821', '')).toBe(false);
  });
});

describe('shouldShowDeliveryCode', () => {
  it("affiche le code tant que la commande est en cours", () => {
    expect(shouldShowDeliveryCode('pending', '4821')).toBe(true);
    expect(shouldShowDeliveryCode('out_for_delivery', '4821')).toBe(true);
  });

  it('masque le code une fois la commande terminée', () => {
    expect(shouldShowDeliveryCode('delivered', '4821')).toBe(false);
    expect(shouldShowDeliveryCode('cancelled', '4821')).toBe(false);
    expect(shouldShowDeliveryCode('not_delivered', '4821')).toBe(false);
  });

  it('masque le bloc si la commande n’a pas de code', () => {
    expect(shouldShowDeliveryCode('pending', undefined)).toBe(false);
  });
});
