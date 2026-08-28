/**
 * État civil (`User.civility` côté base44).
 *
 * Les trois valeurs sont exactement celles proposées par le back-office web :
 * une valeur hors liste (« Mlle », par exemple) n'est pas reconnue par les
 * écrans admin ni par les e-mails transactionnels.
 *
 * Volontairement isolé d'`AuthContext` : c'est une simple donnée, importable
 * sans tirer le contexte d'authentification (ni le mocker dans les tests).
 */
export const CIVILITY_OPTIONS = ['M.', 'Mme', 'Autre'] as const;

export type Civility = (typeof CIVILITY_OPTIONS)[number];
