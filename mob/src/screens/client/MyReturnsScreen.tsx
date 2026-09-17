import React, { useMemo } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronRight, ArrowLeft, Repeat, Wallet } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { ReturnTracker } from '@/components/returns/ReturnTracker';
import { useAuth } from '@/lib/AuthContext';
import { Return } from '@/api/entities';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { formatDateTime, formatPrice } from '@/utils/format';
import { serverDateMs } from '@/utils/serverDate';
import {
  RETURN_STATUS_DESCRIPTIONS,
  returnReasonLabel,
  returnStatusLabel,
} from '@/utils/returnStatus';
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
  resolution_type?: string;
  refund_amount?: number;
  rejection_reason?: string | null;
  admin_message?: string | null;
  created_date?: string;
}

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'destructive' | 'muted'> = {
  pending: 'warning',
  approved: 'success',
  completed: 'success',
  rejected: 'destructive',
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

  /** Plus récentes en premier (l'API ne garantit pas l'ordre). */
  const rows = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => serverDateMs(b.created_date) - serverDateMs(a.created_date)),
    [query.data],
  );

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
      ) : rows.length === 0 ? (
        <EmptyState
          title="Aucun retour"
          description="Vos demandes de retour apparaîtront ici avec leur suivi."
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingVertical: 12, gap: 10, paddingBottom: PERSISTENT_NAV_HEIGHT + 16 }}
          renderItem={({ item }) => {
            const status = item.status ?? 'pending';
            const ResolutionIcon = item.resolution_type === 'refund' ? Wallet : Repeat;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Retour ${item.id.slice(-8).toUpperCase()}, ${returnStatusLabel(status)}`}
                onPress={() => nav.navigate('ReturnDetails', { id: item.id })}
              >
                <Card padding={14}>
                  <View style={styles.headRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.title, { color: colors.foreground }]}>
                        Retour #{item.id.slice(-8).toUpperCase()}
                      </Text>
                      {item.order_id ? (
                        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                          Commande #{item.order_id.slice(-8).toUpperCase()}
                          {item.created_date ? ` · ${formatDateTime(item.created_date)}` : ''}
                        </Text>
                      ) : null}
                    </View>
                    <Badge label={returnStatusLabel(status)} variant={STATUS_VARIANT[status] ?? 'muted'} />
                    <ChevronRight size={18} color={colors.mutedForeground} />
                  </View>

                  <ReturnTracker status={status} rejectionReason={item.rejection_reason} />

                  <View style={[styles.infoBox, { backgroundColor: colors.surfaceMuted }]}>
                    <Text style={[styles.infoLine, { color: colors.foreground }]}>
                      <Text style={{ fontWeight: '700' }}>Motif : </Text>
                      {returnReasonLabel(item.reason)}
                    </Text>
                    {item.resolution_type ? (
                      <View style={styles.resolutionRow}>
                        <ResolutionIcon size={14} color={colors.mutedForeground} />
                        <Text style={[styles.infoLine, { color: colors.foreground }]}>
                          {item.resolution_type === 'refund'
                            ? `Remboursement sur le portefeuille${
                                (item.refund_amount ?? 0) > 0 ? ` · ${formatPrice(item.refund_amount ?? 0)}` : ''
                              }`
                            : 'Échange du produit'}
                        </Text>
                      </View>
                    ) : null}
                    {status !== 'rejected' ? (
                      <Text style={[styles.statusHint, { color: colors.mutedForeground }]}>
                        {RETURN_STATUS_DESCRIPTIONS[status] ?? RETURN_STATUS_DESCRIPTIONS.pending}
                      </Text>
                    ) : null}
                    {item.admin_message ? (
                      <Text style={[styles.adminMsg, { color: palette.emerald[700] }]}>
                        Message d’AfriGo : {item.admin_message}
                      </Text>
                    ) : null}
                  </View>
                </Card>
              </Pressable>
            );
          }}
          refreshing={query.isRefetching}
          onRefresh={query.refetch}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 4 },
  infoBox: { borderRadius: 12, padding: 12, marginTop: 4, gap: 6 },
  infoLine: { fontSize: 13, lineHeight: 18 },
  resolutionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusHint: { fontSize: 12, lineHeight: 17 },
  adminMsg: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
});
