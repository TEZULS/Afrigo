/** Validation pure pour les écrans Connexion / Inscription (testable sans UI). */

/**
 * Longueur minimale imposée par Base44 à l'inscription. Le formulaire doit
 * appliquer la même règle, sinon le serveur renvoie « Password must be at
 * least 8 characters long » alors que l'app annonçait 6 caractères.
 */
export const MIN_REGISTER_PASSWORD_LENGTH = 8;

/** Nombre de chiffres du code de vérification envoyé par email. */
export const OTP_CODE_LENGTH = 6;

export function validateLoginEmail(email: string): string | null {
  const e = email.trim();
  if (!e) return 'Saisissez votre email.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Email invalide.';
  return null;
}

export function validateLoginPassword(password: string): string | null {
  if (!password || password.length < 6) {
    return 'Le mot de passe doit faire au moins 6 caractères.';
  }
  return null;
}

/** Règle d'inscription : alignée sur le minimum exigé par le serveur. */
export function validateRegisterPassword(password: string): string | null {
  if (!password) return 'Saisissez un mot de passe.';
  if (password.length < MIN_REGISTER_PASSWORD_LENGTH) {
    return `Le mot de passe doit contenir au moins ${MIN_REGISTER_PASSWORD_LENGTH} caractères.`;
  }
  return null;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | null {
  if (!confirmation) return 'Confirmez votre mot de passe.';
  if (password !== confirmation) return 'Les mots de passe ne correspondent pas.';
  return null;
}

export function validateOtpCode(code: string): string | null {
  const c = code.trim();
  if (!c) return 'Saisissez le code reçu par email.';
  if (!/^\d{6}$/.test(c)) {
    return `Le code doit contenir ${OTP_CODE_LENGTH} chiffres.`;
  }
  return null;
}

export function validateLoginForm(email: string, password: string): {
  emailError: string | null;
  passwordError: string | null;
} {
  return {
    emailError: validateLoginEmail(email),
    passwordError: validateLoginPassword(password),
  };
}

export function validateRegisterForm(
  email: string,
  password: string,
  confirmation: string,
): {
  emailError: string | null;
  passwordError: string | null;
  confirmError: string | null;
} {
  const passwordError = validateRegisterPassword(password);
  return {
    emailError: validateLoginEmail(email),
    passwordError,
    // Inutile de reprocher la confirmation tant que le mot de passe est invalide.
    confirmError: passwordError ? null : validatePasswordConfirmation(password, confirmation),
  };
}

/**
 * État civil exigé par base44 : `civility`, `first_name` et `last_name`.
 * Le web bloque le passage de commande tant qu'ils sont vides, on les rend
 * donc obligatoires dès l'inscription.
 */
export function validateCivilStatus(
  civility: string,
  firstName: string,
  lastName: string,
): {
  civilityError: string | null;
  firstNameError: string | null;
  lastNameError: string | null;
} {
  return {
    civilityError: civility.trim() ? null : 'Sélectionnez votre état civil.',
    firstNameError: firstName.trim() ? null : 'Saisissez votre prénom.',
    lastNameError: lastName.trim() ? null : 'Saisissez votre nom.',
  };
}
