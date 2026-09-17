import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  FileText,
  MessageSquare,
  RotateCcw,
  Calendar,
  CreditCard,
  Wallet,
  AlertTriangle,
  MapPin,
  ShieldCheck,
} from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { Badge } from '@/components/ui/Badge';
import { OrderTracker } from '@/components/orders/OrderTracker';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { Order, Return } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';
import { orderIssueMessage, userErrorMessage } from '@/lib/userErrors';
import { useTheme } from '@/theme/ThemeProvider';
import { useToast } from '@/hooks/useToast';
import { formatDateTime, formatPrice } from '@/utils/format';
import { shouldShowDeliveryCode } from '@/utils/deliveryCode';
import {
  canRequestReturn as canRequestReturnHelper,
  hasLockingReturn,
  isOrderPaid,
  paidByWalletOnly,
  type ReturnRequestRow,
} from '@/utils/orderHelpers';
import { shareOrderInvoice } from '@/services/invoice';
import type { RootStackParamList } from '@/navigation/types';

interface OrderItem {
  product_id?: string;
  product_name?: string;
  name?: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
  vat_rate?: number | null;
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
  delivery_code?: string;
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
  const toast = useToast();
  const [invoiceBusy, setInvoiceBusy] = React.useState(false);

  const query = useQuery<OrderFull | null>({
    queryKey: ['order', route.params.id],
    queryFn: async () => ((await Order().get?.(route.params.id)) ?? null) as OrderFull | null,
  });

  /**
   * Demandes de retour du client : le bouton « Demander un retour » ne
   * disparaît que si l'une d'elles a été approuvée ou terminée sur cette
   * commande (ou une fois le délai passé) — plusieurs demandes sont possibles.
   */
  const returnsQuery = useQuery<ReturnRequestRow[]>({
    queryKey: ['returns-mine', user?.email],
    enabled: Boolean(user?.email),
    queryFn: async () =>
      ((await Return().filter?.({ customer_email: user!.email })) ?? []) as ReturnRequestRow[],
  });

  /**
   * Pull-to-refresh : recharge la commande pour que le suivi
   * (Reçue → Préparation → Livraison → Livrée) se mette à jour sans avoir à
   * quitter puis rouvrir l'écran.
   */
  const { refetch } = query;
  const onRefresh = React.useCallback(() => {
    void refetch();
  }, [refetch]);

  if (query.isLoading || !query.data) {
    return (
      <Screen scroll refreshing={query.isFetching} onRefresh={onRefresh}>
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

  /**
   * `notes` = instructions saisies au checkout + « Tel: … » ajouté par l'app.
   * On n'affiche que la partie utile au client (le téléphone est déjà le sien).
   */
  const deliveryInstructions = (order.notes ?? '')
    .split('\n')
    .filter((line) => line.trim() && !/^tel\s*:/i.test(line.trim()))
    .join('\n')
    .trim();

  const walletOnly = paidByWalletOnly(order);
  const paymentLabel = walletOnly
    ? 'Payé avec le portefeuille'
    : order.payment_method === 'delivery'
      ? 'Paiement à la livraison'
      : 'Paiement par carte';
  const PaymentIcon = walletOnly || order.payment_method === 'delivery' ? Wallet : CreditCard;

  /**
   * Facture PDF générée sur l'appareil puis proposée à l'enregistrement /
   * au partage (Fichiers, mail…).
   */
  const downloadInvoice = async () => {
    if (invoiceBusy) return;
    setInvoiceBusy(true);
    try {
      await shareOrderInvoice(order, {
        email: user?.email,
        full_name: user?.full_name,
        first_name: user?.['first_name'] as string | undefined,
        last_name: user?.['last_name'] as string | undefined,
        customer_id: user?.customer_id,
        phone: user?.['phone'] as string | undefined,
      });
    } catch (e) {
      toast.error(
        'Facture indisponible',
        userErrorMessage(e, 'La facture n’a pas pu être générée. Réessayez dans un instant.'),
      );
    } finally {
      setInvoiceBusy(false);
    }
  };

  /**
   * Bouton « Demander un retour » : commande livrée, dans l'heure qui suit
   * `delivered_date` (sinon `updated_date`), et aucune demande déjà approuvée
   * ou terminée. Les dates serveur sont lues en UTC (`parseServerDate`) :
   * avant, le décalage horaire consommait le délai d'avance et le bouton
   * n'apparaissait jamais.
   */
  const canRequestReturn = canRequestReturnHelper(order, {
    locked: hasLockingReturn(returnsQuery.data, order.id),
  });

  return (
    <Screen scroll refreshing={query.isFetching} onRefresh={onRefresh}>
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

      {shouldShowDeliveryCode(order.status, order.delivery_code) ? (
        <Card padding={16} style={{ marginTop: 12, borderColor: colors.brandGreen }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={16} color={colors.brandGreen} />
            <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 13 }}>
              Code de confirmation
            </Text>
          </View>
          <View style={styles.codeRow}>
            {(order.delivery_code ?? '').split('').map((digit, i) => (
              <View
                key={i}
                style={[
                  styles.codeDigit,
                  { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.codeDigitText, { color: colors.foreground }]}>{digit}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
            Communiquez ce code au livreur au moment de la remise. Il en a besoin pour valider la
            livraison. Ne le donnez à personne d'autre.
          </Text>
        </Card>
      ) : null}

      {cancelLikeStatus(order.status) && (order.delivery_failure_reason || order.cancellation_reason) ? (
        <Card padding={14} style={{ marginTop: 12, borderColor: colors.destructive }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <AlertTriangle size={18} color={colors.destructive} />
            <Text style={{ color: colors.destructive, fontWeight: '700' }}>
              {order.status === 'cancelled' ? "Motif d'annulation" : 'Motif de non-livraison'}
            </Text>
          </View>
          {/*
            Le motif vient parfois d'un échec technique (SDK de paiement,
            fonction serveur) : `orderIssueMessage` le remplace par une phrase
            compréhensible plutôt que d'exposer le message brut au client.
          */}
          <Text style={{ color: colors.foreground, lineHeight: 20 }}>
            {orderIssueMessage(
              order.delivery_failure_reason ?? order.cancellation_reason,
              order.status === 'cancelled'
                ? 'Cette commande a été annulée.'
                : 'La livraison n’a pas pu être effectuée.',
            )}
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
            {deliveryInstructions ? (
              <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  Instructions de livraison
                </Text>
                <Text style={{ color: colors.foreground, marginTop: 2, lineHeight: 19 }}>
                  {deliveryInstructions}
                </Text>
              </View>
            ) : null}
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
          <PaymentIcon size={16} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontWeight: '600', flex: 1 }}>
            {paymentLabel}
          </Text>
          {!walletOnly && order.payment_method === 'delivery' && order.amount_to_pay != null ? (
            <Text style={{ color: colors.foreground, fontWeight: '800' }}>
              {formatPrice(order.amount_to_pay)}
            </Text>
          ) : null}
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        {/* Pas de facture tant que le paiement n'a pas abouti (échoué, abandonné, en attente). */}
        {isOrderPaid(order) ? (
        <Button
          title="Facture"
          variant="outline"
          fullWidth
          loading={invoiceBusy}
          disabled={invoiceBusy}
          leftIcon={<FileText size={16} color={colors.foreground} />}
          onPress={() => void downloadInvoice()}
          style={{ flex: 1 }}
          accessibilityHint="Télécharge la facture PDF de cette commande"
          testID="order-invoice"
        />
        ) : null}
        <Button
          title="Service client"
          variant="outline"
          fullWidth
          leftIcon={<MessageSquare size={16} color={colors.foreground} />}
          onPress={() => nav.navigate('Messages')}
          style={{ flex: 1 }}
          testID="order-support"
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
  codeRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 10 },
  codeDigit: {
    width: 46,
    height: 54,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeDigitText: { fontSize: 24, fontWeight: '800', letterSpacing: 1 },
});
