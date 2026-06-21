import React from 'react';
import { renderWithProviders, fireEvent, screen } from '@/__tests__/test-utils';
import { ShopModeSegment } from '../ShopModeSegment';

describe('ShopModeSegment', () => {
  it('affiche les deux onglets Alimentation et Cosmétiques', () => {
    renderWithProviders(<ShopModeSegment mode="food" onChange={jest.fn()} />);
    expect(screen.getByText('Alimentation')).toBeTruthy();
    expect(screen.getByText('Cosmétiques')).toBeTruthy();
  });

  it("appelle onChange('cosmetique') quand l'onglet est pressé", () => {
    const onChange = jest.fn();
    renderWithProviders(<ShopModeSegment mode="food" onChange={onChange} />);
    fireEvent.press(screen.getByText('Cosmétiques'));
    expect(onChange).toHaveBeenCalledWith('cosmetique');
  });

  it("appelle onChange('food') quand on revient sur Alimentation", () => {
    const onChange = jest.fn();
    renderWithProviders(<ShopModeSegment mode="cosmetique" onChange={onChange} />);
    fireEvent.press(screen.getByText('Alimentation'));
    expect(onChange).toHaveBeenCalledWith('food');
  });

  it("marque l'onglet sélectionné comme tab actif", () => {
    renderWithProviders(<ShopModeSegment mode="cosmetique" onChange={jest.fn()} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(2);
  });
});
