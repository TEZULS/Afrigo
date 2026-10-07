import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { renderWithProviders, screen, waitFor } from '@/__tests__/test-utils';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true }),
    useRoute: () => ({ name: 'ProductDetails', key: 'pd', params: { id: 'p1' } }),
  };
});

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: null, isAuthenticated: false }),
}));

const product = {
  id: 'p1',
  name: 'Feuille de Manioc 500g',
  description: 'Feuille de Manioc surgelés (Bawin, Saka Saka) 100% naturel',
  price: 3.4,
  category: 'surgeles',
  unit: 'sache',
  stock_quantity: 20,
  is_active: true,
};

jest.mock('@/api/entities', () => ({
  Product: () => ({
    get: jest.fn(async () => product),
    list: jest.fn(async () => [product]),
    filter: jest.fn(async () => [product]),
  }),
  Review: () => ({ filter: jest.fn(async () => []), list: jest.fn(async () => []) }),
  DeliveryZone: () => ({ list: jest.fn(async () => []), filter: jest.fn(async () => []) }),
}));

import { ProductDetailsScreen } from '../ProductDetailsScreen';

const wrap = (ui: React.ReactElement) => <NavigationContainer>{ui}</NavigationContainer>;

describe('ProductDetailsScreen', () => {
  it('place la description entre le titre et le prix', async () => {
    const { toJSON } = renderWithProviders(wrap(<ProductDetailsScreen />));
    await waitFor(() => expect(screen.getByTestId('product-description')).toBeTruthy());

    // Ordre d'apparition dans l'arbre rendu (sérialisé) : titre, description, prix.
    const tree = JSON.stringify(toJSON());
    const title = tree.indexOf('"Feuille de Manioc 500g"');
    const description = tree.indexOf('Feuille de Manioc surgelés');
    const price = tree.indexOf('product-price-block');
    expect(title).toBeGreaterThan(-1);
    expect(description).toBeGreaterThan(title);
    expect(price).toBeGreaterThan(description);
  });
});
