import React, { useCallback, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Platform,
  type FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { ArrowUp } from "lucide-react-native";
import { Pressable } from "@/components/ui/Pressable";
import { useTheme } from "@/theme/ThemeProvider";

/** Défilement (px) au-delà duquel la flèche « retour en haut » apparaît. */
export const SCROLL_TOP_THRESHOLD = 400;

/**
 * État de la flèche pour une liste : visible après {@link SCROLL_TOP_THRESHOLD}
 * pixels de défilement, masquée dès l'appui (retour visuel immédiat).
 */
export function useScrollTop<T>() {
  const listRef = useRef<FlatList<T>>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const past = e.nativeEvent.contentOffset.y > SCROLL_TOP_THRESHOLD;
    setShowScrollTop((prev) => (prev === past ? prev : past));
  }, []);
  const scrollToTop = useCallback(() => {
    setShowScrollTop(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);
  return { listRef, showScrollTop, onScroll, scrollToTop };
}

interface Props {
  visible: boolean;
  onPress: () => void;
  /** Distance depuis le haut de la zone de liste. */
  top?: number;
  testID?: string;
}

/**
 * Flèche flottante « retour en haut » des listes de produits (promotions,
 * nouveautés…), posée en haut à gauche comme sur le site. Le calque est
 * `box-none` : seules les touches sur la flèche sont captées, le reste va à la
 * liste.
 */
export const ScrollTopFab: React.FC<Props> = ({
  visible,
  onPress,
  top = 12,
  testID = "scroll-top",
}) => {
  const { colors } = useTheme();
  if (!visible) return null;
  return (
    <View style={styles.layer} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retour en haut de la page"
        testID={testID}
        onPress={onPress}
        hitSlop={12}
        android_ripple={{
          color: "rgba(0,0,0,0.06)",
          borderless: true,
          radius: 22,
        }}
        style={[
          styles.btn,
          { top, backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <ArrowUp size={18} color={colors.foreground} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    ...Platform.select({ android: { elevation: 6 }, default: {} }),
  },
  btn: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
});
