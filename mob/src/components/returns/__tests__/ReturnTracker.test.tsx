import React from 'react';
import { renderWithProviders, screen } from '@/__tests__/test-utils';
import { ReturnTracker } from '../ReturnTracker';

describe('ReturnTracker', () => {
  it('allume seulement « En attente » pour une demande déposée', () => {
    renderWithProviders(<ReturnTracker status="pending" />);
    expect(screen.getByTestId('return-step-pending-done')).toBeTruthy();
    expect(screen.getByTestId('return-step-approved-todo')).toBeTruthy();
    expect(screen.getByTestId('return-step-completed-todo')).toBeTruthy();
  });

  it('allume « Approuvé » quand l’admin accepte, « Terminé » quand il clôture', () => {
    const { unmount } = renderWithProviders(<ReturnTracker status="approved" />);
    expect(screen.getByTestId('return-step-approved-done')).toBeTruthy();
    expect(screen.getByTestId('return-step-completed-todo')).toBeTruthy();
    unmount();

    renderWithProviders(<ReturnTracker status="completed" />);
    expect(screen.getByTestId('return-step-completed-done')).toBeTruthy();
    expect(screen.getByText('Terminé')).toBeTruthy();
  });

  it('remplace le suivi par l’encart « Demande refusée » avec le motif', () => {
    renderWithProviders(<ReturnTracker status="rejected" rejectionReason="Produit ouvert" />);
    expect(screen.getByTestId('return-tracker-rejected')).toBeTruthy();
    expect(screen.getByText('Demande refusée')).toBeTruthy();
    expect(screen.getByText('Produit ouvert')).toBeTruthy();
    expect(screen.queryByTestId('return-tracker')).toBeNull();
  });
});
