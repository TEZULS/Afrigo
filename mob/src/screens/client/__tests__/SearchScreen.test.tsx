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
