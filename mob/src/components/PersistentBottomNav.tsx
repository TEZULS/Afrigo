import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Home, ShoppingBag, ShoppingCart, Search, Bell } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { useCart } from '@/stores/cart';
import { useNotificationsFeed } from '@/hooks/useNotificationsFeed';
import type { RootStackParamList } from '@/navigation/types';
import type { IconComponent } from '@/types/icon';

/**
 * Mapping nom de route stack → onglet logique pour le highlight visuel.
 * Une route comme `MyRefunds` ou `Payment` est ouverte depuis le menu mais
 * appartient logiquement à `Commandes` ou `Panier`.
 */
const ROUTE_TO_TAB: Record<string, 'home' | 'orders' | 'cart' | 'search' | 'notifications'> = {
  Home: 'home',
  HomeTab: 'home',
  ProductDetails: 'home',
  AllReviews: 'home',
  Promotions: 'home',
  HabitualProducts: 'home',
  Orders: 'orders',
  OrdersTab: 'orders',
  OrderDetails: 'orders',
  Returns: 'orders',
  ReturnDetails: 'orders',
  MyReturns: 'orders',
  MyRefunds: 'orders',
  Cart: 'cart',
  CartTab: 'cart',
  Checkout: 'cart',
  Payment: 'cart',
  SearchTab: 'search',
  Search: 'search',
  Notifications: 'notifications',
  NotificationsTab: 'notifications',
};

interface TabBtnProps {
  Icon: IconComponent;
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}

const TabBtn: React.FC<TabBtnProps> = ({ Icon, label, active, badge, onPress }) => {
  const { colors } = useTheme();
  const tint = active ? colors.brandOrange : colors.mutedForeground;
  const showBadge = badge != null && badge > 0;
  const badgeLabel = badge != null && badge > 99 ? '99+' : badge != null ? String(badge) : '';
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
      style={styles.tab}
    >
      <View
        style={[
          styles.icon,
          {
            backgroundColor: active ? palette.orange[50] : 'transparent',
            borderColor: active ? palette.brand.orange : 'transparent',
            borderWidth: active ? 2 : 0,
          },
        ]}
      >
        <Icon color={tint} size={active ? 20 : 19} strokeWidth={active ? 2.45 : 2} />
        {showBadge ? (
          <View style={[styles.badge, { backgroundColor: palette.brand.orange }]}>
            <Text style={styles.badgeTxt}>{badgeLabel}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
};

/**
 * Bottom-nav persistante pour les écrans empilés au-dessus de `ClientTabs`
 * (Paiement, Mes retours, Mes remboursements, Avis clients, etc.). Reproduit
 * exactement l'allure du tab bar de `ClientTabs` afin que la transition soit
 * invisible pour l'utilisateur.
 */
export const PersistentBottomNav: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const cartCount = useCart((s) => s.lines.reduce((acc, l) => acc + l.quantity, 0));
  const { unreadCount } = useNotificationsFeed();

  const activeTab = ROUTE_TO_TAB[route.name] ?? null;
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 10 : 8);

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: bottomPad,
        },
      ]}
    >
      <TabBtn
        Icon={Home}
        label="Accueil"
        active={activeTab === 'home'}
        onPress={() => nav.navigate('ClientTabs', { screen: 'HomeTab' })}
      />
      <TabBtn
        Icon={ShoppingBag}
        label="Commandes"
        active={activeTab === 'orders'}
        onPress={() => nav.navigate('ClientTabs', { screen: 'OrdersTab' })}
      />
      <TabBtn
        Icon={ShoppingCart}
        label="Panier"
        active={activeTab === 'cart'}
        badge={cartCount}
        onPress={() => nav.navigate('ClientTabs', { screen: 'CartTab' })}
      />
      <TabBtn
        Icon={Search}
        label="Recherche"
        active={activeTab === 'search'}
        onPress={() => nav.navigate('Search')}
      />
      <TabBtn
        Icon={Bell}
        label="Notifications"
        active={activeTab === 'notifications'}
        badge={unreadCount}
        onPress={() => nav.navigate('ClientTabs', { screen: 'NotificationsTab' })}
      />
    </View>
  );
};

/** Hauteur réservée pour ne pas masquer le contenu sous la barre. */
export const PERSISTENT_NAV_HEIGHT = 64;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  label: { fontSize: 9, fontWeight: '700', letterSpacing: 0.05 },
});
