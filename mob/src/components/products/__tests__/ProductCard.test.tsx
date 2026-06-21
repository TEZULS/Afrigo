import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { renderWithProviders, fireEvent, screen } from '@/__tests__/test-utils';
import { ProductCard, type ProductDTO } from '../ProductCard';

const wrap = (ui: React.ReactElement) =>
  <NavigationContainer>{ui}</NavigationContainer>;

const baseProduct: ProductDTO = {
  id: 'p1',
  name: 'ABOLO (Poudre) 500g',
  category: 'sec',
  unit: 'pack',
  price: 4.99,
  stock_quantity: 12,
};

describe('ProductCard', () => {
  it('affiche le nom et la catégorie', () => {
    renderWithProviders(
      wrap(<ProductCard product={baseProduct} onAddToCart={jest.fn()} onRemoveFromCart={jest.fn()} />),
    );
    expect(screen.getByText('ABOLO (Poudre) 500g')).toBeTruthy();
    expect(screen.getByText('SEC')).toBeTruthy();
  });

  it('affiche le prix avec partie entière et décimale', () => {
    renderWithProviders(
      wrap(<ProductCard product={baseProduct} onAddToCart={jest.fn()} onRemoveFromCart={jest.fn()} />),
    );
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('.99')).toBeTruthy();
  });

  it('affiche le bouton Ajouter quand cartQuantity = 0', () => {
    const onAdd = jest.fn();
    renderWithProviders(
      wrap(
        <ProductCard
          product={baseProduct}
          cartQuantity={0}
          onAddToCart={onAdd}
          onRemoveFromCart={jest.fn()}
        />,
      ),
    );
    fireEvent.press(screen.getByText('Ajouter'));
    expect(onAdd).toHaveBeenCalledWith(baseProduct);
  });

  it("affiche 'Épuisé' quand stock = 0", () => {
    const out = { ...baseProduct, stock_quantity: 0 };
    renderWithProviders(
      wrap(<ProductCard product={out} onAddToCart={jest.fn()} onRemoveFromCart={jest.fn()} />),
    );
    expect(screen.getAllByText('Épuisé').length).toBeGreaterThan(0);
  });

  it('affiche le badge de réduction quand promotion', () => {
    const promo = {
      ...baseProduct,
      is_promotion: true,
      promotion_price: 3.99,
    };
    renderWithProviders(
      wrap(<ProductCard product={promo} onAddToCart={jest.fn()} onRemoveFromCart={jest.fn()} />),
    );
    expect(screen.getByText(/-20%/)).toBeTruthy();
  });

  it('affiche les contrôles +/- quand cartQuantity > 0', () => {
    renderWithProviders(
      wrap(
        <ProductCard
          product={baseProduct}
          cartQuantity={3}
          onAddToCart={jest.fn()}
          onRemoveFromCart={jest.fn()}
        />,
      ),
    );
    expect(screen.getByText('3')).toBeTruthy();
  });
});
