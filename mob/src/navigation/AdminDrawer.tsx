import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useTheme } from '@/theme/ThemeProvider';
import { AdminDashboardScreen } from '@/screens/admin/AdminDashboardScreen';
import { AdminWebViewScreen } from '@/screens/admin/AdminWebViewScreen';
import type { AdminDrawerParamList } from './types';

const Drawer = createDrawerNavigator<AdminDrawerParamList>();

/**
 * Stratégie Admin : `AdminDashboard` natif + écrans natifs simples (Orders,
 * Products, Users, Messages) qui réutilisent les composants UI mobiles.
 * Les écrans admin lourds (impressions, AudioContext, drag & drop) sont
 * délégués à `AdminWebViewScreen` (WebView authentifié) — voir docs/MIGRATION.md.
 */
export const AdminDrawer: React.FC = () => {
  const { colors } = useTheme();
  return (
    <Drawer.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        drawerActiveBackgroundColor: colors.brandOrange + '22',
        drawerActiveTintColor: colors.brandOrange,
        drawerInactiveTintColor: colors.foreground,
      }}
    >
      <Drawer.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{ title: 'Tableau de bord' }}
      />
      <Drawer.Screen
        name="AdminOrders"
        component={AdminWebViewScreen}
        initialParams={{ route: '/AdminOrders', title: 'Commandes' }}
        options={{ title: 'Commandes' }}
      />
      <Drawer.Screen
        name="AdminProducts"
        component={AdminWebViewScreen}
        initialParams={{ route: '/AdminProducts', title: 'Produits' }}
        options={{ title: 'Produits' }}
      />
      <Drawer.Screen
        name="AdminUsers"
        component={AdminWebViewScreen}
        initialParams={{ route: '/AdminUsers', title: 'Clients' }}
        options={{ title: 'Clients' }}
      />
      <Drawer.Screen
        name="AdminMessages"
        component={AdminWebViewScreen}
        initialParams={{ route: '/AdminMessages', title: 'Messages' }}
        options={{ title: 'Messages' }}
      />
      <Drawer.Screen
        name="AdminWebView"
        component={AdminWebViewScreen}
        options={{ title: 'Administration' }}
      />
    </Drawer.Navigator>
  );
};
