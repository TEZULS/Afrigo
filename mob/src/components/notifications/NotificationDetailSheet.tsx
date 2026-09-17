import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Trash2, X, ChevronRight, MapPin, Calendar, Receipt } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { Order } from '@/api/entities';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDateTime, formatPrice } from '@/utils/format';
import type { NotificationItem } from '@/hooks/useNotificationsFeed';
import { notificationVisual } from './notificationPresentation';
import { NotificationImage } from './NotificationImage';

interface Props {
  item: NotificationItem | null;
  onClose: () => void;
  /** Ouvre l'écran lié (commande, produit, promotions, panier, messagerie) — absent si rien à ouvrir. */
  onOpenTarget?: () => void;
  onDelete: () => void;
}

/** Sous-ensemble de `Order` affiché dans le récapitulatif. */
interface OrderSummary {
  id: string;
  status?: string;
  total_amount?: number;
  amount_to_pay?: number;
  payment_method?: string;
  delivery_address?: string;
  delivery_postal_code?: string;
  delivery_city?: string;
  estimated_delivery?: string;
  delivery_time?: string;
  created_date?: string;
  items?: { product_name?: string; name?: string; quantity: number }[];
}

const targetLabelFor = (item: NotificationItem | null): string | null => {
  if (!item) return null;
  switch (item.kind) {
    case 'order':
      return item.orderId ? 'Voir la commande' : null;
    case 'message':
      return 'Voir le message';
    case 'product':
      return item.productId ? 'Voir le produit' : null;
    case 'promotion':
      return 'Voir les promotions';
    case 'cart':
      return 'Voir mon panier';
    case 'return':
      return item.returnId ? 'Voir ma demande de retour' : null;
    default:
      return null;
  }
};

/**
 * Feuille de lecture d'une notification : catégorie, titre, texte complet (la
 * liste ne montre que deux lignes), illustration éventuelle, date — et, pour
 * une commande, son récapitulatif (statut, articles, montant, adresse,
 * livraison prévue) chargé à l'ouverture. Depuis ici on peut ouvrir l'écran
 * lié ou supprimer la notification.
 */
export const NotificationDetailSheet: React.FC<Props> = ({
  item,
  onClose,
  onOpenTarget,
  onDelete,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const visible = item != null;
  const visual = notificationVisual(item ?? { kind: 'custom' });
  const targetLabel = targetLabelFor(item);

  const orderId = item?.kind === 'order' ? item.orderId : undefined;
  const orderQuery = useQuery<OrderSummary | null>({
    queryKey: ['order', orderId],
    enabled: Boolean(orderId),
    queryFn: async () => ((await Order().get?.(orderId as string)) ?? null) as OrderSummary | null,
  });
  const order = orderQuery.data;
  const orderItems = order?.items ?? [];
  const orderTotal = order?.total_amount ?? 0;
  const orderAddress = order
    ? [order.delivery_address, [order.delivery_postal_code, order.delivery_city].filter(Boolean).join(' ')]
        .filter((s) => s && s.trim())
        .join(', ')
    : '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(insets.bottom, 12) + 8,
            },
          ]}
          testID="notification-detail-sheet"
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          <View style={styles.head}>
            <View style={[styles.headIcon, { backgroundColor: visual.bg }]}>
              <visual.Icon size={22} color={visual.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kind, { color: visual.color }]}>{visual.label.toUpperCase()}</Text>
              <Text style={[styles.title, { color: colors.foreground }]}>{item?.title}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              onPress={onClose}
              hitSlop={10}
              style={styles.closeBtn}
            >
              <X size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {item?.imageUrl ? <NotificationImage uri={item.imageUrl} style={styles.image} /> : null}
            <Text style={[styles.body, { color: colors.foreground }]} selectable>
              {item?.body || 'Aucun détail supplémentaire.'}
            </Text>
            {item?.date ? (
              <Text style={[styles.date, { color: colors.mutedForeground }]}>
                Reçue le {formatDateTime(item.date)}
              </Text>
            ) : null}

            {orderId ? (
              <View
                style={[styles.orderCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                testID="notification-order-summary"
              >
                <View style={styles.orderHead}>
                  <Text style={[styles.orderTitle, { color: colors.foreground }]}>
                    Commande #{orderId.slice(-8).toUpperCase()}
                  </Text>
                  {order?.status ? <OrderStatusBadge status={order.status} /> : null}
                </View>
                {orderQuery.isLoading ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 6 }}>
                    Chargement du récapitulatif…
                  </Text>
                ) : order ? (
                  <>
                    {order.created_date ? (
                      <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                        Passée le {formatDateTime(order.created_date)}
                      </Text>
                    ) : null}
                    {orderItems.length > 0 ? (
                      <View style={styles.orderItems}>
                        {orderItems.slice(0, 4).map((it, i) => (
                          <Text
                            key={i}
                            style={{ color: colors.foreground, fontSize: 13, lineHeight: 19 }}
                            numberOfLines={1}
                          >
                            {it.quantity}× {it.product_name ?? it.name ?? 'Article'}
                          </Text>
                        ))}
                        {orderItems.length > 4 ? (
                          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                            + {orderItems.length - 4} autre{orderItems.length - 4 > 1 ? 's' : ''} article
                            {orderItems.length - 4 > 1 ? 's' : ''}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                    <View style={styles.orderRow}>
                      <Receipt size={15} color={colors.mutedForeground} />
                      <Text style={[styles.orderMeta, { color: colors.mutedForeground, flex: 1 }]}>
                        Total
                      </Text>
                      <Text style={{ color: colors.foreground, fontWeight: '800' }}>
                        {formatPrice(orderTotal)}
                      </Text>
                    </View>
                    {orderAddress ? (
                      <View style={styles.orderRow}>
                        <MapPin size={15} color={colors.mutedForeground} />
                        <Text
                          style={[styles.orderMeta, { color: colors.foreground, flex: 1 }]}
                          numberOfLines={2}
                        >
                          {orderAddress}
                        </Text>
                      </View>
                    ) : null}
                    {order.estimated_delivery ? (
                      <View style={styles.orderRow}>
                        <Calendar size={15} color={colors.mutedForeground} />
                        <Text style={[styles.orderMeta, { color: colors.foreground }]}>
                          Livraison prévue : {order.estimated_delivery}
                          {order.delivery_time ? ` à ${order.delivery_time}` : ''}
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 6 }}>
                    Le récapitulatif n&apos;est pas disponible. Ouvrez la commande pour voir le détail.
                  </Text>
                )}
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            {targetLabel && onOpenTarget ? (
              <Button
                title={targetLabel}
                variant="brand"
                fullWidth
                testID="notification-detail-open"
                onPress={onOpenTarget}
                rightIcon={<ChevronRight size={18} color="#FFF" />}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Supprimer cette notification"
              testID="notification-detail-delete"
              onPress={onDelete}
              style={({ pressed }) => [
                styles.deleteBtn,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Trash2 size={16} color={colors.destructive} />
              <Text style={[styles.deleteText, { color: colors.destructive }]}>Supprimer</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kind: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  title: { fontSize: 17, fontWeight: '800', lineHeight: 22, marginTop: 2 },
  closeBtn: { padding: 6 },
  scroll: { flexGrow: 0, marginTop: 12 },
  scrollContent: { paddingBottom: 6 },
  image: { borderRadius: 14, marginBottom: 12 },
  body: { fontSize: 15, lineHeight: 22 },
  date: { fontSize: 12, marginTop: 10 },
  orderCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 14 },
  orderHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  orderTitle: { fontSize: 14, fontWeight: '800' },
  orderItems: { marginTop: 8, gap: 2 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  orderMeta: { fontSize: 13 },
  actions: { marginTop: 14, gap: 10 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
  },
  deleteText: { fontSize: 14, fontWeight: '700' },
});
