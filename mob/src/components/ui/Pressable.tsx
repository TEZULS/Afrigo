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
 * Historique : le JSX était compilé avec `jsxImportSource: 'nativewind'` et le
 * `cssInterop` de NativeWind « aplatissait » le style inline avec
 * `{ ...style }` — un `style={({ pressed }) => [...]}` devenait `{}` et **tout
 * le style était perdu sur l'appareil**, alors que Jest (sans NativeWind) le
 * voyait. NativeWind a depuis été retiré du pipeline (cf. `babel.config.js`),
 * mais ce composant reste la façon la plus simple d'avoir un retour visuel à
 * l'appui avec un style statique.
 *
 * Il résout la fonction lui-même (état `pressed` suivi via `onPressIn` /
 * `onPressOut`) et ne transmet à React Native qu'un style statique. Mêmes
 * props qu'un `Pressable` natif.
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
