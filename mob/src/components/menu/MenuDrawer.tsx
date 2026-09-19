import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  ScrollView,
  Platform,
  BackHandler,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Product } from '@/api/entities';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Home,
  User,
  ShoppingBag,
  Star,
  ChefHat,
  Phone,
  Settings as SettingsIcon,
  Tag,
  X,
} from 'lucide-react-native';
import { useMenuDrawer, type MenuActiveRoute } from '@/stores/menuDrawer';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { useAuth } from '@/lib/AuthContext';
import type { RootStackParamList } from '@/navigation/types';
import type { IconComponent } from '@/types/icon';

const MAX_PANEL_WIDTH = 340;
const PANEL_RATIO = 0.78;

interface DrawerItem {
  label: string;
  Icon: IconComponent;
  onPress: () => void;
  matchTab?: MenuActiveRoute;
}

export const MenuDrawer: React.FC = () => {
  const { isOpen, activeRoute, close } = useMenuDrawer();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width: screenWidth } = useWindowDimensions();

  const panelWidth = Math.min(MAX_PANEL_WIDTH, Math.round(screenWidth * PANEL_RATIO));

  /**
   * « Mes offres » (page Promotions, comme sur le site) n'est proposé que
   * s'il existe au moins une promotion active au catalogue.
   */
  const promotionsQuery = useQuery<{ is_active?: boolean; promotion_price?: number | null }[]>({
    queryKey: ['promotions'],
    staleTime: 60_000,
    queryFn: async () =>
      ((await Product().filter?.({ is_promotion: true })) ?? []) as {
        is_active?: boolean;
        promotion_price?: number | null;
      }[],
  });
  const hasOffers = (promotionsQuery.data ?? []).some(
    (p) => p.is_active !== false && p.promotion_price != null,
  );

  const progress = useSharedValue(0);
  const panelWidthSV = useSharedValue(panelWidth);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    panelWidthSV.value = panelWidth;
  }, [panelWidth, panelWidthSV]);

  useEffect(() => {
    cancelAnimation(progress);
    if (isOpen) {
      setVisible(true);
      progress.value = withTiming(1, {
        duration: 240,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      progress.value = withTiming(
        0,
        { duration: 200, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setVisible)(false);
        },
      );
    }
  }, [isOpen, progress]);

  useEffect(() => {
    if (!isOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [isOpen, close]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const panelAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * panelWidthSV.value }],
  }));

  const navigateThen = useCallback(
    (run: () => void, requireAuth = false) => {
      close();
      if (requireAuth && !isAuthenticated) {
        nav.navigate('Login', { initialMode: 'login' });
      } else {
        run();
      }
    },
    [close, isAuthenticated, nav],
  );

  if (!visible && !isOpen) return null;

  /**
   * Ordre demandé : Accueil / Mon profil / Mes recettes / Mes commandes /
   * [Mes offres, s'il y a des promotions] / Avis clients / Nous contacter /
   * Paramètres.
   *
   * Paiement, Mes retours et Mes remboursements ont quitté ce menu : ils sont
   * regroupés dans « Paramètres » (`SettingsScreen`).
   */
  const items: DrawerItem[] = [
    {
      label: 'Accueil',
      Icon: Home,
      matchTab: 'HomeTab',
      onPress: () =>
        navigateThen(() => nav.navigate('ClientTabs', { screen: 'HomeTab' })),
    },
    {
      label: 'Mon profil',
      Icon: User,
      matchTab: 'ProfileTab',
      onPress: () =>
        navigateThen(
          () => nav.navigate('ClientTabs', { screen: 'ProfileTab' }),
          true,
        ),
    },
    {
      label: 'Mes recettes',
      Icon: ChefHat,
      onPress: () => navigateThen(() => nav.navigate('Recipes')),
    },
    {
      label: 'Mes commandes',
      Icon: ShoppingBag,
      matchTab: 'OrdersTab',
      onPress: () =>
        navigateThen(
          () => nav.navigate('ClientTabs', { screen: 'OrdersTab' }),
          true,
        ),
    },
    ...(hasOffers
      ? [
          {
            label: 'Mes offres',
            Icon: Tag,
            onPress: () =>
              navigateThen(() => nav.navigate('ClientTabs', { screen: 'PromotionsTab' })),
          } satisfies DrawerItem,
        ]
      : []),
    {
      label: 'Avis clients',
      Icon: Star,
      onPress: () =>
        navigateThen(() => nav.navigate('AllReviews', { productId: '' }), true),
    },
    {
      label: 'Nous contacter',
      Icon: Phone,
      onPress: () => navigateThen(() => nav.navigate('Contact'), true),
    },
    {
      label: 'Paramètres',
      Icon: SettingsIcon,
      onPress: () => navigateThen(() => nav.navigate('Settings')),
    },
  ];

  const topPad = Math.max(insets.top, 12);

  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents={isOpen ? 'auto' : 'none'}
      accessibilityViewIsModal={isOpen}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          accessibilityLabel="Fermer le menu"
          style={StyleSheet.absoluteFill}
          onPress={close}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            width: panelWidth,
            backgroundColor: colors.background,
            paddingTop: topPad,
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: -2, height: 0 },
                shadowOpacity: 0.16,
                shadowRadius: 12,
              },
              android: { elevation: 16 },
            }),
          },
          panelAnimStyle,
        ]}
        accessibilityRole="menu"
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="AfriGo — retour à l'accueil"
            onPress={() => {
              close();
              nav.navigate('ClientTabs', { screen: 'HomeTab' });
            }}
            hitSlop={6}
            style={styles.brandBtn}
            android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
          >
            <Text style={[styles.brand, { color: colors.brandOrange }]}>AfriGo</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Fermer le menu"
            onPress={close}
            hitSlop={10}
            style={styles.closeBtn}
            android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true, radius: 22 }}
          >
            <X size={22} color={palette.blue[500]} />
          </Pressable>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
        >
          {items.map((it) => {
            const isActive = !!it.matchTab && activeRoute === it.matchTab;
            const RowIcon = it.Icon;
            return (
              <Pressable
                key={it.label}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: isActive }}
                onPress={it.onPress}
                android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                style={[
                  styles.row,
                  { backgroundColor: isActive ? palette.slate[100] : 'transparent' },
                ]}
              >
                <View style={styles.iconSlot}>
                  <RowIcon
                    size={22}
                    color={colors.foreground}
                    strokeWidth={isActive ? 2.4 : 2}
                  />
                </View>
                <Text
                  style={[
                    styles.rowLabel,
                    { color: colors.foreground, fontWeight: isActive ? '800' : '700' },
                  ]}
                  numberOfLines={1}
                >
                  {it.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  brand: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  brandBtn: {
    paddingVertical: 4,
    paddingRight: 6,
    borderRadius: 6,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  scroll: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginVertical: 2,
  },
  iconSlot: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    // Libellés en gras (demande client) ; l'entrée active est encore plus appuyée.
    fontWeight: '700',
  },
});
