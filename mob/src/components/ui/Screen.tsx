import React from 'react';
import {
  KeyboardAvoidingView,
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
   * Slot rendu en haut de l'écran, en dehors du ScrollView : reste affiché
   * quel que soit le défilement (en-tête « toujours visible »). Reçoit le
   * même `paddingHorizontal` que le contenu.
   */
  header?: React.ReactNode;
  /**
   * `behavior` du KeyboardAvoidingView (`padding` par défaut, iOS comme
   * Android).
   *
   * `'none'` désactive complètement le KeyboardAvoidingView : à utiliser
   * quand l'écran gère lui-même l'évitement du clavier (par exemple un
   * ScrollView interne en `automaticallyAdjustKeyboardInsets`), sinon les
   * deux mécanismes se cumulent.
   */
  keyboardBehavior?: 'padding' | 'height' | 'position' | 'none';
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
  header,
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
        `padding` par défaut sur les deux plateformes : en affichage bord à
        bord (Android 15+, API 35/36), `adjustResize` ne rétrécit plus la
        fenêtre et le clavier recouvrait les champs du bas. `padding` mesure le
        recouvrement réel : rien n'est ajouté si la fenêtre a déjà rétréci.
      */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={
          keyboardBehavior === 'none'
            ? undefined
            : (keyboardBehavior ?? 'padding')
        }
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {header ? <View style={{ paddingHorizontal }}>{header}</View> : null}
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
