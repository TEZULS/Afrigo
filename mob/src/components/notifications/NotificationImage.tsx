import React, { useState } from 'react';
import { StyleSheet, type StyleProp } from 'react-native';
import { Image, type ImageLoadEventData, type ImageStyle } from 'expo-image';
import { useTheme } from '@/theme/ThemeProvider';

interface Props {
  uri: string;
  style?: StyleProp<ImageStyle>;
}

/** Ratio largeur/hauteur toléré avant de passer en « contain » (letterbox). */
const MIN_RATIO = 0.8;
const MAX_RATIO = 2.4;
/** Ratio d'attente avant que les dimensions de l'image soient connues. */
const DEFAULT_RATIO = 16 / 9;

/**
 * Illustration d'une notification, affichée **entière**.
 *
 * L'admin envoie des visuels de formats variés (captures d'écran verticales,
 * bannières…) : un cadre 16/7 en `cover` n'en montrait qu'une bande. On lit
 * les dimensions réelles au chargement et on adopte son ratio ; au-delà des
 * bornes (image très haute ou très large), on garde un cadre raisonnable et
 * l'image est contenue dedans plutôt que rognée.
 */
export const NotificationImage: React.FC<Props> = ({ uri, style }) => {
  const { colors } = useTheme();
  const [ratio, setRatio] = useState<number>(DEFAULT_RATIO);
  const [clamped, setClamped] = useState(false);

  const onLoad = (e: ImageLoadEventData) => {
    const { width, height } = e.source;
    if (!width || !height) return;
    const natural = width / height;
    const bounded = Math.min(MAX_RATIO, Math.max(MIN_RATIO, natural));
    setRatio(bounded);
    setClamped(bounded !== natural);
  };

  return (
    <Image
      source={{ uri }}
      onLoad={onLoad}
      contentFit={clamped ? 'contain' : 'cover'}
      style={[styles.image, { aspectRatio: ratio, backgroundColor: colors.muted }, style]}
      accessibilityIgnoresInvertColors
    />
  );
};

const styles = StyleSheet.create({
  image: { width: '100%', borderRadius: 12 },
});
