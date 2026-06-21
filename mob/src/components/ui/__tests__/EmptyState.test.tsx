import React from 'react';
import { renderWithProviders, fireEvent, screen } from '@/__tests__/test-utils';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('affiche titre + description', () => {
    renderWithProviders(<EmptyState title="Panier vide" description="Ajoutez des produits" />);
    expect(screen.getByText('Panier vide')).toBeTruthy();
    expect(screen.getByText('Ajoutez des produits')).toBeTruthy();
  });

  it('rend un bouton d\'action quand actionLabel + onAction', () => {
    const onAction = jest.fn();
    renderWithProviders(
      <EmptyState title="Vide" actionLabel="Voir les produits" onAction={onAction} />,
    );
    fireEvent.press(screen.getByRole('button'));
    expect(onAction).toHaveBeenCalled();
  });

  it("ne rend pas de bouton sans actionLabel/onAction", () => {
    renderWithProviders(<EmptyState title="Vide" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
