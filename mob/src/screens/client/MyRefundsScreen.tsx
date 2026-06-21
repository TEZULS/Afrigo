import React, { useMemo, useState } from 'react';
import { FlatList, View, Text, StyleSheet, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Banknote,
  ArrowLeft,
  Wallet,
  CreditCard,
} from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/lib/AuthContext';
import { Refund } from '@/api/entities';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { formatDate, formatPrice } from '@/utils/format';
import {
  PersistentBottomNav,
  PERSISTENT_NAV_HEIGHT,
} from '@/components/PersistentBottomNav';
import type { RootStackParamList } from '@/navigation/types';
import type { IconComponent } from '@/types/icon';

interface RefundRow {
  id: string;
  amount: number;
  status?: 'pending' | 'approved' | 'completed' | 'refunded' | 'rejected' | string;
  refund_method?: 'card' | 'wallet' | 'cash';
  method?: 'card' | 'wallet' | 'cash';
  order_id?: string;
  created_date?: string;
}

type Tab = 'all' | 'pending' | 'approved' | 'refunded' | 'rejected';

const STATUS_TO_TAB = (s?: string): Tab => {
  if (!s) return 'pending';
  if (s === 'pending') return 'pending';
  if (s === 'approved') return 'approved';
  if (s === 'completed' || s === 'refunded') return 'refunded';
  if (s === 'rejected') return 'rejected';
  return 'pending';
};

export const MyRefundsScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('all');

  const query = useQuery<RefundRow[]>({
    queryKey: ['my-refunds', user?.email],
    enabled: Boolean(user?.email),
    queryFn: async () =>
      ((await Refund().filter?.({ customer_email: user!.email })) ?? []) as RefundRow[],
  });

  const refunds = query.data ?? [];

  const counts = useMemo(() => {
    const c = { all: refunds.length, pending: 0, approved: 0, refunded: 0, rejected: 0 };
    refunds.forEach((r) => {
      const t = STATUS_TO_TAB(r.status);
      if (t === 'pending') c.pending += 1;
      else if (t === 'approved') c.approved += 1;
      else if (t === 'refunded') c.refunded += 1;
      else if (t === 'rejected') c.rejected += 1;
    });
    return c;
  }, [refunds]);

  const filtered = useMemo(() => {
    if (tab === 'all') return refunds;
    return refunds.filter((r) => STATUS_TO_TAB(r.status) === tab);
  }, [refunds, tab]);

  return (
    <Screen scroll={false} bottomBar={<PersistentBottomNav />}>
      <Header title="Mes remboursements" />

      <Pressable
        accessibilityRole="link"
        onPress={() =>
          nav.canGoBack() ? nav.goBack() : nav.navigate('ClientTabs', { screen: 'OrdersTab' })
        }
        style={styles.backRow}
        hitSlop={6}
      >
        <ArrowLeft size={18} color={colors.foreground} />
        <Text style={[styles.backTxt, { color: colors.foreground }]}>Retour aux commandes</Text>
      </Pressable>

      <Text style={[styles.heroTitle, { color: colors.foreground }]}>Mes remboursements</Text>
      <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
        Suivez l&apos;état de vos demandes de remboursement
      </Text>

      <View style={styles.statRow}>
        <StatCard
          Icon={Clock}
          iconColor={palette.orange[600]}
          label="En attente"
          value={counts.pending}
        />
        <StatCard
          Icon={CheckCircle2}
          iconColor={palette.orange[600]}
          label="Approuvé"
          value={counts.approved}
        />
      </View>
      <View style={[styles.statRow, { marginTop: 8 }]}>
        <StatCard
          Icon={CheckCircle2}
          iconColor={palette.emerald[600]}
          label="Remboursé"
          value={counts.refunded}
        />
        <StatCard
          Icon={XCircle}
          iconColor={palette.rose[500]}
          label="Refusé"
          value={counts.rejected}
        />
      </View>

      <View style={styles.tabs}>
        {(
          [
            { id: 'all' as const, label: `Tous (${counts.all})` },
            { id: 'pending' as const, label: `En attente (${counts.pending})` },
            { id: 'approved' as const, label: `Approuvés (${counts.approved})` },
            { id: 'refunded' as const, label: `Remboursés (${counts.refunded})` },
            { id: 'rejected' as const, label: `Refusés (${counts.rejected})` },
          ] as const
        ).map((t) => {
          const sel = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={[
                styles.tabBtn,
                {
                  backgroundColor: sel ? colors.background : 'transparent',
                  borderColor: sel ? colors.border : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: sel ? colors.foreground : colors.mutedForeground,
                  fontWeight: sel ? '700' : '500',
                  fontSize: 12,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {query.isLoading ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <Card padding={32} style={[styles.emptyCard, { borderColor: colors.border }]}>
          <View style={[styles.emptyIcon, { borderColor: colors.border }]}>
            <Banknote size={36} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Aucune demande de remboursement
          </Text>
        </Card>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingVertical: 8, gap: 8 }}
          renderItem={({ item }) => {
            const tabKey = STATUS_TO_TAB(item.status);
            const variant =
              tabKey === 'refunded'
                ? 'success'
                : tabKey === 'rejected'
                  ? 'destructive'
                  : tabKey === 'approved'
                    ? 'brand'
                    : 'warning';
            const method = item.refund_method ?? item.method;
            return (
              <Card padding={14} style={{ borderColor: colors.border, borderWidth: 1 }}>
                <View style={styles.refundRow}>
                  <Text
                    style={{ flex: 1, color: colors.foreground, fontWeight: '800', fontSize: 18 }}
                  >
                    {formatPrice(item.amount)}
                  </Text>
                  <Badge label={item.status ?? 'pending'} variant={variant} />
                </View>
                <View style={[styles.metaRow, { marginTop: 6 }]}>
                  {method === 'card' ? (
                    <CreditCard size={14} color={colors.mutedForeground} />
                  ) : method === 'wallet' ? (
                    <Wallet size={14} color={colors.mutedForeground} />
                  ) : (
                    <Banknote size={14} color={colors.mutedForeground} />
                  )}
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    {method === 'card'
                      ? 'Sur carte bancaire'
                      : method === 'wallet'
                        ? 'Sur portefeuille'
                        : 'Espèces'}
                    {item.created_date ? ` · ${formatDate(item.created_date, 'dd MMM yyyy')}` : ''}
                  </Text>
                </View>
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
};

interface StatCardProps {
  Icon: IconComponent;
  iconColor: string;
  label: string;
  value: number;
}

const StatCard: React.FC<StatCardProps> = ({ Icon, iconColor, label, value }) => {
  const { colors } = useTheme();
  return (
    <Card padding={14} style={[styles.statCard, { borderColor: colors.border }]}>
      <View style={styles.statHeader}>
        <Icon size={16} color={iconColor} />
        <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      </View>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </Card>
  );
};

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  backTxt: { fontSize: 14, fontWeight: '600' },
  heroTitle: { fontSize: 24, fontWeight: '800' },
  heroSubtitle: { fontSize: 13, marginTop: 4, marginBottom: 12 },

  statRow: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, borderWidth: 1 },
  statHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 4 },

  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginVertical: 14,
    rowGap: 4,
  },
  tabBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },

  emptyCard: {
    borderWidth: 1,
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
  },
  emptyIcon: {
    width: 72,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 14, textAlign: 'center' },

  refundRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
