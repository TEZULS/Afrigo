import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, Info } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import {
  getToastState,
  hideToast,
  subscribeToast,
  type ToastState,
} from '@/hooks/useToast';

const ENTER_DURATION = 180;

/**
 * Hôte des notifications in-app.
 *
 * Contrat : **rien n'est monté quand il n'y a pas de notification**. La
 * visibilité vient de l'état (`useToast`), jamais d'une animation — si
 * l'animation de sortie n'était pas rejouée, un bandeau piloté seulement par
 * l'opacité resterait affiché indéfiniment (bug historique). Ici l'animation
 * n'est qu'un fondu d'entrée : à l'expiration du minuteur le composant renvoie
 * `null` et la vue disparaît, quoi qu'il arrive côté animations natives.
 */
export const ToastHost: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ToastState | null>(() => getToastState());
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => subscribeToast(setState), []);

  const id = state?.id;
  useEffect(() => {
    if (id == null) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: ENTER_DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [id, anim]);

  if (!state) return null;

  const isSuccess = state.type === 'success';
  const accent = isSuccess ? colors.success : colors.brandOrange;

  return (
    <View
      style={[styles.overlay, { paddingTop: insets.top + 8 }]}
      pointerEvents="box-none"
      testID="toast-host"
    >
      <Animated.View
        style={{
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
          ],
        }}
      >
        <Pressable
          accessibilityRole="alert"
          accessibilityLabel={[state.text1, state.text2].filter(Boolean).join('. ')}
          onPress={hideToast}
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderLeftColor: accent,
            },
          ]}
        >
          {isSuccess ? (
            <CheckCircle2 size={20} color={accent} />
          ) : (
            <Info size={20} color={accent} />
          )}
          <View style={styles.texts}>
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
              {state.text1}
            </Text>
            {state.text2 ? (
              <Text style={[styles.body, { color: colors.mutedForeground }]} numberOfLines={3}>
                {state.text2}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  texts: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700' },
  body: { fontSize: 13, lineHeight: 18, marginTop: 2 },
});
