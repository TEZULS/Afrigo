import {
  translateAuthError,
  authErrorMessage,
  isEmailAlreadyRegistered,
  isEmailVerificationRequired,
  GENERIC_AUTH_ERROR,
} from '@/lib/authErrors';

describe('translateAuthError', () => {
  // Les messages non traduits sont journalisés en dev : on garde la sortie propre.
  beforeAll(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterAll(() => {
    (console.warn as jest.Mock).mockRestore();
  });

  it('traduit les messages de mot de passe en gardant la longueur exigée', () => {
    expect(translateAuthError('Password must be at least 8 characters long')).toBe(
      'Le mot de passe doit contenir au moins 8 caractères.',
    );
    expect(translateAuthError('Password must be at least 12 characters')).toBe(
      'Le mot de passe doit contenir au moins 12 caractères.',
    );
  });

  it('traduit les identifiants invalides', () => {
    expect(translateAuthError('Invalid email or password')).toBe(
      'Email ou mot de passe incorrect.',
    );
  });

  it('traduit un compte déjà existant', () => {
    expect(translateAuthError('User with this email already exists')).toBe(
      'Un compte existe déjà avec cet email.',
    );
  });

  it('traduit les erreurs de code de vérification', () => {
    expect(translateAuthError('Invalid or expired OTP code')).toContain('Code de vérification');
    expect(translateAuthError('The verification code has expired')).toContain('a expiré');
  });

  it('traduit les erreurs réseau', () => {
    expect(translateAuthError('Network Error')).toBe(
      'Connexion au serveur impossible. Vérifiez votre connexion internet.',
    );
  });

  it('laisse passer un message déjà rédigé en français', () => {
    const fr = 'Les mots de passe ne correspondent pas.';
    expect(translateAuthError(fr)).toBe(fr);
  });

  it('remplace un message anglais inconnu par un message générique français', () => {
    expect(translateAuthError('Something weird happened downstream')).toBe(GENERIC_AUTH_ERROR);
  });

  it('gère les messages vides', () => {
    expect(translateAuthError('')).toBe(GENERIC_AUTH_ERROR);
    expect(translateAuthError(undefined)).toBe(GENERIC_AUTH_ERROR);
  });
});

describe('authErrorMessage', () => {
  it('lit le message d’une erreur Base44', () => {
    expect(authErrorMessage(new Error('Invalid email or password'))).toBe(
      'Email ou mot de passe incorrect.',
    );
  });

  it('lit le message imbriqué dans response.data', () => {
    const err = { response: { data: { message: 'Password must be at least 8 characters long' } } };
    expect(authErrorMessage(err)).toBe('Le mot de passe doit contenir au moins 8 caractères.');
  });

  it('lit le champ `detail` du payload', () => {
    expect(authErrorMessage({ data: { detail: 'Too many requests' } })).toContain(
      'Trop de tentatives',
    );
  });

  it('retombe sur le message générique sans information exploitable', () => {
    expect(authErrorMessage({})).toBe(GENERIC_AUTH_ERROR);
  });
});

describe('détection des cas particuliers d’inscription', () => {
  it('reconnaît un email déjà enregistré', () => {
    expect(isEmailAlreadyRegistered(new Error('User already exists'))).toBe(true);
    expect(isEmailAlreadyRegistered(new Error('Invalid email or password'))).toBe(false);
  });

  it('reconnaît un email non vérifié', () => {
    expect(isEmailVerificationRequired(new Error('Please verify your email'))).toBe(true);
    expect(isEmailVerificationRequired(new Error('Email not verified'))).toBe(true);
    expect(isEmailVerificationRequired(new Error('Network Error'))).toBe(false);
  });
});
