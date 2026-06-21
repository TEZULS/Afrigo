import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@/theme/ThemeProvider';
import type { RootStackParamList } from '@/navigation/types';

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  subtitle?: string;
  centerTitle?: boolean;
  /** Cache la marque AfriGo (par défaut elle s'affiche en haut à gauche). */
  hideBrand?: boolean;
}

/**
 * En-tête commun à tous les écrans :
 * `[← AfriGo]   Titre   [Right]`
 *
 * La marque AfriGo est toujours visible (cf. exigence projet) sauf si
 * `hideBrand` est explicitement passé. Le titre garde sa taille mais
 * `numberOfLines={1}` pour éviter les débordements.
 */
export const Header: React.FC<HeaderProps> = ({
  title,
  onBack,
  right,
  subtitle,
  centerTitle,
  hideBrand,
}) => {
  const { colors } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  /**
   * Tap sur la marque AfriGo : retour à l'accueil, en haut de la liste.
   * `popToTop` ferme tous les écrans empilés ; `navigate` reset le tab
   * focus sur HomeTab.
   */
  const goHome = () => {
    try {
      nav.popToTop();
    } catch {
      /* l'écran n'est peut-être pas dans un stack */
    }
    nav.navigate('ClientTabs', { screen: 'HomeTab' });
  };

  return (
    <View
      style={[
        styles.container,
        { borderBottomColor: colors.border, backgroundColor: colors.background },
      ]}
    >
      <View style={styles.left}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            style={styles.iconButton}
            android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true, radius: 20 }}
          >
            <ChevronLeft size={26} color={colors.foreground} />
          </Pressable>
        ) : null}
        {!hideBrand ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="AfriGo — retour à l'accueil"
            onPress={goHome}
            hitSlop={6}
            android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
            style={styles.brandBtn}
          >
            <Text
              style={[styles.brand, { color: colors.brandOrange }]}
              numberOfLines={1}
            >
              AfriGo
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.center, centerTitle && { alignItems: 'center' }]}>
        {title ? (
          <Text
            style={[
              styles.title,
              { color: colors.foreground, textAlign: centerTitle ? 'center' : 'left' },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
    gap: 4,
  },
  right: { minWidth: 44, alignItems: 'flex-end' },
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 6 },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 6,
  },
  title: { fontSize: 16, fontWeight: '700' },
  subtitle: { fontSize: 12, marginTop: 1 },
});
