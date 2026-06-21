import React from 'react';
import { renderWithProviders, screen } from '@/__tests__/test-utils';
import { Avatar } from '../Avatar';

describe('Avatar', () => {
  it('affiche les initiales si name fourni', () => {
    renderWithProviders(<Avatar name="Nassim Essid" />);
    expect(screen.getByText('NE')).toBeTruthy();
  });

  it('rend un fallback icon si pas de name ni uri', () => {
    const { toJSON } = renderWithProviders(<Avatar />);
    expect(toJSON()).toBeTruthy();
  });

  it("rend une image si uri fourni", () => {
    const { toJSON } = renderWithProviders(<Avatar uri="https://example.com/a.png" name="X" />);
    expect(toJSON()).toBeTruthy();
  });
});
