import {
  cardBrandLabel,
  cardholderNameOf,
  formatCardExpiry,
  isCardExpired,
  savedCardOf,
  savedCardTitle,
} from '../savedCard';

/** Profil tel que l'écrit la fonction `saveCard` (site et app). */
const user = (info: unknown, id: unknown = 'pm_123') => ({
  email: 'salma@x.fr',
  saved_payment_method_id: id,
  saved_card_info: info,
});

describe('savedCardOf — carte enregistrée du profil', () => {
  it('lit la chaîne JSON écrite par `saveCard`', () => {
    expect(
      savedCardOf(user(JSON.stringify({ last4: '4242', brand: 'Visa', exp_month: 3, exp_year: 2027 }))),
    ).toEqual({ paymentMethodId: 'pm_123', brand: 'visa', last4: '4242', expMonth: 3, expYear: 2027 });
  });

  it('accepte aussi un objet déjà décodé', () => {
    expect(savedCardOf(user({ last4: '0005', brand: 'mastercard' }))).toMatchObject({
      brand: 'mastercard',
      last4: '0005',
      expMonth: null,
      expYear: null,
    });
  });

  it('aucune carte : pas d’identifiant Stripe, champ vidé par `deleteCard`, texte illisible', () => {
    expect(savedCardOf(null)).toBeNull();
    expect(savedCardOf({ email: 'a@b.fr' })).toBeNull();
    expect(savedCardOf(user(JSON.stringify({ last4: '4242' }), null))).toBeNull();
    expect(savedCardOf(user(null))).toBeNull();
    expect(savedCardOf(user(''))).toBeNull();
    expect(savedCardOf(user('{pas du json'))).toBeNull();
    expect(savedCardOf(user(JSON.stringify({ last4: '42' })))).toBeNull();
  });
});

describe('libellés de la carte', () => {
  const card = savedCardOf(user(JSON.stringify({ last4: '4242', brand: 'amex', exp_month: 3, exp_year: 2027 })))!;

  it('réseau en clair, « Carte » s’il est inconnu', () => {
    expect(cardBrandLabel('visa')).toBe('Visa');
    expect(cardBrandLabel('amex')).toBe('American Express');
    expect(cardBrandLabel('unknown')).toBe('Carte');
    expect(cardBrandLabel('')).toBe('Carte');
  });

  it('« American Express •••• 4242 », expiration « 03/2027 »', () => {
    expect(savedCardTitle(card)).toBe('American Express •••• 4242');
    expect(formatCardExpiry(card)).toBe('03/2027');
    expect(formatCardExpiry({ ...card, expYear: null })).toBe('');
  });
});

describe('isCardExpired', () => {
  const card = { paymentMethodId: 'pm', brand: 'visa', last4: '4242', expMonth: 10, expYear: 2026 };
  const oct28 = new Date(2026, 9, 28);

  it('valable jusqu’à la fin de son mois d’expiration', () => {
    expect(isCardExpired(card, oct28)).toBe(false);
    expect(isCardExpired({ ...card, expMonth: 9 }, oct28)).toBe(true);
    expect(isCardExpired({ ...card, expMonth: 12, expYear: 2025 }, oct28)).toBe(true);
    expect(isCardExpired({ ...card, expMonth: 1, expYear: 2027 }, oct28)).toBe(false);
  });

  it('date inconnue : jamais considérée expirée', () => {
    expect(isCardExpired({ ...card, expMonth: null, expYear: null }, oct28)).toBe(false);
  });
});

describe('cardholderNameOf — titulaire transmis à Stripe', () => {
  it('prénom + nom du profil, sinon nom complet, sinon rien', () => {
    expect(cardholderNameOf({ first_name: ' Salma ', last_name: 'Diallo', full_name: 'S D' })).toBe(
      'Salma Diallo',
    );
    expect(cardholderNameOf({ first_name: '', full_name: 'Salma Diallo' })).toBe('Salma Diallo');
    expect(cardholderNameOf({ email: 'a@b.fr' })).toBeUndefined();
    expect(cardholderNameOf(null)).toBeUndefined();
  });
});
