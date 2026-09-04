import React, { useRef, useState, useCallback } from 'react';
import {
  ScrollView,
  Pressable,
  Text,
  StyleSheet,
  View,
  Platform,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { ChevronRight, ChevronLeft } from 'lucide-react-native';
import { palette } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

import {
  CATEGORIES,
  COSMETIQUE_CATEGORY_IDS,
  FOOD_CATEGORY_IDS,
} from '@/utils/categories';

/** Réexport historique : l'écran de recherche importe `CATEGORIES` d'ici. */
export { CATEGORIES };

const ITEM_WIDTH = 78;
const SCROLL_STEP = 200;

interface Props {
  selected: string;
  onSelect: (id: string) => void;
  availableCategories: string[];
  shopMode?: 'food' | 'cosmetique';
  horizontalInset?: number;
}

export const CategoryFilter: React.FC<Props> = ({
  selected,
  onSelect,
  availableCategories,
  shopMode = 'food',
  horizontalInset = 16,
}) => {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [scrollX, setScrollX] = useState(0);
  const [contentW, setContentW] = useState(0);
  const [viewportW, setViewportW] = useState(0);

  const modeCats = shopMode === 'cosmetique' ? COSMETIQUE_CATEGORY_IDS : FOOD_CATEGORY_IDS;
  /**
   * Une catégorie n'est affichée que si le catalogue du mode courant contient
   * au moins un produit dedans (même règle que le web). Sans ça, l'onglet
   * « Cosmétiques » affichait la pastille « Cosmétique » alors qu'aucun
   * produit n'existe encore.
   */
  const visible = CATEGORIES.filter((c) => {
    if (c.id === 'all') return true;
    if (!modeCats.includes(c.id)) return false;
    return availableCategories.includes(c.id);
  });

  /**
   * Si seule la pastille « Tous » subsiste, le filtre n'a plus aucun intérêt :
   * on masque toute la barre (cas d'un mode sans aucun produit).
   */
  const hasRealCategories = visible.length > 1;

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollX(e.nativeEvent.contentOffset.x);
  }, []);

  const onContentSizeChange = useCallback((w: number) => setContentW(w), []);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setViewportW(e.nativeEvent.layout.width);
  }, []);

  const canScrollRight = contentW > viewportW + 1 && scrollX < contentW - viewportW - 1;
  const canScrollLeft = scrollX > 1;

  const scrollBy = (dir: 1 | -1) => {
    const next = Math.max(0, Math.min(contentW - viewportW, scrollX + dir * SCROLL_STEP));
    scrollRef.current?.scrollTo({ x: next, animated: true });
  };

  if (!hasRealCategories) return null;

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        alwaysBounceHorizontal={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={onContentSizeChange}
        contentContainerStyle={[
          styles.row,
          {
            paddingLeft: 0,
            paddingRight: horizontalInset,
            paddingVertical: 4,
          },
        ]}
        style={styles.scroll}
      >
        {visible.map((cat) => {
          const active = selected === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => onSelect(cat.id)}
              android_ripple={
                Platform.OS === 'android' ? { borderless: true, color: 'transparent' } : undefined
              }
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{ width: ITEM_WIDTH }}
            >
              <View style={styles.col}>
                <View
                  style={[
                    styles.iconRing,
                    {
                      backgroundColor: active ? palette.orange[50] : colors.background,
                      borderColor: active ? palette.brand.orange : 'rgba(15,23,42,0.09)',
                      borderWidth: active ? 2 : Math.max(StyleSheet.hairlineWidth, 1),
                    },
                  ]}
                >
                  <Text style={styles.emoji}>{cat.emoji}</Text>
                </View>
                <Text
                  style={[
                    styles.label,
                    active
                      ? { color: palette.brand.orange, fontWeight: '700' }
                      : { color: palette.slate[600], fontWeight: '600' },
                  ]}
                  numberOfLines={2}
                >
                  {cat.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
        <View style={{ width: 6 }} />
      </ScrollView>

      {canScrollLeft ? (
        <Pressable
          accessibilityLabel="Catégories précédentes"
          onPress={() => scrollBy(-1)}
          hitSlop={6}
          style={[styles.arrow, styles.arrowLeft, { backgroundColor: colors.card }]}
        >
          <ChevronLeft size={18} color={colors.foreground} />
        </Pressable>
      ) : null}

      {canScrollRight ? (
        <Pressable
          accessibilityLabel="Catégories suivantes"
          onPress={() => scrollBy(1)}
          hitSlop={6}
          style={[styles.arrow, styles.arrowRight, { backgroundColor: colors.card }]}
        >
          <ChevronRight size={18} color={colors.foreground} />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  scroll: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flexShrink: 0,
  },
  col: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    width: ITEM_WIDTH,
  },
  iconRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 26,
    lineHeight: 30,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    width: ITEM_WIDTH - 2,
    textAlign: 'center',
  },
  arrow: {
    position: 'absolute',
    top: '40%',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },
  arrowLeft: { left: 4, transform: [{ translateY: -16 }] },
  arrowRight: { right: 4, transform: [{ translateY: -16 }] },
});
