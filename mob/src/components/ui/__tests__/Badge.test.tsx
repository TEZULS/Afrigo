import React from 'react';
import { renderWithProviders, screen } from '@/__tests__/test-utils';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('affiche son label', () => {
    renderWithProviders(<Badge label="0/3" variant="success" />);
    expect(screen.getByText('0/3')).toBeTruthy();
  });

  it('rend chaque variante sans erreur', () => {
    const variants: Array<React.ComponentProps<typeof Badge>['variant']> = [
      'default',
      'success',
      'warning',
      'destructive',
      'brand',
      'outline',
      'muted',
    ];
    variants.forEach((variant) => {
      const { unmount } = renderWithProviders(<Badge label="x" variant={variant} />);
      expect(screen.getByText('x')).toBeTruthy();
      unmount();
    });
  });
});
