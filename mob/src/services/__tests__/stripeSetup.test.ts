import { initStripe } from '@stripe/stripe-react-native';

let mockSettings: Record<string, unknown>[] | Error = [];
jest.mock('@/api/entities', () => ({
  AppSettings: () => ({
    list: jest.fn(async () => {
      if (mockSettings instanceof Error) throw mockSettings;
      return mockSettings;
    }),
  }),
}));

import {
  ensureStripeReady,
  isStripePublishableKey,
  pickStripePublishableKey,
  resetStripeSetupForTests,
} from '../stripeSetup';

const LIVE = 'pk_live_51HxYzAbCdEfGhIjKlMnOpQrStUvWxYz0123456789';
const TEST = 'pk_test_51HxYzAbCdEfGhIjKlMnOpQrStUvWxYz0123456789';

describe('clé publique Stripe', () => {
  it('reconnaît une vraie clé, refuse les exemples et les clés secrètes', () => {
    expect(isStripePublishableKey(LIVE)).toBe(true);
    expect(isStripePublishableKey(` ${TEST} `)).toBe(true);
    expect(isStripePublishableKey('pk_test_xxx')).toBe(false);
    expect(isStripePublishableKey('sk_live_51HxYzAbCdEfGhIjKlMnOpQrStUvWxYz')).toBe(false);
    expect(isStripePublishableKey(undefined)).toBe(false);
  });

  it('la clé de l’admin passe avant celle du build ; sinon celle du build ; sinon aucune', () => {
    expect(pickStripePublishableKey(LIVE, TEST)).toBe(LIVE);
    expect(pickStripePublishableKey('', TEST)).toBe(TEST);
    expect(pickStripePublishableKey(null, '')).toBeNull();
  });
});

describe('ensureStripeReady', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStripeSetupForTests();
  });

  it('initialise Stripe avec la clé lue sur base44, une seule fois par clé', async () => {
    mockSettings = [{ stripe_publishable_key: LIVE }];
    await expect(ensureStripeReady()).resolves.toBe(true);
    await expect(ensureStripeReady()).resolves.toBe(true);
    expect(initStripe).toHaveBeenCalledTimes(1);
    expect(initStripe).toHaveBeenCalledWith({
      publishableKey: LIVE,
      merchantIdentifier: 'merchant.app.afrigo.mobile',
      urlScheme: 'afrigo',
    });
  });

  it('l’admin passe du mode test au mode réel : nouvelle clé prise en compte', async () => {
    mockSettings = [{ stripe_publishable_key: TEST }];
    await ensureStripeReady();
    mockSettings = [{ stripe_publishable_key: LIVE }];
    await ensureStripeReady();
    expect((initStripe as jest.Mock).mock.calls.map((c) => c[0].publishableKey)).toEqual([TEST, LIVE]);
  });

  it('rien de configuré (ni réglages, ni build) : false, Stripe jamais lancé', async () => {
    mockSettings = [{ stripe_publishable_key: '' }];
    await expect(ensureStripeReady()).resolves.toBe(false);
    mockSettings = new Error('Network request failed');
    await expect(ensureStripeReady()).resolves.toBe(false);
    expect(initStripe).not.toHaveBeenCalled();
  });
});
