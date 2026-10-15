import React from 'react';
import { KeyboardAvoidingView, Platform, Text } from 'react-native';
import { renderWithProviders } from '@/__tests__/test-utils';
import { Screen } from '../Screen';

describe('Screen — clavier', () => {
  const realOS = Platform.OS;
  afterEach(() => {
    Platform.OS = realOS;
  });

  it.each(['ios', 'android'] as const)(
    '%s : le contenu remonte au-dessus du clavier (Android bord à bord compris)',
    (os) => {
      Platform.OS = os;
      const { UNSAFE_getByType } = renderWithProviders(
        <Screen>
          <Text>Ville</Text>
        </Screen>,
      );
      expect(UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('padding');
    },
  );

  it('« none » : l’écran gère lui-même le clavier', () => {
    const { UNSAFE_getByType } = renderWithProviders(
      <Screen keyboardBehavior="none">
        <Text>Ville</Text>
      </Screen>,
    );
    expect(UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBeUndefined();
  });
});
