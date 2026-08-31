import React, { forwardRef, useCallback, useState } from 'react';
import {
  Pressable as RNPressable,
  type GestureResponderEvent,
  type PressableProps,
  type View,
} from 'react-native';

/**
 * `Pressable` sans style-fonction.
 *
 * L'app compile son JSX avec `jsxImportSource: 'nativewind'` : chaque
 * `Pressable` passe par le `cssInterop` de NativeWind, qui « aplatit » le
 * style inline avec `{ ...style }`. Quand `style` est une fonction
 * (`({ pressed }) => [...]`), le spread d'une fonction donne `{}` : **tout le
 * style est perdu sur l'appareil** (bordure, padding, fond…), alors que Jest
 * — où NativeWind est désactivé — le voit correctement.
 *
 * Ce composant résout la fonction lui-même (état `pressed` suivi via
 * `onPressIn` / `onPressOut`) et ne transmet à React Native qu'un style
 * statique, que l'interop conserve. Mêmes props qu'un `Pressable` natif : à
 * utiliser partout où l'on veut un retour visuel à l'appui.
 */
export const Pressable = forwardRef<View, PressableProps>(function Pressable(
  { style, onPressIn, onPressOut, ...rest },
  ref,
) {
  const [pressed, setPressed] = useState(false);

  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      setPressed(true);
      onPressIn?.(e);
    },
    [onPressIn],
  );
  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      setPressed(false);
      onPressOut?.(e);
    },
    [onPressOut],
  );

  const resolvedStyle = typeof style === 'function' ? style({ pressed }) : style;

  return (
    <RNPressable
      ref={ref}
      {...rest}
      style={resolvedStyle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    />
  );
});
