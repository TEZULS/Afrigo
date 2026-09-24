import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Package, Repeat, Wallet, MessageSquareText } from 'lucide-react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { Badge } from '@/components/ui/Badge';
import { ReturnTracker } from '@/components/returns/ReturnTracker';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { Return } from '@/api/entities';
import { formatDateTime, formatPrice } from '@/utils/format';
import {
  returnReasonLabel,
  returnResolutionLabel,
  returnStatusLabel,
} from '@/utils/returnStatus';
import type { RootStackParamList } from '@/navigation/types';

interface ReturnFull {
  id: string;
  order_id?: string;
  status?: string;
  reason?: string;
  description?: string | null;
  resolution_type?: string;
  photos?: string[];
  items?: { product_id?: string; product_name?: string; name?: string; quantity: number; total_price?: number }[];
  created_date?: string;
  updated_date?: string;
  refund_amount?: number;
  rejection_reason?: string | null;
  admin_message?: string | null;
}

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'destructive' | 'muted'> = {
  pending: 'warning',
  approved: 'success',
  completed: 'success',
  rejected: 'destructive',
};

export const ReturnDetailsScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'ReturnDetails'>>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();

  const query = useQuery<ReturnFull | null>({
    queryKey: ['return', route.params.id],
    queryFn: async () => ((await Return().get?.(route.params.id)) ?? null) as ReturnFull | null,
  });

  if (query.isLoading || !query.data) {
    return (
      <Screen>
        <Header onBack={nav.goBack} title="Retour" />
        <Loader />
      </Screen>
    );
  }

  const r = query.data;
  const status = r.status ?? 'pending';
  const ResolutionIcon = r.resolution_type === 'refund' ? Wallet : Repeat;

  return (
    <Screen scroll refreshing={query.isFetching} onRefresh={() => void query.refetch()}>
      <Header onBack={nav.goBack} title={`Retour #${r.id.slice(-8).toUpperCase()}`} />

      <Card padding={14}>
        <View style={styles.headRow}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, flex: 1 }}>
            {r.created_date ? `Demandé le ${formatDateTime(r.created_date)}` : ''}
          </Text>
          <Badge label={returnStatusLabel(status)} variant={STATUS_VARIANT[status] ?? 'muted'} />
        </View>
        <View style={{ height: 8 }} />
        <ReturnTracker status={status} rejectionReason={r.rejection_reason} />
      </Card>

      {r.admin_message ? (
        <Card padding={14} style={{ marginTop: 12, borderColor: palette.emerald[200] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MessageSquareText size={16} color={palette.emerald[700]} />
            <Text style={{ color: palette.emerald[700], fontWeight: '700', fontSize: 13 }}>
              Message d’AfriGo
            </Text>
          </View>
          <Text style={{ color: colors.foreground, marginTop: 6, lineHeight: 20 }}>{r.admin_message}</Text>
        </Card>
      ) : null}

      <Text style={[styles.section, { color: colors.foreground }]}>Informations du retour</Text>
      <Card padding={14} style={{ marginTop: 8 }}>
        {r.order_id ? (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Commande associée</Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => nav.navigate('OrderDetails', { id: r.order_id! })}
              hitSlop={6}
            >
              <Text style={{ color: palette.emerald[600], fontWeight: '700' }}>
                #{r.order_id.slice(-8).toUpperCase()}
              </Text>
            </Pressable>
          </View>
        ) : null}
        <View style={[styles.infoRow, styles.infoRowBorder, { borderTopColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Raison du retour</Text>
          <Text style={{ color: colors.foreground, fontWeight: '600' }}>{returnReasonLabel(r.reason)}</Text>
        </View>
        {r.resolution_type ? (
          <View style={[styles.infoRow, styles.infoRowBorder, { borderTopColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Résolution</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
              <ResolutionIcon size={14} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontWeight: '600' }}>
                {returnResolutionLabel(r.resolution_type)}
              </Text>
            </View>
          </View>
        ) : null}
        {r.description ? (
          <View style={[styles.infoBlock, { borderTopColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Description</Text>
            <Text style={{ color: colors.foreground, marginTop: 4, lineHeight: 20 }}>{r.description}</Text>
          </View>
        ) : null}
        {(r.refund_amount ?? 0) > 0 ? (
          <View style={[styles.refundBox, { backgroundColor: palette.emerald[50] }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Wallet size={14} color={palette.emerald[700]} />
              <Text style={{ color: palette.emerald[700], fontSize: 12, fontWeight: '700' }}>
                {status === 'completed'
                  ? 'Remboursement crédité sur le portefeuille'
                  : 'Montant du remboursement (sur le portefeuille)'}
              </Text>
            </View>
            <Text style={{ color: palette.emerald[600], fontSize: 22, fontWeight: '800', marginTop: 4 }}>
              {formatPrice(r.refund_amount ?? 0)}
            </Text>
          </View>
        ) : null}
      </Card>

      <Text style={[styles.section, { color: colors.foreground }]}>Produits retournés</Text>
      <Card padding={14} style={{ marginTop: 8 }}>
        {(r.items ?? []).length === 0 ? (
          <Text style={{ color: colors.mutedForeground }}>—</Text>
        ) : null}
        {(r.items ?? []).map((it, i) => (
          <View key={i} style={styles.itemRow}>
            <Package size={16} color={colors.mutedForeground} />
            <Text style={{ color: colors.foreground, flex: 1 }}>
              {it.quantity}× {it.product_name ?? it.name ?? it.product_id ?? 'Article'}
            </Text>
            {it.total_price != null ? (
              <Text style={{ color: colors.foreground, fontWeight: '600' }}>
                {formatPrice(Number(it.total_price) || 0)}
              </Text>
            ) : null}
          </View>
        ))}
      </Card>

      {(r.photos ?? []).length > 0 ? (
        <>
          <Text style={[styles.section, { color: colors.foreground }]}>Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }}>
            {(r.photos ?? []).map((url, i) => (
              <Image
                key={i}
                source={{ uri: url }}
                style={{ width: 96, height: 96, borderRadius: 12 }}
                contentFit="cover"
              />
            ))}
          </ScrollView>
        </>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  section: { fontSize: 14, fontWeight: '700', marginTop: 16 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  infoRowBorder: { borderTopWidth: 1 },
  infoBlock: { borderTopWidth: 1, paddingTop: 10, marginTop: 2 },
  infoLabel: { fontSize: 12 },
  refundBox: { borderRadius: 12, padding: 12, marginTop: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
});
