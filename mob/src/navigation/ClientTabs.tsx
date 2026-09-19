import React from 'react';
import { View, Platform, StyleSheet, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, ShoppingBag, ShoppingCart, Menu, User, Search, Bell } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { HomeScreen } from '@/screens/client/HomeScreen';
import { OrdersScreen } from '@/screens/client/OrdersScreen';
import { CartScreen } from '@/screens/client/CartScreen';
import { ProfileScreen } from '@/screens/client/ProfileScreen';
import { MenuScreen } from '@/screens/client/MenuScreen';
import { NotificationsScreen } from '@/screens/client/NotificationsScreen';
import { PromotionsScreen } from '@/screens/client/PromotionsScreen';
import { NewProductsScreen } from '@/screens/client/NewProductsScreen';
import { useCart } from '@/stores/cart';
import { useNotificationsFeed } from '@/hooks/useNotificationsFeed';
import { useMenuDrawer, type MenuActiveRoute } from '@/stores/menuDrawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ClientTabParamList, RootStackParamList } from './types';
import type { LucideProps } from 'lucide-react-native';

const Tab = createBottomTabNavigator<ClientTabParamList>();

type IconComp = React.ComponentType<LucideProps>;

function TabGlyph({
  Icon,
  focused,
  color,
  badge,
}: {
  Icon: IconComp;
  focused: boolean;
  color: string;
  badge?: number;
}) {
  const size = 34;
  const r = size / 2;
  const showBadge = badge != null && badge > 0;
  const badgeLabel = badge != null && badge > 99 ? '99+' : badge != null ? String(badge) : '';

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? palette.orange[50] : palette.transparent,
        borderWidth: focused ? 2 : 0,
        borderColor: focused ? palette.brand.orange : palette.transparent,
        ...(focused && Platform.OS === 'ios'
          ? {
              shadowColor: palette.brand.orange,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.16,
              shadowRadius: 6,
            }
          : {}),
        ...(focused && Platform.OS === 'android' ? { elevation: 3 as const } : {}),
      }}
    >
      <Icon color={color} size={focused ? 20 : 19} strokeWidth={focused ? 2.45 : 2} />
      {showBadge ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -4,
            minWidth: 17,
            height: 17,
            borderRadius: 9,
            paddingHorizontal: 4,
            backgroundColor: palette.brand.orange,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '800' }}>{badgeLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

export const ClientTabs: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 10 : 8);
  const cartLines = useCart((s) => s.lines);
  const cartCount = cartLines.reduce((acc, l) => acc + l.quantity, 0);
  const { unreadCount } = useNotificationsFeed();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandOrange,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarItemStyle: {
          paddingTop: 4,
          paddingBottom: 2,
          paddingHorizontal: 0,
          flex: 1,
          gap: 2,
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 6,
          minHeight: 58 + bottomPad,
          paddingBottom: bottomPad,
        },
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 0.05,
          marginTop: 0,
          paddingBottom: 0,
          includeFontPadding: false,
        },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph Icon={Home} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="OrdersTab"
        component={OrdersScreen}
        options={{
          title: 'Commandes',
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph Icon={ShoppingBag} focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CartTab"
        component={CartScreen}
        options={{
          title: 'Panier',
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph Icon={ShoppingCart} focused={focused} color={color} badge={cartCount} />
          ),
        }}
      />
      {/*
        Onglet 🔍 : ouvre l'écran de recherche plein écran (route racine
        `Search`) — champ + suggestions du catalogue + historique. Le profil
        reste accessible depuis le menu latéral (bouton ☰ en haut de l'accueil).
      */}
      <Tab.Screen
        name="SearchTab"
        component={HomeScreen}
        options={{
          title: 'Recherche',
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph Icon={Search} focused={focused} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('Search');
          },
        })}
      />
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph Icon={Bell} focused={focused} color={color} badge={unreadCount} />
          ),
        }}
      />

      {/*
        Écrans conservés hors barre (`tabBarItemStyle: display none`) : le
        menu est désormais un bouton ☰ en haut de l'accueil, et le profil
        s'ouvre depuis ce menu. Les routes restent déclarées pour que les
        navigations existantes (`ClientTabs > ProfileTab`) fonctionnent encore.
      */}
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          title: 'Profil',
          tabBarItemStyle: { display: 'none' },
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph Icon={User} focused={focused} color={color} />
          ),
        }}
      />
      {/*
        Promotions / Nouveautés : écrans d'onglet masqués dans la barre. Y être
        empilés (et non au-dessus des onglets) garde la barre du bas visible,
        comme le demande le parcours « Voir plus » de l'accueil.
      */}
      <Tab.Screen
        name="PromotionsTab"
        component={PromotionsScreen}
        options={{ title: 'Promotions', tabBarItemStyle: { display: 'none' } }}
      />
      <Tab.Screen
        name="NewProductsTab"
        component={NewProductsScreen}
        options={{ title: 'Nouveaux produits', tabBarItemStyle: { display: 'none' } }}
      />

      <Tab.Screen
        name="MenuTab"
        component={MenuScreen}
        options={{
          title: 'Menu',
          tabBarItemStyle: { display: 'none' },
          tabBarIcon: ({ color, focused }) => (
            <TabGlyph Icon={Menu} focused={focused} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // On n'ouvre pas l'écran Menu — on déclenche le drawer latéral.
            e.preventDefault();
            const state = navigation.getState();
            const currentName = state?.routes?.[state.index]?.name as
              | MenuActiveRoute
              | undefined;
            useMenuDrawer
              .getState()
              .open(currentName && currentName !== 'MenuTab' ? currentName : null);
          },
        })}
      />
    </Tab.Navigator>
  );
};
