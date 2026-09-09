import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { renderWithProviders, fireEvent, screen, waitFor, act } from '@/__tests__/test-utils';
import { useMenuDrawer } from '@/stores/menuDrawer';
import { useHomeSearch } from '@/stores/homeSearch';
import type { ProductDTO } from '@/components/products/ProductCard';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), canGoBack: () => false }),
    useRoute: () => ({ name: 'HomeTab', key: 'home', params: {} }),
  };
});

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'salma@x.fr', full_name: 'Salma Timo' },
    isAuthenticated: true,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const FOOD_PRODUCTS: ProductDTO[] = [
  {
    id: 'p1',
    name: 'ABOLO (Poudre) 500g',
    price: 4.99,
    category: 'sec',
    unit: 'unité',
  } as ProductDTO,
  {
    id: 'p2',
    name: 'Adja',
    price: 4.25,
    category: 'epices',
    unit: 'pièce',
  } as ProductDTO,
];

const COSMETIC_PRODUCT = {
  id: 'p3',
  name: 'Beurre de karité',
  price: 9.9,
  category: 'cosmetique',
  unit: 'pot',
} as ProductDTO;

/** Catalogue renvoyé par le mock — ajustable test par test. */
let mockProducts: ProductDTO[] = FOOD_PRODUCTS;

jest.mock('@/api/entities', () => ({
  Product: () => ({ list: jest.fn(async () => mockProducts) }),
  InvokeLLM: jest.fn(),
}));

import { HomeScreen } from '../HomeScreen';

const wrap = (ui: React.ReactElement) => <NavigationContainer>{ui}</NavigationContainer>;

describe('HomeScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockProducts = FOOD_PRODUCTS;
    useMenuDrawer.setState({ isOpen: false, activeRoute: null });
    useHomeSearch.setState({ query: '', queryToken: 0 });
  });

  it('masque le segment Alimentation/Cosmétiques quand le rayon cosmétiques est vide', async () => {
    renderWithProviders(wrap(<HomeScreen />));
    await waitFor(() => expect(screen.getByText('Adja')).toBeTruthy());

    expect(screen.queryByLabelText('Cosmétiques')).toBeNull();
    expect(screen.queryByLabelText('Alimentation')).toBeNull();
  });

  it("affiche le segment dès qu'un produit cosmétique existe", async () => {
    mockProducts = [...FOOD_PRODUCTS, COSMETIC_PRODUCT];
    renderWithProviders(wrap(<HomeScreen />));

    await waitFor(() => expect(screen.getByLabelText('Cosmétiques')).toBeTruthy());
    expect(screen.getByLabelText('Alimentation')).toBeTruthy();
  });

  /*
    Régression : en production la catégorie du produit est     (l'admin base44 propose 7 sous-catégories cosmétiques). L'app n'en
    connaissait qu'une — le sélecteur restait masqué et le produit atterrissait
    dans le rayon Alimentation.
  */
  it("reconnaît les sous-catégories cosmétiques de base44", async () => {
    mockProducts = [
      ...FOOD_PRODUCTS,
      { ...COSMETIC_PRODUCT, category: 'cosmetique_soins_corps' } as ProductDTO,
    ];
    renderWithProviders(wrap(<HomeScreen />));

    await waitFor(() => expect(screen.getByLabelText('Cosmétiques')).toBeTruthy());
    // Le cosmétique ne doit PAS apparaître dans le rayon Alimentation.
    expect(screen.queryByText('Beurre de karité')).toBeNull();
  });

  it("affiche le bouton menu à côté du bonjour et ouvre le drawer", async () => {
    renderWithProviders(wrap(<HomeScreen />));
    await waitFor(() => expect(screen.getByText('Bonjour, Salma')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Ouvrir le menu'));
    expect(useMenuDrawer.getState().isOpen).toBe(true);
  });

  it("n'affiche plus de barre de recherche : la recherche passe par l'onglet 🔍", async () => {
    renderWithProviders(wrap(<HomeScreen />));
    await waitFor(() => expect(screen.getByText('Adja')).toBeTruthy());

    expect(screen.queryByLabelText('Rechercher un produit')).toBeNull();
    expect(screen.queryByLabelText('Rechercher un produit (barre épinglée)')).toBeNull();
    expect(screen.queryByLabelText('Rechercher avec une photo')).toBeNull();
    // Les catégories, elles, restent en tête de liste.
    expect(screen.getByText('Tous')).toBeTruthy();
  });

  it("applique le terme poussé par l'écran de recherche et permet de l'effacer", async () => {
    renderWithProviders(wrap(<HomeScreen />));
    await waitFor(() => expect(screen.getByText('Adja')).toBeTruthy());

    act(() => {
      useHomeSearch.getState().applyQuery('abolo');
    });

    await waitFor(() => expect(screen.queryByText('Adja')).toBeNull());
    expect(screen.getByText('ABOLO (Poudre) 500g')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Effacer la recherche « abolo »'));
    await waitFor(() => expect(screen.getByText('Adja')).toBeTruthy());
  });
});
