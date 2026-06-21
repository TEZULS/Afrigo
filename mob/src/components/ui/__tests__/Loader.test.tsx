import React from 'react';
import { renderWithProviders } from '@/__tests__/test-utils';
import { Loader } from '../Loader';

describe('Loader', () => {
  it("rend un loader sans erreur", () => {
    const { toJSON } = renderWithProviders(<Loader />);
    expect(toJSON()).toBeTruthy();
  });

  it('rend en mode fullscreen sans erreur', () => {
    const { toJSON } = renderWithProviders(<Loader fullscreen size="small" />);
    expect(toJSON()).toBeTruthy();
  });
});
