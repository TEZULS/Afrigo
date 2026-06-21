import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Phone,
  MessageSquare,
  RotateCcw,
  Calendar,
  CreditCard,
  Wallet,
  AlertTriangle,
  MapPin,
} from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { Badge } from '@/components/ui/Badge';
import { OrderTracker } from '@/components/orders/OrderTracker';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { Order } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { useAppSettings } from '@/hooks/useAppSettings';
import { formatDateTime, formatPrice } from '@/utils/format';
import type { RootStackParamList } from '@/navigation/types';

interface OrderItem {
  product_id?: string;
  product_name?: string;
  name?: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
  selected_variants?: Record<string, { type?: string; value?: string }> | null;
}

interface OrderFull {
  id: string;
  status?: string;
  payment_method?: 'card' | 'delivery' | string;
  payment_status?: string;
  total_amount?: number;
  amount_to_pay?: number;
  promo_code?: string | null;
  promo_discount?: number;
  wallet_amount_used?: number;
  delivery_fee?: number;
  delivery_lat?: number;
  delivery_lng?: number;
  delivery_address?: string;
  delivery_postal_code?: string;
  delivery_city?: string;
  delivery_failure_reason?: string;
  delivery?: { address?: string; lat?: number; lng?: number; phone?: string };
  customer_email?: string;
  estimated_delivery?: string;
  delivery_time?: string;
  notes?: string;
  cancellation_reason?: string;
  delivered_date?: string;
  updated_date?: string;
  items?: OrderItem[];
  created_date?: string;
}

const cancelLikeStatus = (s?: string) => s === 'cancelled' || s === 'not_delivered' || s === 'failed_delivery';

export const OrderDetailsScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'OrderDetails'>>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const settings = useAppSettings();

  const query = useQuery<OrderFull | null>({
    queryKey: ['order', route.params.id],
    queryFn: async () => ((await Order().get?.(route.params.id)) ?? null) as OrderFull | null,
  });

  if (query.isLoading || !query.data) {
    return (
      <Screen>
        <Header onBack={nav.goBack} title="Commande" />
        <Loader />
      </Screen>
    );
  }

  const order = query.data;
  const items = order.items ?? [];
  const itemsSubtotal = items.reduce(
    (s, i) => s + (i.total_price ?? i.unit_price * i.quantity),
    0,
  );
  const promoDiscount = order.promo_discount ?? 0;
  const walletUsed = order.wallet_amount_used ?? 0;
  const computedDeliveryFee = order.delivery_fee != null
    ? Number(order.delivery_fee)
    : Math.max(0, (order.total_amount ?? 0) - itemsSubtotal - promoDiscount + walletUsed);

  const lat = order.delivery_lat ?? order.delivery?.lat ?? 48.8566;
  const lng = order.delivery_lng ?? order.delivery?.lng ?? 2.3522;
  const hasMapCoords =
    (order.delivery_lat != null && order.delivery_lng != null) ||
    !!(order.delivery?.lat && order.delivery?.lng);

  const phone =
    (user?.['phone'] as string | undefined) ?? order.delivery?.phone ?? settings.data?.support_phone;

  const callPhone = (n?: string) => n && Linking.openURL(`tel:${n}`);

  /**
   * Bouton « Demander un retour » : visible uniquement pendant 2 h après la
   * livraison effective. Avant : si `delivered_date` manquait, on retournait
   * `true` → le bouton restait visible indéfiniment. Maintenant on retombe
   * sur `updated_date` (mis à jour quand l'admin marque la commande livrée),
   * et on cache le bouton si aucune date fiable n'est disponible.
   */
  const canRequestReturn = (() => {
    if (order.status !== 'delivered') return false;
    const ref = order.delivered_date ?? order.updated_date;
    if (!ref) return false;
    const hours = (Date.now() - new Date(ref).getTime()) / 36e5;
    return hours <= 2;
  })();

  return (
    <Screen scroll>
      <Header onBack={nav.goBack} title={`#${order.id.slice(-8).toUpperCase()}`} />

      <Card padding={14}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.dateLabel, { color: colors.mutedForeground }]}>
            {order.created_date ? formatDateTime(order.created_date) : ''}
          </Text>
          <OrderStatusBadge status={order.status} />
        </View>
        <View style={{ height: 8 }} />
        {!cancelLikeStatus(order.status) ? (
          <OrderTracker status={order.status ?? 'pending'} />
        ) : null}
      </Card>

      {cancelLikeStatus(order.status) && (order.delivery_failure_reason || order.cancellation_reason) ? (
        <Card padding={14} style={{ marginTop: 12, borderColor: colors.destructive }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <AlertTriangle size={18} color={colors.destructive} />
            <Text style={{ color: colors.destructive, fontWeight: '700' }}>
              {order.status === 'cancelled' ? "Motif d'annulation" : 'Motif de non-livraison'}
            </Text>
          </View>
          <Text style={{ color: colors.foreground, lineHeight: 20 }}>
            {order.delivery_failure_reason ?? order.cancellation_reason}
          </Text>
        </Card>
      ) : null}

      {order.estimated_delivery ? (
        <Card padding={12} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Calendar size={18} color={colors.brandOrange} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Livraison prévue</Text>
              <Text style={{ color: colors.foreground, fontWeight: '700', marginTop: 2 }}>
                {order.estimated_delivery}
                {order.delivery_time ? ` à ${order.delivery_time}` : ''}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <Card padding={14} style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <MapPin size={18} color={colors.brandOrange} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Adresse de livraison</Text>
            <Text style={{ color: colors.foreground, fontWeight: '600', marginTop: 2 }}>
              {order.delivery_address ?? '—'}
            </Text>
            <Text style={{ color: colors.foreground, marginTop: 2 }}>
              {[order.delivery_postal_code, order.delivery_city].filter(Boolean).join(' ')}
            </Text>
          </View>
        </View>
      </Card>

      {hasMapCoords ? (
        <Card padding={0} style={{ marginTop: 12, overflow: 'hidden' }}>
          <MapView
            style={{ height: 200 }}
            initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
          >
            <Marker coordinate={{ latitude: lat, longitude: lng }} />
          </MapView>
        </Card>
      ) : null}

      <Text style={[styles.section, { color: colors.foreground }]}>Articles</Text>
      <Card padding={14} style={{ marginTop: 8 }}>
        {items.map((it, idx) => {
          const variants = it.selected_variants
            ? Object.values(it.selected_variants)
                .map((v) => `${v?.type ?? ''}: ${v?.value ?? ''}`.trim())
                .filter(Boolean)
            : [];
          return (
            <View key={idx} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground }}>
                  {it.quantity}× {it.product_name ?? it.name ?? '—'}
                </Text>
                {variants.length > 0 ? (
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {variants.map((v, i) => (
                      <Badge key={i} label={v} variant="muted" />
                    ))}
                  </View>
                ) : null}
              </View>
              <Text style={{ color: colors.foreground, fontWeight: '600' }}>
                {formatPrice((it.total_price ?? it.unit_price * it.quantity))}
              </Text>
            </View>
          );
        })}
      </Card>

      <Card padding={14} style={{ marginTop: 12 }}>
        <View style={styles.totalRow}>
          <Text style={{ color: colors.mutedForeground }}>Sous-total articles</Text>
          <Text style={{ color: colors.foreground }}>{formatPrice(itemsSubtotal)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={{ color: colors.mutedForeground }}>Frais de livraison</Text>
          <Text style={{ color: colors.foreground }}>
            {computedDeliveryFee > 0.01 ? formatPrice(computedDeliveryFee) : 'Offerts'}
          </Text>
        </View>
        {promoDiscount > 0 ? (
          <View style={styles.totalRow}>
            <Text style={{ color: colors.mutedForeground }}>
              Code promo{order.promo_code ? ` ${order.promo_code}` : ''}
            </Text>
            <Text style={{ color: colors.brandOrange, fontWeight: '700' }}>
              -{formatPrice(promoDiscount)}
            </Text>
          </View>
        ) : null}
        {walletUsed > 0 ? (
          <View style={styles.totalRow}>
            <Text style={{ color: colors.mutedForeground }}>Portefeuille</Text>
            <Text style={{ color: colors.brandOrange, fontWeight: '700' }}>
              -{formatPrice(walletUsed)}
            </Text>
          </View>
        ) : null}
        <View style={[styles.totalRow, { marginTop: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }]}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.foreground }}>Total</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.foreground }}>
            {formatPrice(order.total_amount ?? 0)}
          </Text>
        </View>
        <View
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {order.payment_method === 'delivery' ? (
            <Wallet size={16} color={colors.foreground} />
          ) : (
            <CreditCard size={16} color={colors.foreground} />
          )}
          <Text style={{ color: colors.foreground, fontWeight: '600', flex: 1 }}>
            {order.payment_method === 'delivery' ? 'Paiement à la livraison' : 'Paiement par carte'}
          </Text>
          {order.payment_method === 'delivery' && order.amount_to_pay != null ? (
            <Text style={{ color: colors.foreground, fontWeight: '800' }}>
              {formatPrice(order.amount_to_pay)}
            </Text>
          ) : null}
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        <Button
          title="Service client"
          variant="outline"
          fullWidth
          leftIcon={<Phone size={16} color={colors.foreground} />}
          onPress={() => callPhone(phone ?? settings.data?.support_phone)}
          style={{ flex: 1 }}
        />
        <Button
          title="Messages"
          variant="outline"
          fullWidth
          leftIcon={<MessageSquare size={16} color={colors.foreground} />}
          onPress={() => nav.navigate('Messages')}
          style={{ flex: 1 }}
        />
      </View>

      {canRequestReturn ? (
        <Button
          title="Demander un retour"
          variant="ghost"
          fullWidth
          leftIcon={<RotateCcw size={16} color={colors.foreground} />}
          onPress={() => nav.navigate('Returns', { orderId: order.id })}
          style={{ marginTop: 8 }}
        />
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  section: { marginTop: 16, fontSize: 14, fontWeight: '700' },
  dateLabel: { fontSize: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 6, gap: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
});
