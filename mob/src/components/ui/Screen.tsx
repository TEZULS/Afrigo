import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/theme/ThemeProvider';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  paddingHorizontal?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
  bg?: string;
  /**
   * Slot rendu en bas de l'écran, à l'intérieur du SafeAreaView mais en
   * dehors du ScrollView : reste épinglé en bas du viewport peu importe le
   * scroll. Idéal pour la barre de navigation persistante.
   */
  bottomBar?: React.ReactNode;
  /**
   * Force un `behavior` actif pour le KeyboardAvoidingView, y compris sur
   * Android (par défaut on laisse `adjustResize` faire le travail). À
   * activer pour les formulaires avec beaucoup de champs en bas (Login,
   * Register, ProfileEdit) sinon les inputs du bas sont masqués par le
   * clavier malgré le scroll.
   */
  keyboardBehavior?: 'padding' | 'height' | 'position';
  keyboardVerticalOffset?: number;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  scroll = false,
  contentStyle,
  paddingHorizontal = 16,
  refreshing,
  onRefresh,
  edges = ['top', 'left', 'right'],
  bg,
  bottomBar,
  keyboardBehavior,
  keyboardVerticalOffset,
}) => {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const background = bg ?? colors.background;

  const Wrapper = scroll ? ScrollView : View;
  const wrapperProps = scroll
    ? {
        contentContainerStyle: [
          { paddingHorizontal, paddingBottom: insets.bottom + 24 },
          contentStyle,
        ],
        refreshControl: onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.brandOrange} />
        ) : undefined,
        keyboardShouldPersistTaps: 'handled' as const,
        showsVerticalScrollIndicator: false,
        style: { flex: 1 },
      }
    : { style: [{ flex: 1, paddingHorizontal }, contentStyle] };

  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/*
        Par défaut : Android laisse `windowSoftInputMode="adjustResize"` agir
        nativement (`behavior=undefined`) ; iOS utilise `padding`. Pour les
        formulaires longs (Login/Register/ProfileEdit) on peut forcer un
        `keyboardBehavior` actif sur les deux plateformes via la prop.
      */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          keyboardBehavior ?? (Platform.OS === 'ios' ? 'padding' : undefined)
        }
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <Wrapper {...(wrapperProps as object)}>{children}</Wrapper>
        {bottomBar}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
});
