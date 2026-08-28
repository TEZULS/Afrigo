import {
  GENERIC_PAYMENT_ERROR,
  GENERIC_USER_ERROR,
  isTechnicalMessage,
  orderIssueMessage,
  rawUserMessage,
  translateUserError,
  userErrorMessage,
} from '../userErrors';

// Le module journalise les messages masqués en développement : bruit inutile ici.
beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe('isTechnicalMessage', () => {
  it.each([
    'One of `paymentIntentClientSecret` is required',
    'init_failed: something went wrong',
    'TypeError: cannot read property',
    'at initPaymentSheet (index.js:12)',
    'Request to https://api.stripe.com failed',
    'value is undefined',
    'status: 500',
  ])('repère le jargon technique : %s', (msg) => {
    expect(isTechnicalMessage(msg)).toBe(true);
  });

  it.each([
    'Votre commande a bien été enregistrée.',
    'Le montant minimum de commande n’est pas atteint.',
    'Adresse de livraison incomplète',
  ])('laisse passer une phrase client : %s', (msg) => {
    expect(isTechnicalMessage(msg)).toBe(false);
  });
});

describe('translateUserError', () => {
  it('remplace le message brut du SDK de paiement par un message client', () => {
    const stripeMessage =
      'One of `paymentIntentClientSecret`, `setupIntentClientSecret`, or `intentConfiguration` is required';
    const result = translateUserError(stripeMessage, GENERIC_PAYMENT_ERROR);

    expect(result).toBe(GENERIC_PAYMENT_ERROR);
    expect(result).not.toMatch(/paymentIntentClientSecret|`/);
  });

  it('traduit les refus de carte les plus courants', () => {
    expect(translateUserError('Your card was declined.')).toMatch(/banque a refusé le paiement/);
    expect(translateUserError('Your card has insufficient funds.')).toMatch(/Fonds insuffisants/);
    expect(translateUserError("Your card's security code is incorrect.")).toMatch(
      /code de sécurité/,
    );
  });

  it('traduit les erreurs réseau et serveur', () => {
    expect(translateUserError('Network request failed')).toMatch(/connexion internet/i);
    expect(translateUserError('Request timed out')).toMatch(/trop de temps/);
    expect(translateUserError('Internal Server Error')).toMatch(/problème temporaire/);
    expect(translateUserError('Too many requests')).toMatch(/Trop de tentatives/);
  });

  it('conserve un message déjà rédigé pour le client', () => {
    const msg = 'Le montant minimum de commande n’est pas atteint.';
    expect(translateUserError(msg)).toBe(msg);
  });

  it('retombe sur le message générique quand l’erreur est vide ou anglaise', () => {
    expect(translateUserError('')).toBe(GENERIC_USER_ERROR);
    expect(translateUserError(null)).toBe(GENERIC_USER_ERROR);
    expect(translateUserError('Unexpected token in JSON')).toBe(GENERIC_USER_ERROR);
  });

  it('n’expose jamais un identifiant de code, même dans une phrase française', () => {
    const result = translateUserError('Champ order_id manquant sur la commande');
    expect(result).toBe(GENERIC_USER_ERROR);
  });
});

describe('rawUserMessage', () => {
  it('lit le message d’une Error', () => {
    expect(rawUserMessage(new Error('boom'))).toBe('boom');
  });

  it('lit le message d’une réponse HTTP', () => {
    expect(rawUserMessage({ response: { data: { message: 'Too many requests' } } })).toBe(
      'Too many requests',
    );
  });

  it('accepte une chaîne brute et tolère l’absence de message', () => {
    expect(rawUserMessage(' boom ')).toBe('boom');
    expect(rawUserMessage({})).toBe('');
    expect(rawUserMessage(undefined)).toBe('');
  });
});

describe('userErrorMessage', () => {
  it('utilise le repli fourni par l’écran appelant', () => {
    const fallback = 'Votre commande n’a pas pu être enregistrée.';
    expect(userErrorMessage(new Error('Cannot read property x of null'), fallback)).toBe(fallback);
  });

  it('préfère la traduction connue au repli', () => {
    expect(userErrorMessage(new Error('Your card was declined.'), 'repli')).toMatch(
      /banque a refusé/,
    );
  });
});

describe('orderIssueMessage', () => {
  it('rend lisible le motif technique affiché sur la commande annulée', () => {
    const stored =
      'init_failed: One of `paymentIntentClientSecret`, `setupIntentClientSecret`, or `intentConfiguration` is required';
    const shown = orderIssueMessage(stored);

    expect(shown).toBe('Le paiement n’a pas pu être lancé. Aucun montant n’a été débité.');
    expect(shown).not.toMatch(/init_failed|paymentIntentClientSecret/);
  });

  it('rend lisible un refus renvoyé par le prestataire de paiement', () => {
    expect(orderIssueMessage('stripe_error: Your card was declined.')).toBe(
      'Le paiement a été refusé. Aucun montant n’a été débité.',
    );
  });

  it('conserve un motif écrit par un humain', () => {
    const reason = 'Client absent lors des deux passages du livreur.';
    expect(orderIssueMessage(reason)).toBe(reason);
  });

  it('utilise le repli quand aucun motif n’est enregistré', () => {
    expect(orderIssueMessage(undefined, 'Cette commande a été annulée.')).toBe(
      'Cette commande a été annulée.',
    );
    expect(orderIssueMessage('   ', 'Cette commande a été annulée.')).toBe(
      'Cette commande a été annulée.',
    );
  });

  it('masque un motif technique inconnu derrière le repli', () => {
    expect(orderIssueMessage('ECONNREFUSED 127.0.0.1:443', 'Cette commande a été annulée.')).toMatch(
      /connexion internet/i,
    );
    expect(orderIssueMessage('NullPointerException: order', 'Cette commande a été annulée.')).toBe(
      'Cette commande a été annulée.',
    );
  });
});
