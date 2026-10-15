/**
 * Numéro de téléphone français saisi à l'inscription (demande du 2026-10-01) :
 * l'indicatif +33 est déjà en place, et les chiffres se regroupent tout seuls
 * — « +33 7 72 21 17 98 » — même si le client les tape collés, avec un 0 en
 * tête (« 0772211798 ») ou avec l'indicatif (« +33772211798 »).
 */

export const PHONE_PREFIX = '+33 ';
/** Chiffres après l'indicatif (numéro national sans le 0). */
export const NATIONAL_DIGITS = 9;

/**
 * Chiffres du numéro national (sans indicatif ni 0 initial), 9 au plus.
 * Le 0 tapé par habitude après « +33 » reste visible seul, puis disparaît dès
 * le chiffre suivant : « +33 0 » → « +33 7 ».
 */
export const nationalDigits = (input: string): string => {
  let digits = (input ?? '').replace(/\D/g, '');
  if (digits.startsWith('33')) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length > 1) digits = digits.replace(/^0+/, '');
  return digits.slice(0, NATIONAL_DIGITS);
};

/** `0772211798` → `+33 7 72 21 17 98` (saisie partielle : groupes déjà formés). */
export const formatFrenchPhone = (input: string): string => {
  const d = nationalDigits(input);
  if (!d) return PHONE_PREFIX;
  const groups = [d.slice(0, 1)];
  for (let i = 1; i < d.length; i += 2) groups.push(d.slice(i, i + 2));
  return `+33 ${groups.join(' ')}`;
};

/** Numéro complet (9 chiffres après +33) ? */
export const isCompleteFrenchPhone = (input: string): boolean =>
  nationalDigits(input).length === NATIONAL_DIGITS;

export function validatePhone(phone: string): string | null {
  if (!nationalDigits(phone).replace(/^0/, '')) return 'Saisissez votre numéro de téléphone.';
  if (!isCompleteFrenchPhone(phone)) return 'Numéro incomplet : 9 chiffres après +33.';
  return null;
}

export function validatePhoneConfirmation(phone: string, confirmation: string): string | null {
  if (!nationalDigits(confirmation)) return 'Confirmez votre numéro de téléphone.';
  if (nationalDigits(phone) !== nationalDigits(confirmation)) return 'Les numéros ne correspondent pas.';
  return null;
}
