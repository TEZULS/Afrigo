import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';

const NAME = 'AfriGo';
/** Orange exact du fond du logo (icône de l'app) : pas de rupture à l'ouverture. */
export const LAUNCH_BACKGROUND = '#F9600C';
/** Chariot souriant du logo, détouré en blanc (`assets/cart-white.png`, 1060 × 726). */
const CART_IMAGE = require('../../assets/cart-white.png');
const CART_HEIGHT = 58;
const CART_WIDTH = Math.round((CART_HEIGHT * 1060) / 726);
/** Écart entre la fin du nom et le chariot, à l'arrivée. */
const GAP = 10;
/** Traversée du chariot, pause sur le logo complet, disparition. */
const TRAVEL_MS = 1400;
const HOLD_MS = 450;
const FADE_MS = 350;

interface Props {
  onDone: () => void;
}

/**
 * Ouverture de l'app, sur le fond orange du logo : le chariot du logo (en
 * blanc) traverse l'écran de gauche à droite et les lettres d'« AfriGo »
 * apparaissent en blanc derrière lui, au fur et à mesure de son passage ; le
 * logo complet reste un instant, puis l'écran s'efface sur l'accueil.
 */
export const LaunchIntro: React.FC<Props> = ({ onDone }) => {
  const { width } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  /** Largeur du nom, mesurée : sert à caler l'apparition des lettres sur le chariot. */
  const [nameWidth, setNameWidth] = useState(0);

  useEffect(() => {
    if (!nameWidth) return;
    const animation = Animated.sequence([
      Animated.timing(progress, {
        toValue: 1,
        duration: TRAVEL_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.delay(HOLD_MS),
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => animation.stop();
    // `onDone` peut changer d'identité sans relancer l'animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameWidth]);

  // Le chariot part hors de l'écran à gauche et finit juste après le nom.
  const travel = width;
  const cartX = progress.interpolate({ inputRange: [0, 1], outputRange: [-travel, 0] });

  /**
   * Une lettre apparaît quand le chariot (son bord gauche) dépasse son centre :
   * position de la lettre depuis l'arrivée du chariot, rapportée à la traversée.
   */
  const letterWidth = nameWidth / NAME.length;
  const letterStyle = (index: number) => {
    const distanceToEnd = GAP + nameWidth - (index + 0.5) * letterWidth;
    const at = Math.min(0.98, Math.max(0.02, 1 - distanceToEnd / travel));
    const range = { inputRange: [at - 0.03, at + 0.03], extrapolate: 'clamp' as const };
    return {
      opacity: progress.interpolate({ ...range, outputRange: [0, 1] }),
      transform: [{ translateY: progress.interpolate({ ...range, outputRange: [8, 0] }) }],
    };
  };

  const onNameLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== nameWidth) setNameWidth(w);
  };

  return (
    <Animated.View style={[styles.overlay, { opacity }]} testID="launch-intro">
      <View style={styles.row}>
        <View style={styles.name} onLayout={onNameLayout} accessibilityLabel={NAME}>
          {NAME.split('').map((letter, i) => (
            <Animated.Text
              key={`${letter}-${i}`}
              style={[styles.letter, nameWidth ? letterStyle(i) : styles.hidden]}
            >
              {letter}
            </Animated.Text>
          ))}
        </View>
        <Animated.Image
          source={CART_IMAGE}
          resizeMode="contain"
          testID="launch-intro-cart"
          style={[styles.cart, { transform: [{ translateX: cartX }] }]}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: LAUNCH_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  name: { flexDirection: 'row' },
  letter: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#FFFFFF',
  },
  cart: { width: CART_WIDTH, height: CART_HEIGHT, marginLeft: GAP },
  hidden: { opacity: 0 },
});
