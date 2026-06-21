import React from 'react';
import { FlatList, Pressable, View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, ArrowLeft } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/AuthContext';
import { Return } from '@/api/entities';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDateTime } from '@/utils/format';
import {
  PersistentBottomNav,
  PERSISTENT_NAV_HEIGHT,
} from '@/components/PersistentBottomNav';
import type { RootStackParamList } from '@/navigation/types';

interface ReturnRow {
  id: string;
  order_id?: string;
  status?: string;
  reason?: string;
  created_date?: string;
}

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'destructive' | 'muted'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
  refunded: 'success',
};

export const MyReturnsScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { colors } = useTheme();

  const query = useQuery<ReturnRow[]>({
    queryKey: ['my-returns', user?.email],
    enabled: Boolean(user?.email),
    queryFn: async () => ((await Return().filter?.({ customer_email: user!.email })) ?? []) as ReturnRow[],
  });

  return (
    <Screen scroll={false} bottomBar={<PersistentBottomNav />}>
      <Header title="Mes retours" />
      <Pressable
        accessibilityRole="link"
        onPress={() =>
          nav.canGoBack() ? nav.goBack() : nav.navigate('ClientTabs', { screen: 'OrdersTab' })
        }
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 }}
        hitSlop={6}
      >
        <ArrowLeft size={18} color={colors.foreground} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.foreground }}>
          Retour aux commandes
        </Text>
      </Pressable>
      {query.isLoading ? (
        <Loader />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState title="Aucun retour" description="Vos demandes apparaîtront ici." />
      ) : (
        <FlatList
          data={query.data}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingVertical: 12, gap: 8 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => nav.navigate('ReturnDetails', { id: item.id })}>
              <Card padding={14} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.foreground }]}>
                    Retour #{item.id.slice(-6).toUpperCase()}
                  </Text>
                  <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {item.reason ?? '—'}
                  </Text>
                  <View style={{ marginTop: 6, flexDirection: 'row', gap: 8 }}>
                    <Badge label={item.status ?? 'pending'} variant={STATUS_VARIANT[item.status ?? 'pending'] ?? 'muted'} />
                    {item.created_date ? (
                      <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                        {formatDateTime(item.created_date)}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <ChevronRight size={18} color={colors.mutedForeground} />
              </Card>
            </Pressable>
          )}
          refreshing={query.isRefetching}
          onRefresh={query.refetch}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 4 },
});
