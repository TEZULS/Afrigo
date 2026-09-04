import React from 'react';
import { renderWithProviders, fireEvent, screen } from '@/__tests__/test-utils';
import { CategoryFilter } from '../CategoryFilter';

describe('CategoryFilter', () => {
  it("affiche 'Tous' dès qu'une vraie catégorie existe", () => {
    renderWithProviders(
      <CategoryFilter
        selected="all"
        onSelect={jest.fn()}
        availableCategories={['fruits_legumes']}
        shopMode="food"
      />,
    );
    expect(screen.getByText('Tous')).toBeTruthy();
  });

  it('masque toute la barre quand aucune catégorie ne contient de produit', () => {
    renderWithProviders(
      <CategoryFilter selected="all" onSelect={jest.fn()} availableCategories={[]} shopMode="food" />,
    );
    expect(screen.queryByText('Tous')).toBeNull();
  });

  it("masque la pastille Cosmétique quand le rayon cosmétique est vide", () => {
    renderWithProviders(
      <CategoryFilter
        selected="all"
        onSelect={jest.fn()}
        availableCategories={[]}
        shopMode="cosmetique"
      />,
    );
    expect(screen.queryByText('Cosmétique')).toBeNull();
    expect(screen.queryByText('Tous')).toBeNull();
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

  /*
    En production, les cosmétiques sont rangés dans 7 sous-catégories
    (`cosmetique_soins_corps`, `cosmetique_parfum`…) que le filtre ignorait :
    la pastille correspondante n'apparaissait jamais.
  */
  it('affiche les sous-catégories cosmétiques de base44', () => {
    renderWithProviders(
      <CategoryFilter
        selected="all"
        onSelect={jest.fn()}
        availableCategories={['cosmetique_soins_corps', 'cosmetique_parfum']}
        shopMode="cosmetique"
      />,
    );
    expect(screen.getByText('Corps')).toBeTruthy();
    expect(screen.getByText('Parfum')).toBeTruthy();
    expect(screen.queryByText('Cheveux')).toBeNull();
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
