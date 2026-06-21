import React from 'react';
import { renderWithProviders, screen } from '@/__tests__/test-utils';
import { TierBadge } from '../TierBadge';

describe('TierBadge', () => {
  it("affiche 'Standard' pour le tier 'normal'", () => {
    renderWithProviders(<TierBadge tier="normal" />);
    expect(screen.getByText('Standard')).toBeTruthy();
  });

  it("affiche 'Argent' pour le tier 'argent'", () => {
    renderWithProviders(<TierBadge tier="argent" />);
    expect(screen.getByText('Argent')).toBeTruthy();
  });

  it("affiche 'Or' pour le tier 'or'", () => {
    renderWithProviders(<TierBadge tier="or" />);
    expect(screen.getByText('Or')).toBeTruthy();
  });

  it("affiche 'Diamant' pour le tier 'diamant'", () => {
    renderWithProviders(<TierBadge tier="diamant" />);
    expect(screen.getByText('Diamant')).toBeTruthy();
  });

  it("retombe sur 'Standard' pour un tier inconnu", () => {
    renderWithProviders(<TierBadge tier="autre" />);
    expect(screen.getByText('Standard')).toBeTruthy();
  });

  it('rend en mode small sans erreur', () => {
    const { toJSON } = renderWithProviders(<TierBadge tier="or" small />);
    expect(toJSON()).toBeTruthy();
  });
});
