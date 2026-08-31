import React from 'react';
import { Keyboard } from 'react-native';
import { renderWithProviders, fireEvent, screen, waitFor, act } from '@/__tests__/test-utils';
import { AddressAutocomplete } from '../AddressAutocomplete';
import { __clearAddressCache } from '@/services/addressAutocomplete';

// L'ordre des suggestions dépend des zones de livraison Base44.
jest.mock('@/api/entities', () => ({
  DeliveryZone: () => ({
    list: jest.fn().mockResolvedValue([{ postal_codes: ['51000'], cities: ['Chalons en Champagne'] }]),
  }),
}));

const BAN_RESULT = {
  ok: true,
  json: async () => ({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          id: '51108_1234_00012',
          label: '12 Rue de la République 51000 Châlons-en-Champagne',
          name: '12 Rue de la République',
          postcode: '51000',
          city: 'Châlons-en-Champagne',
          context: '51, Marne, Grand Est',
          type: 'housenumber',
        },
      },
    ],
  }),
};

describe('AddressAutocomplete', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    __clearAddressCache();
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue(BAN_RESULT);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('propose l’adresse saisie et remplit rue, code postal et ville au tap', async () => {
    const onSelectSuggestion = jest.fn();
    renderWithProviders(
      <AddressAutocomplete
        value="12 rue de la répu"
        onChangeText={jest.fn()}
        onSelectSuggestion={onSelectSuggestion}
      />,
    );

    // Les suggestions n'apparaissent qu'une fois le champ actif.
    fireEvent(screen.getByPlaceholderText('12 rue de la République'), 'focus');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => expect(screen.getByText('12 Rue de la République')).toBeTruthy());
    expect(screen.getByText(/51000 Châlons-en-Champagne/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('address-suggestion-0'));
    expect(onSelectSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({
        street: '12 Rue de la République',
        postalCode: '51000',
        city: 'Châlons-en-Champagne',
      }),
    );
  });

  it('n’interroge pas la BAN tant que le champ n’a pas le focus', async () => {
    renderWithProviders(
      <AddressAutocomplete
        value="12 rue de la répu"
        onChangeText={jest.fn()}
        onSelectSuggestion={jest.fn()}
      />,
    );
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('garde la liste visible quand le clavier se ferme, la replie si un autre champ prend la main', async () => {
    const isVisible = jest.spyOn(Keyboard, 'isVisible');
    renderWithProviders(
      <AddressAutocomplete
        value="12 rue de la répu"
        onChangeText={jest.fn()}
        onSelectSuggestion={jest.fn()}
      />,
    );
    const input = screen.getByPlaceholderText('12 rue de la République');
    fireEvent(input, 'focus');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => expect(screen.getByText('12 Rue de la République')).toBeTruthy());

    // Touche Retour / glissement : le clavier disparaît, le champ perd le focus.
    isVisible.mockReturnValue(false);
    fireEvent(input, 'blur');
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.getByText('12 Rue de la République')).toBeTruthy();

    // Un autre champ prend le clavier : la liste se replie.
    fireEvent(input, 'focus');
    isVisible.mockReturnValue(true);
    fireEvent(input, 'blur');
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(screen.queryByText('12 Rue de la République')).toBeNull();
    isVisible.mockRestore();
  });

  it('« Masquer » replie la liste sans choisir', async () => {
    renderWithProviders(
      <AddressAutocomplete
        value="12 rue de la répu"
        onChangeText={jest.fn()}
        onSelectSuggestion={jest.fn()}
      />,
    );
    fireEvent(screen.getByPlaceholderText('12 rue de la République'), 'focus');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    await waitFor(() => expect(screen.getByText('12 Rue de la République')).toBeTruthy());
    fireEvent.press(screen.getByTestId('address-suggestions-close'));
    expect(screen.queryByText('12 Rue de la République')).toBeNull();
  });
});

describe('AddressAutocomplete — mode commune', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    __clearAddressCache();
    jest.useFakeTimers();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              id: '51108',
              label: 'Châlons-en-Champagne',
              name: 'Châlons-en-Champagne',
              postcode: '51000',
              city: 'Châlons-en-Champagne',
              context: '51, Marne, Grand Est',
              type: 'municipality',
            },
          },
        ],
      }),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('propose la commune et renvoie son code postal', async () => {
    const onSelectSuggestion = jest.fn();
    renderWithProviders(
      <AddressAutocomplete
        kind="city"
        value="chalons"
        onChangeText={jest.fn()}
        onSelectSuggestion={onSelectSuggestion}
      />,
    );

    fireEvent(screen.getByPlaceholderText('Châlons-en-Champagne'), 'focus');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => expect(screen.getByTestId('address-suggestion-0')).toBeTruthy());
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('type=municipality');

    fireEvent.press(screen.getByTestId('address-suggestion-0'));
    expect(onSelectSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'Châlons-en-Champagne', postalCode: '51000' }),
    );
  });
});
