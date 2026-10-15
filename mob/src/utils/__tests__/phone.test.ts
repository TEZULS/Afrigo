import {
  formatFrenchPhone,
  isCompleteFrenchPhone,
  validatePhone,
  validatePhoneConfirmation,
} from '../phone';

describe('formatFrenchPhone', () => {
  it('ajoute +33 et regroupe les chiffres deux par deux', () => {
    expect(formatFrenchPhone('772211798')).toBe('+33 7 72 21 17 98');
    expect(formatFrenchPhone('0772211798')).toBe('+33 7 72 21 17 98');
    expect(formatFrenchPhone('+33772211798')).toBe('+33 7 72 21 17 98');
    expect(formatFrenchPhone('+33 07 72 21 17 98'.replace('07', '7'))).toBe('+33 7 72 21 17 98');
  });

  it('forme les groupes pendant la saisie et garde l’indicatif', () => {
    expect(formatFrenchPhone('')).toBe('+33 ');
    expect(formatFrenchPhone('+33 ')).toBe('+33 ');
    expect(formatFrenchPhone('+33 7')).toBe('+33 7');
    expect(formatFrenchPhone('+33 772')).toBe('+33 7 72');
    expect(formatFrenchPhone('+33 7 72 2')).toBe('+33 7 72 2');
  });

  it('efface le 0 tapé après +33 dès le chiffre suivant', () => {
    expect(formatFrenchPhone('+33 0')).toBe('+33 0');
    expect(formatFrenchPhone('+33 07')).toBe('+33 7');
    expect(formatFrenchPhone('+33 0 72 53 64 57')).toBe('+33 7 25 36 45 7');
    expect(formatFrenchPhone('+33 0725364577')).toBe('+33 7 25 36 45 77');
    expect(validatePhone('+33 0')).toBe('Saisissez votre numéro de téléphone.');
  });

  it('ignore les chiffres en trop', () => {
    expect(formatFrenchPhone('07722117981234')).toBe('+33 7 72 21 17 98');
  });
});

describe('validation', () => {
  it('exige 9 chiffres après +33', () => {
    expect(isCompleteFrenchPhone('+33 7 72 21 17 98')).toBe(true);
    expect(validatePhone('+33 ')).toMatch(/Saisissez/);
    expect(validatePhone('+33 7 72')).toMatch(/incomplet/);
    expect(validatePhone('+33 7 72 21 17 98')).toBeNull();
  });

  it('les deux saisies doivent être identiques', () => {
    expect(validatePhoneConfirmation('+33 7 72 21 17 98', '+33 7 72 21 17 98')).toBeNull();
    expect(validatePhoneConfirmation('+33 7 72 21 17 98', '+33 7 72 21 17 99')).toMatch(/correspondent pas/);
    expect(validatePhoneConfirmation('+33 7 72 21 17 98', '+33 ')).toMatch(/Confirmez/);
  });
});
