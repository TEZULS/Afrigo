import React from 'react';
import { Text } from 'react-native';
import { renderWithProviders, screen } from '@/__tests__/test-utils';
import { Card } from '../Card';

describe('Card', () => {
  it('rend ses enfants', () => {
    renderWithProviders(
      <Card>
        <Text>Contenu</Text>
      </Card>,
    );
    expect(screen.getByText('Contenu')).toBeTruthy();
  });

  it('rend en mode elevated sans erreur', () => {
    renderWithProviders(
      <Card elevated padding={12}>
        <Text>Elevated</Text>
      </Card>,
    );
    expect(screen.getByText('Elevated')).toBeTruthy();
  });
});
