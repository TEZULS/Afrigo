import React from 'react';
import {
  Image,
  Text,
  StyleSheet,
  View,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Pressable } from '@/components/ui/Pressable';

/** Identique aux URLs `Home.jsx`. */
export const SHOP_MODE_IMG_FOOD =
  'https://media.base44.com/images/public/6947869a3a13c81a6fad2204/c1b2e43ba_generated_image.png';
export const SHOP_MODE_IMG_COSMETIC =
  'https://media.base44.com/images/public/6947869a3a13c81a6fad2204/2de187d66_generated_image.png';

const TRACK = '#15803d';
const WHITE = '#ffffff';
const TEXT_FOOD = '#15803d';
const TEXT_COSMETIC_ACTIVE = '#ec4899';

export type ShopMode = 'food' | 'cosmetique';

interface ShopModeSegmentProps {
  mode: ShopMode;
  onChange: (mode: ShopMode) => void;
}

/**
 * Deux zones **égales** (flexBasis: 0 sur Android).
 * Le fond blanc de l’onglet actif est sur une **View interne** : sur Android le
 * `Pressable` + ripple ignore souvent le background → pas de « carré blanc » et
 * texte vert (`Alimentation`) illisible sur le vert.
 */
export const ShopModeSegment: React.FC<ShopModeSegmentProps> = ({ mode, onChange }) => {
  const { width: ww } = useWindowDimensions();
  // Compact, même gabarit que la pastille du web déployé : ~44 px de haut,
  // vignette 24 px, pas de pleine largeur.
  const img = Math.min(26, Math.max(20, Math.round(ww * 0.06)));
  const fs = ww < 340 ? 11 : ww < 400 ? 12 : 13;
  const lineH = Math.round(fs * 1.3);

  return (
    <View style={styles.wrapOuter} accessibilityRole="tablist">
      <View style={styles.track}>
        <SegmentItem
          label="Alimentation"
          selected={mode === 'food'}
          onPress={() => onChange('food')}
          thumb={SHOP_MODE_IMG_FOOD}
          activeLabelColor={TEXT_FOOD}
          inactiveLabelColor={WHITE}
          imgSize={img}
          fontSize={fs}
          lineHeight={lineH}
          hint="Voir les produits alimentaires"
        />
        <View style={{ width: 6 }} />
        <SegmentItem
          label="Cosmétiques"
          selected={mode === 'cosmetique'}
          onPress={() => onChange('cosmetique')}
          thumb={SHOP_MODE_IMG_COSMETIC}
          activeLabelColor={TEXT_COSMETIC_ACTIVE}
          inactiveLabelColor={WHITE}
          imgSize={img}
          fontSize={fs}
          lineHeight={lineH}
          hint="Voir les cosmétiques"
        />
      </View>
    </View>
  );
};

interface SegmentItemProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  thumb: string;
  activeLabelColor: string;
  inactiveLabelColor: string;
  imgSize: number;
  fontSize: number;
  lineHeight: number;
  hint: string;
}

function SegmentItem({
  label,
  selected,
  onPress,
  thumb,
  activeLabelColor,
  inactiveLabelColor,
  imgSize,
  fontSize,
  lineHeight,
  hint,
}: SegmentItemProps) {
  const labelColor = selected ? activeLabelColor : inactiveLabelColor;

  return (
    <View style={styles.slot}>
      <Pressable
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ selected }}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        hitSlop={4}
        style={({ pressed }) => [styles.pressable, { opacity: pressed ? 0.92 : 1 }]}
      >
        <View style={[styles.card, selected ? styles.cardSelected : styles.cardIdle]}>
          <Image
            source={{ uri: thumb }}
            resizeMode="cover"
            style={{
              width: imgSize,
              height: imgSize,
              borderRadius: imgSize / 2,
              backgroundColor: '#e2e8f0',
            }}
          />
          <Text
            style={[
              styles.caption,
              {
                color: labelColor,
                fontSize,
                lineHeight,
              },
            ]}
            numberOfLines={2}
          >
            {label}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const OUT_RADIUS = 999;
const INNER_RADIUS = 999;

const styles = StyleSheet.create({
  wrapOuter: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: TRACK,
    borderRadius: OUT_RADIUS,
    paddingHorizontal: 3,
    paddingVertical: 3,
  },
  slot: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 40,
    justifyContent: 'center',
  },
  pressable: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: INNER_RADIUS,
    overflow: 'hidden',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: INNER_RADIUS,
    minHeight: 38,
    width: '100%',
    gap: 6,
  },
  cardIdle: {
    backgroundColor: 'transparent',
  },
  cardSelected: {
    backgroundColor: WHITE,
    borderWidth: Platform.OS === 'android' ? 1 : StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.12,
          shadowRadius: 4,
        }
      : { elevation: 3 }),
  },
  caption: {
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
    paddingHorizontal: 2,
    marginTop: 0,
    flexShrink: 1,
  },
});
