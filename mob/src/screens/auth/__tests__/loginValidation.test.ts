import {
  validateRegisterPassword,
  validatePasswordConfirmation,
  validateRegisterForm,
  validateOtpCode,
  validateLoginEmail,
  validateLoginPassword,
  validateLoginForm,
} from '../loginValidation';

describe('loginValidation', () => {
  describe('validateLoginEmail', () => {
    it('rejects empty email', () => {
      expect(validateLoginEmail('')).toBe('Saisissez votre email.');
      expect(validateLoginEmail('   ')).toBe('Saisissez votre email.');
    });

    it('rejects invalid email', () => {
      expect(validateLoginEmail('not-an-email')).toBe('Email invalide.');
    });

    it('accepts valid email', () => {
      expect(validateLoginEmail('kanesanoussi04@gmail.com')).toBeNull();
    });
  });

  describe('validateLoginPassword', () => {
    it('rejects empty password', () => {
      expect(validateLoginPassword('')).toBe(
        'Le mot de passe doit faire au moins 6 caractères.',
      );
    });

    it('rejects short password', () => {
      expect(validateLoginPassword('12345')).toBe(
        'Le mot de passe doit faire au moins 6 caractères.',
      );
    });

    it('accepts password with 6+ chars', () => {
      expect(validateLoginPassword('secret1')).toBeNull();
    });
  });

  describe('validateLoginForm', () => {
    it('returns both errors when email and password are invalid', () => {
      expect(validateLoginForm('', '')).toEqual({
        emailError: 'Saisissez votre email.',
        passwordError: 'Le mot de passe doit faire au moins 6 caractères.',
      });
    });

    it('returns only password error when email is valid (Apple review scenario)', () => {
      expect(validateLoginForm('kanesanoussi04@gmail.com', '')).toEqual({
        emailError: null,
        passwordError: 'Le mot de passe doit faire au moins 6 caractères.',
      });
    });
  });
});

describe('validation inscription', () => {
  it('exige 8 caractères — la règle appliquée par Base44', () => {
    // Cas du bug remonté : « Kanesam » (7 car.) était accepté côté app puis
    // refusé par le serveur avec un message en anglais.
    expect(validateRegisterPassword('Kanesam')).toBe(
      'Le mot de passe doit contenir au moins 8 caractères.',
    );
    expect(validateRegisterPassword('Kanesamas')).toBeNull();
  });

  it('signale un mot de passe vide', () => {
    expect(validateRegisterPassword('')).toBe('Saisissez un mot de passe.');
  });

  it('vérifie la confirmation', () => {
    expect(validatePasswordConfirmation('Kanesamas', '')).toBe('Confirmez votre mot de passe.');
    expect(validatePasswordConfirmation('Kanesamas', 'Kanesama')).toBe(
      'Les mots de passe ne correspondent pas.',
    );
    expect(validatePasswordConfirmation('Kanesamas', 'Kanesamas')).toBeNull();
  });

  it('ne reproche pas la confirmation tant que le mot de passe est invalide', () => {
    expect(validateRegisterForm('marneprope@gmail.com', 'court', '')).toEqual({
      emailError: null,
      passwordError: 'Le mot de passe doit contenir au moins 8 caractères.',
      confirmError: null,
    });
  });

  it('accepte un formulaire complet valide', () => {
    expect(validateRegisterForm('marneprope@gmail.com', 'Kanesamas', 'Kanesamas')).toEqual({
      emailError: null,
      passwordError: null,
      confirmError: null,
    });
  });
});

describe('validateOtpCode', () => {
  it('exige 6 chiffres', () => {
    expect(validateOtpCode('')).toBe('Saisissez le code reçu par email.');
    expect(validateOtpCode('123')).toBe('Le code doit contenir 6 chiffres.');
    expect(validateOtpCode('12345a')).toBe('Le code doit contenir 6 chiffres.');
    expect(validateOtpCode(' 123456 ')).toBeNull();
    expect(validateOtpCode('123456')).toBeNull();
  });
});
