import React from 'react';
import { Pressable as RNPressable, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable } from '../Pressable';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { cssInterop, interopComponents } = require('react-native-css-interop/dist/runtime/native/api');

const base = { padding: 14, borderWidth: 1 };

describe('Pressable (sans style-fonction)', () => {
  it('résout un style-fonction en style statique, et le met à jour à l’appui', () => {
    render(
      <Pressable testID="p" style={({ pressed }) => [base, { opacity: pressed ? 0.5 : 1 }]}>
        <View />
      </Pressable>,
    );
    const el = screen.getByTestId('p');
    expect(typeof el.props.style).not.toBe('function');
    expect(el).toHaveStyle({ padding: 14, borderWidth: 1, opacity: 1 });

    fireEvent(el, 'pressIn');
    expect(screen.getByTestId('p')).toHaveStyle({ opacity: 0.5 });
    fireEvent(el, 'pressOut');
    expect(screen.getByTestId('p')).toHaveStyle({ opacity: 1 });
  });

  it('transmet un style statique tel quel et relaie onPressIn / onPressOut', () => {
    const onPressIn = jest.fn();
    const onPressOut = jest.fn();
    render(
      <Pressable testID="p" style={base} onPressIn={onPressIn} onPressOut={onPressOut}>
        <View />
      </Pressable>,
    );
    const el = screen.getByTestId('p');
    expect(el).toHaveStyle(base);
    fireEvent(el, 'pressIn');
    fireEvent(el, 'pressOut');
    expect(onPressIn).toHaveBeenCalledTimes(1);
    expect(onPressOut).toHaveBeenCalledTimes(1);
  });

  /**
   * Documente le comportement de NativeWind (`cssInterop`) qui motive ce
   * composant : un `style` fonction est perdu, un tableau est conservé.
   */
  it('NativeWind : l’interop perd un style-fonction mais garde un tableau', () => {
    cssInterop(RNPressable, { className: 'style' });
    const Interop = interopComponents.get(RNPressable) as React.ComponentType<Record<string, unknown>>;

    render(<Interop testID="fn" style={() => [base]} />);
    expect(screen.getByTestId('fn').props.style).toEqual({});

    render(<Interop testID="arr" style={[base]} />);
    expect(screen.getByTestId('arr')).toHaveStyle(base);
  });
});
