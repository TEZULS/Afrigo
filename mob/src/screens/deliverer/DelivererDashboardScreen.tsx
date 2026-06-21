import React from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Truck, ChevronRight } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { Order } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { formatPrice } from '@/utils/format';
import type { DelivererStackParamList } from '@/navigation/types';

interface OrderRow {
  id: string;
  status?: string;
  total: number;
  delivery?: { address?: string; phone?: string };
  deliverer_id?: string;
}

export const DelivererDashboardScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<DelivererStackParamList>>();
  const { user } = useAuth();
  const { colors } = useTheme();

  const myOrders = useQuery<OrderRow[]>({
    queryKey: ['deliverer-orders', user?.id],
    refetchInterval: 30_000,
    queryFn: async () =>
      ((await Order().filter?.({
        deliverer_id: user?.id,
        status: 'out_for_delivery',
      })) ?? []) as OrderRow[],
  });

  return (
    <Screen scroll={false}>
      <Header title="Mes livraisons" />
      {myOrders.isLoading ? (
        <Loader />
      ) : (myOrders.data ?? []).length === 0 ? (
        <EmptyState
          title="Aucune livraison en cours"
          description="Les nouvelles livraisons apparaîtront ici."
          icon={<Truck size={48} color={colors.mutedForeground} />}
        />
      ) : (
        <FlatList
          data={myOrders.data}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ paddingVertical: 12, gap: 8 }}
          refreshing={myOrders.isRefetching}
          onRefresh={myOrders.refetch}
          renderItem={({ item }) => (
            <Pressable onPress={() => nav.navigate('DelivererOrderDetails', { id: item.id })}>
              <Card padding={14} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <View style={styles.row}>
                    <Text style={{ fontWeight: '700', color: colors.foreground }}>
                      #{item.id.slice(-6).toUpperCase()}
                    </Text>
                    <OrderStatusBadge status={item.status} />
                  </View>
                  <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.delivery?.address ?? '—'}
                  </Text>
                  <Text style={[styles.amount, { color: colors.foreground }]}>
                    {formatPrice(item.total)}
                  </Text>
                </View>
                <ChevronRight size={20} color={colors.mutedForeground} />
              </Card>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { fontSize: 12, marginTop: 4 },
  amount: { fontSize: 16, fontWeight: '700', marginTop: 6 },
});
