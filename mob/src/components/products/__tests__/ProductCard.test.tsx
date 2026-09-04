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
  it("affiche 'Choisir' et n'ajoute pas quand le produit a plusieurs variantes", () => {
    const onAdd = jest.fn();
    const multi = {
      ...baseProduct,
      variants: [{ value: '1kg' }, { value: '5kg' }, { value: '10kg' }],
    };
    renderWithProviders(
      wrap(
        <ProductCard
          product={multi}
          cartQuantity={0}
          onAddToCart={onAdd}
          onRemoveFromCart={jest.fn()}
        />,
      ),
    );
    fireEvent.press(screen.getByText('Choisir'));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("garde le bouton 'Choisir' même si une variante est déjà au panier", () => {
    const multi = {
      ...baseProduct,
      variants: [{ value: '1kg' }, { value: '5kg' }],
    };
    renderWithProviders(
      wrap(
        <ProductCard
          product={multi}
          cartQuantity={2}
          onAddToCart={jest.fn()}
          onRemoveFromCart={jest.fn()}
        />,
      ),
    );
    expect(screen.getByText('Choisir')).toBeTruthy();
    expect(screen.queryByText('2')).toBeNull();
  });

  /*
    Une variante unique porte quand même son `price_modifier` et sa sélection :
    l'ajouter sans passer par la fiche produit facturait le prix de base et
    envoyait `selected_variants: null` à base44.
  */
  it("affiche 'Choisir' même quand le produit n'a qu'une seule variante", () => {
    const onAdd = jest.fn();
    const single = { ...baseProduct, variants: [{ value: '1kg' }] };
    renderWithProviders(
      wrap(
        <ProductCard
          product={single}
          cartQuantity={0}
          onAddToCart={onAdd}
          onRemoveFromCart={jest.fn()}
        />,
      ),
    );
    expect(screen.queryByText('Ajouter')).toBeNull();
    fireEvent.press(screen.getByText('Choisir'));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("ajoute directement quand le produit n'a aucune variante", () => {
    const onAdd = jest.fn();
    const plain = { ...baseProduct, variants: [] };
    renderWithProviders(
      wrap(
        <ProductCard
          product={plain}
          cartQuantity={0}
          onAddToCart={onAdd}
          onRemoveFromCart={jest.fn()}
        />,
      ),
    );
    fireEvent.press(screen.getByText('Ajouter'));
    expect(onAdd).toHaveBeenCalledWith(plain);
  });
});

describe('ProductCard — prix TTC et stock faible', () => {
  it('affiche le prix TTC (price_ttc) et non le prix HT', () => {
    // Crabe Madagascar en production : HT 13,99 €, TVA 10 %, TTC 15,39 €.
    const crabe: ProductDTO = {
      ...baseProduct,
      id: 'crabe',
      name: 'Crabe Madagascar 1Kg',
      unit: 'sache',
      price: 13.99,
      price_ttc: 15.39,
      vat_rate: 10,
    };
    renderWithProviders(
      wrap(<ProductCard product={crabe} onAddToCart={jest.fn()} onRemoveFromCart={jest.fn()} />),
    );
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.getByText('.39')).toBeTruthy();
    expect(screen.queryByText('13')).toBeNull();
  });

  it('n’affiche pas l’alerte « Plus que N … » sur la carte (réservée à la fiche produit)', () => {
    const low: ProductDTO = { ...baseProduct, unit: 'sache', stock_quantity: 2 };
    renderWithProviders(
      wrap(<ProductCard product={low} onAddToCart={jest.fn()} onRemoveFromCart={jest.fn()} />),
    );
    expect(screen.queryByText(/Plus que/)).toBeNull();
    expect(screen.getByText('Ajouter')).toBeTruthy();
  });
});
