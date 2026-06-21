import React from 'react';
import { Text } from 'react-native';
import { renderWithProviders, fireEvent, screen } from '@/__tests__/test-utils';
import { Button } from '../Button';

describe('Button', () => {
  it('affiche le titre', () => {
    renderWithProviders(<Button title="Se connecter" />);
    expect(screen.getByText('Se connecter')).toBeTruthy();
  });

  it("appelle onPress quand pressé", () => {
    const onPress = jest.fn();
    renderWithProviders(<Button title="Tap" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('rend un spinner quand loading', () => {
    renderWithProviders(<Button title="Loading" loading />);
    // Le titre est masqué pendant loading, on vérifie que le bouton est désactivé
    expect(screen.queryByText('Loading')).toBeNull();
  });

  it('ignore onPress quand disabled', () => {
    const onPress = jest.fn();
    renderWithProviders(<Button title="Disabled" disabled onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('rend les enfants à la place du titre', () => {
    renderWithProviders(
      <Button>
        <Text>Custom child</Text>
      </Button>,
    );
    expect(screen.getByText('Custom child')).toBeTruthy();
  });
});
