import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import {
  ShoppingBag,
  Package,
  Users,
  MessageCircle,
  Tag,
  Truck,
  Bell,
  CreditCard,
  ChevronRight,
} from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Order, Product, Visitor } from '@/api/entities';
import { useTheme } from '@/theme/ThemeProvider';
import { formatPrice } from '@/utils/format';
import type { AdminDrawerParamList } from '@/navigation/types';
import type { IconComponent } from '@/types/icon';

interface KpiCard {
  label: string;
  value: string;
  Icon: IconComponent;
  color: string;
}

interface ShortcutItem {
  label: string;
  Icon: IconComponent;
  route: keyof AdminDrawerParamList;
  webRoute: string;
}

export const AdminDashboardScreen: React.FC = () => {
  const nav = useNavigation<DrawerNavigationProp<AdminDrawerParamList>>();
  const { colors } = useTheme();

  const ordersToday = useQuery({
    queryKey: ['admin-kpi-orders'],
    queryFn: async () => ((await Order().list?.()) ?? []) as { total: number; status?: string; created_date?: string }[],
  });
  const productsCount = useQuery({
    queryKey: ['admin-kpi-products'],
    queryFn: async () => ((await Product().list?.()) ?? []) as { id: string; stock_quantity?: number }[],
  });
  const visitorsCount = useQuery({
    queryKey: ['admin-kpi-visitors'],
    queryFn: async () => ((await Visitor().list?.()) ?? []) as { id: string }[],
  });

  const orders = ordersToday.data ?? [];
  const totalRevenue = orders.reduce((acc, o) => acc + (o.total ?? 0), 0);

  const kpis: KpiCard[] = [
    { label: 'Commandes', value: String(orders.length), Icon: ShoppingBag, color: '#F97316' },
    { label: 'CA total', value: formatPrice(totalRevenue), Icon: CreditCard, color: '#10B981' },
    { label: 'Produits', value: String((productsCount.data ?? []).length), Icon: Package, color: '#3B82F6' },
    { label: 'Visiteurs', value: String((visitorsCount.data ?? []).length), Icon: Users, color: '#A855F7' },
  ];

  const shortcuts: ShortcutItem[] = [
    { label: 'Commandes', Icon: ShoppingBag, route: 'AdminOrders', webRoute: '/AdminOrders' },
    { label: 'Produits', Icon: Package, route: 'AdminProducts', webRoute: '/AdminProducts' },
    { label: 'Clients', Icon: Users, route: 'AdminUsers', webRoute: '/AdminUsers' },
    { label: 'Messages', Icon: MessageCircle, route: 'AdminMessages', webRoute: '/AdminMessages' },
    {
      label: 'Livreurs',
      Icon: Truck,
      route: 'AdminWebView',
      webRoute: '/AdminDeliverers',
    },
    { label: 'Promotions', Icon: Tag, route: 'AdminWebView', webRoute: '/AdminPromoCodes' },
    {
      label: 'Notifications',
      Icon: Bell,
      route: 'AdminWebView',
      webRoute: '/AdminNotifications',
    },
  ];

  return (
    <Screen scroll>
      <Header
        title="Tableau de bord"
        onBack={undefined}
      />
      <View style={styles.kpiGrid}>
        {kpis.map((k) => (
          <Card key={k.label} padding={14} style={styles.kpiCard}>
            <View style={[styles.kpiIcon, { backgroundColor: k.color + '20' }]}>
              <k.Icon size={20} color={k.color} />
            </View>
            <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{k.label}</Text>
            <Text style={[styles.kpiValue, { color: colors.foreground }]}>{k.value}</Text>
          </Card>
        ))}
      </View>

      <Text style={[styles.section, { color: colors.foreground }]}>Accès rapide</Text>
      <View style={{ gap: 8 }}>
        {shortcuts.map((s) => (
          <Pressable
            key={s.label + s.webRoute}
            onPress={() =>
              s.route === 'AdminWebView'
                ? nav.navigate('AdminWebView', { route: s.webRoute, title: s.label })
                : nav.navigate(s.route)
            }
          >
            <Card padding={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <s.Icon size={20} color={colors.foreground} />
              <Text style={{ flex: 1, color: colors.foreground, fontWeight: '600' }}>{s.label}</Text>
              <ChevronRight size={18} color={colors.mutedForeground} />
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  kpiCard: { width: '48%', gap: 6 },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiLabel: { fontSize: 11, fontWeight: '600' },
  kpiValue: { fontSize: 22, fontWeight: '800' },
  section: { marginTop: 18, fontSize: 14, fontWeight: '700', marginBottom: 8 },
});
