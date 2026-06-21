import React from 'react';
import { renderWithProviders, fireEvent, screen } from '@/__tests__/test-utils';
import { CategoryFilter } from '../CategoryFilter';

describe('CategoryFilter', () => {
  it("affiche au minimum 'Tous'", () => {
    renderWithProviders(
      <CategoryFilter selected="all" onSelect={jest.fn()} availableCategories={[]} shopMode="food" />,
    );
    expect(screen.getByText('Tous')).toBeTruthy();
  });

  it('affiche les catégories alimentaires en mode food', () => {
    renderWithProviders(
      <CategoryFilter
        selected="all"
        onSelect={jest.fn()}
        availableCategories={['fruits_legumes', 'epices', 'sec']}
        shopMode="food"
      />,
    );
    expect(screen.getByText('Fruits & Légumes')).toBeTruthy();
    expect(screen.getByText('Épices')).toBeTruthy();
    expect(screen.getByText('Sec')).toBeTruthy();
  });

  it('affiche uniquement Cosmétique en mode cosmetique', () => {
    renderWithProviders(
      <CategoryFilter
        selected="all"
        onSelect={jest.fn()}
        availableCategories={['cosmetique']}
        shopMode="cosmetique"
      />,
    );
    expect(screen.getByText('Cosmétique')).toBeTruthy();
    expect(screen.queryByText('Fruits & Légumes')).toBeNull();
    expect(screen.queryByText('Épices')).toBeNull();
  });

  it('appelle onSelect avec la catégorie cliquée', () => {
    const onSelect = jest.fn();
    renderWithProviders(
      <CategoryFilter
        selected="all"
        onSelect={onSelect}
        availableCategories={['fruits_legumes']}
        shopMode="food"
      />,
    );
    fireEvent.press(screen.getByText('Fruits & Légumes'));
    expect(onSelect).toHaveBeenCalledWith('fruits_legumes');
  });
});
