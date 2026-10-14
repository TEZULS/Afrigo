import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { renderWithProviders, fireEvent, screen, waitFor } from '@/__tests__/test-utils';
import { useHomeSearch } from '@/stores/homeSearch';
import { useSearchHistory } from '@/stores/searchHistory';
import { kv, STORAGE_KEYS } from '@/services/storage';
import type { ProductDTO } from '@/components/products/ProductCard';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: jest.fn(),
      canGoBack: () => true,
    }),
    useRoute: () => ({ name: 'Search', key: 'search', params: {} }),
  };
});

const products: ProductDTO[] = [
  { id: 'p1', name: 'ABOLO (Poudre) 500g', price: 4.99, category: 'sec' } as ProductDTO,
  { id: 'p2', name: 'Adja', price: 4.25, category: 'epices' } as ProductDTO,
  { id: 'p3', name: 'Beurre de karité', price: 9.9, category: 'cosmetique' } as ProductDTO,
];

jest.mock('@/api/entities', () => ({
  Product: () => ({ list: jest.fn(async () => products) }),
  InvokeLLM: jest.fn(),
}));

/* Dictée simulée : `mockSpeechEmit('result', …)` rejoue les événements natifs. */
const mockSpeechListeners: Record<string, ((e: unknown) => void)[]> = {};
const mockSpeechEmit = (name: string, e: unknown = {}) =>
  (mockSpeechListeners[name] ?? []).forEach((l) => l(e));
const mockSpeechStart = jest.fn();
const mockSpeechStop = jest.fn();
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
    isRecognitionAvailable: jest.fn(() => true),
    getSpeechRecognitionServices: jest.fn(() => [] as string[]),
    start: (...args: unknown[]) => mockSpeechStart(...args),
    stop: () => mockSpeechStop(),
    abort: jest.fn(),
    addListener: (name: string, l: (e: unknown) => void) => {
      (mockSpeechListeners[name] ??= []).push(l);
      return {
        remove: () => {
          mockSpeechListeners[name] = (mockSpeechListeners[name] ?? []).filter((x) => x !== l);
        },
      };
    },
  },
}));

import { act } from '@testing-library/react-native';
import { SearchScreen } from '../SearchScreen';

const wrap = (ui: React.ReactElement) => <NavigationContainer>{ui}</NavigationContainer>;

describe('SearchScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    useHomeSearch.setState({ query: '', queryToken: 0 });
    useSearchHistory.setState({ terms: [] });
    /* L'historique est persisté : on vide aussi le stockage entre deux tests. */
    kv.remove(STORAGE_KEYS.SEARCH_HISTORY);
  });

  it('cherche à la voix le produit dicté par son titre', async () => {
    renderWithProviders(wrap(<SearchScreen />));
    fireEvent.press(screen.getByTestId('search-voice'));
    await waitFor(() => expect(mockSpeechStart).toHaveBeenCalled());
    expect(mockSpeechStart.mock.calls[0][0]).toMatchObject({ lang: 'fr-FR' });
    expect(screen.getByLabelText('Arrêter la recherche vocale')).toBeTruthy();

    act(() => {
      mockSpeechEmit('result', { isFinal: false, results: [{ transcript: 'beurre' }] });
    });
    // Fenêtre centrale : micro + « Parlez » + dictée en direct.
    expect(screen.getByTestId('voice-overlay')).toBeTruthy();
    expect(screen.getByText('Parlez')).toBeTruthy();
    expect(screen.getByText('beurre')).toBeTruthy();

    act(() => {
      mockSpeechEmit('result', { isFinal: true, results: [{ transcript: 'Beurre de karité.' }] });
      mockSpeechEmit('end');
    });
    expect(useHomeSearch.getState().query).toBe('Beurre de karité');
    expect(mockNavigate).toHaveBeenCalledWith('ClientTabs', { screen: 'HomeTab' });
  });

  it('suggère les produits du catalogue au fil de la saisie', async () => {
    renderWithProviders(wrap(<SearchScreen />));
    fireEvent.changeText(screen.getByLabelText('Rechercher un produit'), 'ab');

    await waitFor(() => expect(screen.getByLabelText('Rechercher ABOLO (Poudre) 500g')).toBeTruthy());
    expect(screen.queryByLabelText('Rechercher Adja')).toBeNull();
  });

  it('ignore les accents dans les suggestions', async () => {
    renderWithProviders(wrap(<SearchScreen />));
    fireEvent.changeText(screen.getByLabelText('Rechercher un produit'), 'karite');

    await waitFor(() => expect(screen.getByLabelText('Rechercher Beurre de karité')).toBeTruthy());
  });

  it("applique la recherche à l'accueil et l'ajoute à l'historique", async () => {
    renderWithProviders(wrap(<SearchScreen />));
    fireEvent.changeText(screen.getByLabelText('Rechercher un produit'), 'adj');

    await waitFor(() => expect(screen.getByLabelText('Rechercher Adja')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Rechercher Adja'));

    expect(useHomeSearch.getState().query).toBe('Adja');
    expect(useHomeSearch.getState().queryToken).toBe(1);
    expect(useSearchHistory.getState().terms).toEqual(['Adja']);
    expect(mockNavigate).toHaveBeenCalledWith('ClientTabs', { screen: 'HomeTab' });
  });

  it('recopie une suggestion dans le champ sans lancer la recherche', async () => {
    renderWithProviders(wrap(<SearchScreen />));
    const input = screen.getByLabelText('Rechercher un produit');
    fireEvent.changeText(input, 'adj');

    await waitFor(() => expect(screen.getByLabelText('Compléter avec Adja')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Compléter avec Adja'));

    expect(input.props.value).toBe('Adja');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("affiche l'historique quand le champ est vide et permet de l'effacer", async () => {
    useSearchHistory.setState({ terms: ['tomate'] });
    renderWithProviders(wrap(<SearchScreen />));

    await waitFor(() => expect(screen.getByText('Recherches récentes')).toBeTruthy());
    expect(screen.getByLabelText('Relancer la recherche tomate')).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Effacer l'historique de recherche"));
    expect(useSearchHistory.getState().terms).toEqual([]);
  });
});
