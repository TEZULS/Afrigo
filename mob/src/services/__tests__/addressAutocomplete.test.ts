import {
  searchAddresses,
  searchCities,
  __clearAddressCache,
  MIN_ADDRESS_QUERY_LENGTH,
} from '@/services/addressAutocomplete';

const banFeature = (props: Record<string, unknown>) => ({ type: 'Feature', properties: props });

const okResponse = (features: unknown[]) => ({
  ok: true,
  json: async () => ({ type: 'FeatureCollection', features }),
});

describe('searchAddresses', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    __clearAddressCache();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('n’interroge pas l’API en dessous de 3 caractères', async () => {
    await expect(searchAddresses('12')).resolves.toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(MIN_ADDRESS_QUERY_LENGTH).toBe(3);
  });

  it('convertit une adresse BAN en suggestion exploitable', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      okResponse([
        banFeature({
          id: '51108_1234_00012',
          label: '12 Rue de la République 51000 Châlons-en-Champagne',
          name: '12 Rue de la République',
          postcode: '51000',
          city: 'Châlons-en-Champagne',
          context: '51, Marne, Grand Est',
          type: 'housenumber',
        }),
      ]),
    );

    const [first] = await searchAddresses('12 rue de la répu');
    expect(first).toEqual({
      id: '51108_1234_00012',
      label: '12 Rue de la République 51000 Châlons-en-Champagne',
      street: '12 Rue de la République',
      postalCode: '51000',
      city: 'Châlons-en-Champagne',
      context: '51, Marne, Grand Est',
      kind: 'housenumber',
    });
  });

  it('laisse la rue vide pour une commune (rien à pré-remplir)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      okResponse([
        banFeature({
          id: '51108',
          label: 'Châlons-en-Champagne',
          name: 'Châlons-en-Champagne',
          postcode: '51000',
          city: 'Châlons-en-Champagne',
          type: 'municipality',
        }),
      ]),
    );

    const [first] = await searchAddresses('chalons');
    expect(first?.street).toBe('');
    expect(first?.city).toBe('Châlons-en-Champagne');
    expect(first?.postalCode).toBe('51000');
  });

  it('filtre le code postal complet côté API', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(okResponse([]));
    await searchAddresses('rue de la paix', { postalCode: '51000' });
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('postcode=51000');

    await searchAddresses('rue de la paix', { postalCode: '510' });
    const partial = (global.fetch as jest.Mock).mock.calls[1][0] as string;
    expect(partial).not.toContain('postcode=');
  });

  it('classe en tête les adresses proches du client', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(okResponse([]));
    await searchAddresses('17 boulevard', { near: { lat: 48.96, lon: 4.36 } });
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('lat=48.96');
    expect(url).toContain('lon=4.36');
  });

  it('renvoie une liste vide si la BAN est injoignable (saisie manuelle possible)', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network request failed'));
    await expect(searchAddresses('12 rue de la paix')).resolves.toEqual([]);
  });

  it('met les résultats en cache pour éviter un aller-retour inutile', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      okResponse([
        banFeature({ id: 'a', name: '1 Rue A', postcode: '75001', city: 'Paris', type: 'housenumber' }),
      ]),
    );
    await searchAddresses('1 rue a');
    await searchAddresses('1 rue a');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('searchCities', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    __clearAddressCache();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('restreint la recherche aux communes', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(okResponse([]));
    await searchCities('chalons');
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('type=municipality');
  });

  it('renvoie la commune avec son code postal, sans rue à pré-remplir', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      okResponse([
        banFeature({
          id: '51108',
          label: 'Châlons-en-Champagne',
          name: 'Châlons-en-Champagne',
          postcode: '51000',
          city: 'Châlons-en-Champagne',
          context: '51, Marne, Grand Est',
          type: 'municipality',
        }),
      ]),
    );

    const [first] = await searchCities('chalons');
    expect(first?.city).toBe('Châlons-en-Champagne');
    expect(first?.postalCode).toBe('51000');
    expect(first?.street).toBe('');
  });

  it('ne partage pas le cache avec la recherche d’adresses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(okResponse([]));
    await searchAddresses('chalons');
    await searchCities('chalons');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
