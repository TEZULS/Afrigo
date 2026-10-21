import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronRight,
  XCircle,
  RefreshCw,
  Star,
  Wallet,
  CreditCard,
  Package,
  RotateCcw,
  ArrowLeft,
} from 'lucide-react-native';
import { useRoute } from '@react-navigation/native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge';
import { Order, Refund, Review, CartItem, Return, Product } from '@/api/entities';
import { hydrateLocalCartFromServer } from '@/services/cartServerSync';
import { useCart } from '@/stores/cart';
import { palette } from '@/theme/tokens';
import {
  PersistentBottomNav,
  PERSISTENT_NAV_HEIGHT,
} from '@/components/PersistentBottomNav';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { useToast } from '@/hooks/useToast';
import { formatDateTime, formatPrice } from '@/utils/format';
import type { RootStackParamList } from '@/navigation/types';
import { userErrorMessage } from '@/lib/userErrors';
import { canRequestRefund, canRequestReturn, hasLockingReturn } from '@/utils/orderHelpers';
import { sellingPrice } from '@/utils/productPricing';

interface OrderRow {
  id: string;
  total_amount?: number;
  amount_to_pay?: number;
  status?: string;
  payment_method?: 'card' | 'delivery' | string;
  payment_status?: string;
  wallet_amount_used?: number;
  cancellation_reason?: string;
  delivered_date?: string;
  updated_date?: string;
  created_date?: string;
  customer_email?: string;
  delivery_city?: string;
  items?: { product_id?: string; product_name?: string; name?: string; quantity: number; unit_price?: number }[];
  /** Réclamation réactivée par l'admin : plus de délai d'une heure. */
  return_request_reopened?: boolean;
}

interface RefundRow {
  id: string;
  order_id: string;
  status?: string;
}

interface ReviewRow {
  id: string;
  order_id?: string;
  rating?: number;
}

interface ReturnRow {
  id: string;
  order_id: string;
  status?: string;
}

type Tab = 'all' | 'active' | 'completed' | 'cancelled';

const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'shipped', 'out_for_delivery'];

export const OrdersScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { user } = useAuth();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');
  /** OrdersTab = onglet → tab bar du Tab.Navigator déjà visible.
   *  Orders (stack) = écran ouvert depuis le menu → besoin de la barre persistante. */
  const isStackScreen = route.name === 'Orders';

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<OrderRow | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState<OrderRow | null>(null);
  const [refundMethod, setRefundMethod] = useState<'wallet' | 'card' | ''>('');

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<OrderRow | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');

  const ordersQuery = useQuery<OrderRow[]>({
    queryKey: ['orders', user?.email],
    enabled: Boolean(user?.email),
    queryFn: async () =>
      ((await Order().filter?.({ customer_email: user!.email }, '-created_date')) ??
        []) as OrderRow[],
    /**
     * Polling toutes les 30 s + refetch au focus pour que le statut
     * (pending → preparing → shipped → delivered) se mette à jour sans
     * que le client ait à fermer l'app.
     */
    refetchInterval: 30_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const refundsQuery = useQuery<RefundRow[]>({
    queryKey: ['refunds', user?.email],
    enabled: Boolean(user?.email),
    queryFn: async () =>
      ((await Refund().filter?.({ customer_email: user!.email })) ?? []) as RefundRow[],
  });

  const reviewsQuery = useQuery<ReviewRow[]>({
    queryKey: ['reviews-mine', user?.email],
    enabled: Boolean(user?.email),
    queryFn: async () =>
      ((await Review().filter?.({ customer_email: user!.email })) ?? []) as ReviewRow[],
  });

  const returnsQuery = useQuery<ReturnRow[]>({
    queryKey: ['returns-mine', user?.email],
    enabled: Boolean(user?.email),
    queryFn: async () =>
      ((await Return().filter?.({ customer_email: user!.email })) ?? []) as ReturnRow[],
  });

  const orders = useMemo(() => {
    const all = ordersQuery.data ?? [];
    return all.filter((o) => {
      if (o.payment_method === 'delivery') return true;
      if (o.payment_method === 'card' && o.status !== 'pending') return true;
      if (!o.payment_method && o.status !== 'pending') return true;
      return false;
    });
  }, [ordersQuery.data]);

  const filtered = useMemo(() => {
    if (tab === 'all') return orders;
    if (tab === 'active') return orders.filter((o) => ACTIVE_STATUSES.includes(o.status ?? ''));
    if (tab === 'completed') return orders.filter((o) => o.status === 'delivered');
    if (tab === 'cancelled') return orders.filter((o) => o.status === 'cancelled');
    return orders;
  }, [orders, tab]);

  const hasRefund = (id: string) => (refundsQuery.data ?? []).some((r) => r.order_id === id);

  const cancelMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) =>
      Order().update?.(orderId, {
        status: 'cancelled',
        cancellation_reason: reason,
        cancelled_by: user!.email,
        cancelled_by_role: 'client',
      }),
    onSuccess: () => {
      toast.success('Commande annulée');
      qc.invalidateQueries({ queryKey: ['orders', user?.email] });
      setCancelOpen(false);
      setCancelTarget(null);
      setCancelReason('');
    },
    onError: (e: Error) =>
      toast.error(
        'Annulation impossible',
        userErrorMessage(e, 'La commande n’a pas pu être annulée. Réessayez dans un instant.'),
      ),
  });

  /**
   * Repasser la commande :
   * 1. On récupère la fiche produit fraîche pour chaque ligne (image, prix
   *    actuel, unité) — sinon le panier afficherait un placeholder Unsplash
   *    et un prix obsolète.
   * 2. On crée les CartItem sur Base44 (ou on incrémente s'il existe déjà).
   * 3. On hydrate le store local immédiatement → l'utilisateur voit le panier
   *    rempli sans avoir à fermer/rouvrir l'app.
   */
  const reorderMutation = useMutation({
    mutationFn: async (order: OrderRow) => {
      const items = order.items ?? [];

      // 1. Lookup produits frais pour récupérer image_url + prix actuels
      const productLookups = await Promise.all(
        items.map(async (it) => {
          if (!it.product_id) return null;
          try {
            return (await Product().get?.(it.product_id)) as
              | {
                  id: string;
                  name?: string;
                  image_url?: string;
                  price?: number;
                  price_ttc?: number | null;
                  unit?: string;
                  promotion_price?: number;
                  is_promotion?: boolean;
                }
              | null;
          } catch {
            return null;
          }
        }),
      );

      // 2. Upsert CartItem distant pour chaque ligne
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i]!;
        const prod = productLookups[i];
        if (!it.product_id) continue;
        const existing = (await CartItem().filter?.({
          customer_email: user!.email,
          product_id: it.product_id,
        })) as Array<{ id: string; quantity: number }> | undefined;
        // Prix TTC courant (`price_ttc` quand la TVA est renseignée, promo incluse).
        const livePrice =
          prod?.price != null ? sellingPrice({ ...prod, price: prod.price }) : (it.unit_price ?? 0);

        if (existing && existing.length > 0) {
          await CartItem().update?.(existing[0]!.id, {
            quantity: existing[0]!.quantity + it.quantity,
            unit_price: livePrice,
            product_image: prod?.image_url ?? undefined,
            unit: prod?.unit ?? undefined,
          });
        } else {
          await CartItem().create?.({
            customer_email: user!.email,
            product_id: it.product_id,
            product_name: prod?.name ?? it.product_name ?? it.name,
            product_image: prod?.image_url ?? undefined,
            quantity: it.quantity,
            unit_price: livePrice,
            unit: prod?.unit ?? undefined,
          });
        }
      }

      // 3. Hydrate le store local depuis le serveur — sync instantanée.
      await hydrateLocalCartFromServer(user!.email);
    },
    onSuccess: () => {
      toast.success('Articles ajoutés au panier');
      qc.invalidateQueries({ queryKey: ['cart'] });
      // Force re-render des composants qui dépendent du store
      useCart.getState().setSource('synced');
      nav.navigate('ClientTabs', { screen: 'CartTab' });
    },
    onError: (e: Error) =>
      toast.error(
        'Impossible de repasser la commande',
        userErrorMessage(e, 'Les articles n’ont pas pu être remis au panier. Réessayez dans un instant.'),
      ),
  });

  const refundMutation = useMutation({
    mutationFn: async ({
      order,
      method,
    }: {
      order: OrderRow;
      method: 'wallet' | 'card';
    }) => {
      const amount =
        method === 'card' ? (order.total_amount ?? 0) * 0.95 : order.total_amount ?? 0;
      return Refund().create?.({
        order_id: order.id,
        customer_email: user!.email,
        amount,
        refund_method: method,
        cancellation_reason: order.cancellation_reason ?? '',
        status: 'pending',
      });
    },
    onSuccess: () => {
      toast.success('Demande de remboursement envoyée');
      qc.invalidateQueries({ queryKey: ['refunds', user?.email] });
      setRefundOpen(false);
      setRefundTarget(null);
      setRefundMethod('');
    },
    onError: (e: Error) =>
      toast.error(
        'Demande impossible',
        userErrorMessage(e, 'Votre demande de remboursement n’a pas pu être envoyée. Réessayez dans un instant.'),
      ),
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!reviewTarget) return;
      const fullName =
        ((user?.['full_name'] as string | undefined) ?? '').trim() ||
        ((user?.email as string | undefined) ?? 'Client');
      await Review().create?.({
        customer_email: user!.email,
        customer_name: fullName,
        rating: reviewRating,
        comment: reviewComment.trim(),
        order_id: reviewTarget.id,
        review_type: 'general',
      });
    },
    onSuccess: () => {
      toast.success('Merci pour votre avis !');
      qc.invalidateQueries({ queryKey: ['reviews-mine', user?.email] });
      setReviewOpen(false);
      setReviewTarget(null);
      setReviewRating(0);
      setReviewComment('');
    },
    onError: (e: Error) =>
      toast.error(
        'Envoi impossible',
        userErrorMessage(e, 'Votre avis n’a pas pu être envoyé. Réessayez dans un instant.'),
      ),
  });

  if (!user) {
    return (
      <Screen>
        <Header title="Mes commandes" />
        <EmptyState
          title="Connectez-vous"
          description="Connectez-vous pour voir l'historique de vos commandes."
          actionLabel="Se connecter"
          onAction={() => nav.navigate('Login')}
        />
      </Screen>
    );
  }

  if (ordersQuery.isLoading) {
    return (
      <Screen>
        <Header title="Mes commandes" />
        <Loader />
      </Screen>
    );
  }

  const canCancel = (o: OrderRow) =>
    o.status === 'pending' || o.status === 'confirmed';

  /**
   * Bouton « Demande de remboursement » sur une commande annulée :
   * - status === 'cancelled'
   * - un montant a réellement été prélevé : paiement carte abouti OU
   *   portefeuille débité (les commandes payées en cash à la livraison ne
   *   donnent pas lieu à remboursement puisqu'aucune somme n'a été prélevée)
   * - le paiement n'a pas échoué : une commande annulée parce que la carte a
   *   été refusée ou que le paiement a été abandonné n'a rien débité — ni la
   *   carte, ni le portefeuille (débité seulement après acceptation Stripe).
   *   Ces demandes finissaient systématiquement refusées par l'admin
   *   (« aucun montant n'a été débité »).
   * - dans une fenêtre de 24 h après l'annulation
   * - une seule demande par commande
   */
  const canRefund = (o: OrderRow) => canRequestRefund(o, hasRefund(o.id));

  const canReview = (o: OrderRow) => {
    if (o.status !== 'delivered') return false;
    return !(reviewsQuery.data ?? []).some((r) => r.order_id === o.id);
  };

  /**
   * « Demander un retour » : commande livrée, dans l'heure qui suit la
   * livraison, et aucune demande déjà approuvée ou terminée sur la commande
   * (le client peut en déposer plusieurs). Le polling des commandes (30 s)
   * fait disparaître le bouton de lui-même une fois le délai écoulé.
   */
  const canReturn = (o: OrderRow) =>
    canRequestReturn(o, {
      locked: hasLockingReturn(returnsQuery.data, o.id, { reopened: o.return_request_reopened === true }),
    });

  const cancelledHasNoCardRefund =
    refundTarget?.payment_method === 'card' && (refundTarget?.wallet_amount_used ?? 0) === 0;

  return (
    <Screen
      scroll={false}
      bottomBar={isStackScreen ? <PersistentBottomNav /> : undefined}
    >
      <Header title="Mes commandes" />

      {isStackScreen ? (
        <Pressable
          accessibilityRole="link"
          onPress={() =>
            nav.canGoBack() ? nav.goBack() : nav.navigate('ClientTabs', { screen: 'HomeTab' })
          }
          style={styles.backRow}
          hitSlop={6}
        >
          <ArrowLeft size={18} color={colors.foreground} />
          <Text style={[styles.backTxt, { color: colors.foreground }]}>Retour</Text>
        </Pressable>
      ) : null}

      <View style={styles.titleRow}>
        <View style={[styles.titleIcon, { backgroundColor: palette.emerald[100] }]}>
          <Package size={20} color={palette.emerald[700]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.titleText, { color: colors.foreground }]}>Mes commandes</Text>
          <Text style={[styles.titleSub, { color: colors.mutedForeground }]}>
            {orders.length} commande{orders.length > 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.muted }]}>
        {(
          [
            { id: 'all', label: 'Toutes' },
            { id: 'active', label: 'En cours' },
            { id: 'completed', label: 'Livrées' },
            { id: 'cancelled', label: 'Annulées' },
          ] as const
        ).map((t) => {
          const selected = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={[
                styles.tab,
                {
                  backgroundColor: selected ? colors.background : 'transparent',
                  ...(selected
                    ? Platform.select({
                        ios: {
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.06,
                          shadowRadius: 2,
                        },
                        android: { elevation: 1 },
                      }) ?? {}
                    : {}),
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? colors.foreground : colors.mutedForeground,
                  fontWeight: selected ? '800' : '600',
                  fontSize: 13,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ paddingVertical: 12, gap: 10, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
              <Package size={28} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Aucune commande trouvée
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Découvrir nos produits"
              onPress={() => nav.navigate('ClientTabs', { screen: 'HomeTab' })}
              android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
              style={[styles.emptyCta, { backgroundColor: palette.emerald[400] }]}
            >
              <Text style={styles.emptyCtaTxt}>Découvrir nos produits</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View>
            <Pressable onPress={() => nav.navigate('OrderDetails', { id: item.id })}>
              <Card padding={14}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.idText, { color: colors.mutedForeground }]}>
                      Commande #{item.id.slice(-8).toUpperCase()}
                    </Text>
                    <Text style={[styles.totalText, { color: colors.foreground }]}>
                      {formatPrice(item.total_amount ?? 0)}
                    </Text>
                  </View>
                  <OrderStatusBadge status={item.status} />
                </View>
                <View style={styles.metaRow}>
                  <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                    {item.created_date ? formatDateTime(item.created_date) : ''}
                  </Text>
                  {item.delivery_city ? (
                    <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                      · {item.delivery_city}
                    </Text>
                  ) : null}
                  <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                    · {item.items?.length ?? 0} article{(item.items?.length ?? 0) > 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={styles.detailLink}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Voir détails</Text>
                  <ChevronRight size={16} color={colors.mutedForeground} />
                </View>
              </Card>
            </Pressable>

            <View style={styles.actions}>
              {canCancel(item) ? (
                <Button
                  title="Annuler"
                  variant="outline"
                  size="sm"
                  fullWidth
                  leftIcon={<XCircle size={14} color={colors.destructive} />}
                  textStyle={{ color: colors.destructive }}
                  style={{ ...styles.action, borderColor: colors.destructive }}
                  onPress={() => {
                    setCancelTarget(item);
                    setCancelReason('');
                    setCancelOpen(true);
                  }}
                />
              ) : null}
              {canRefund(item) ? (
                <Button
                  title="Demande de remboursement"
                  variant="outline"
                  size="sm"
                  fullWidth
                  leftIcon={<Wallet size={14} color={colors.brandOrange} />}
                  textStyle={{ color: colors.brandOrange, fontSize: 11 }}
                  style={{ ...styles.action, borderColor: colors.brandOrange }}
                  onPress={() => {
                    setRefundTarget(item);
                    setRefundMethod('');
                    setRefundOpen(true);
                  }}
                />
              ) : null}
              <Button
                title="Repasser"
                variant="outline"
                size="sm"
                fullWidth
                loading={reorderMutation.isPending && reorderMutation.variables?.id === item.id}
                leftIcon={<RefreshCw size={14} color={colors.foreground} />}
                style={styles.action}
                onPress={() => reorderMutation.mutate(item)}
              />
              {canReview(item) ? (
                <Button
                  title="Avis"
                  variant="outline"
                  size="sm"
                  fullWidth
                  leftIcon={<Star size={14} color={colors.foreground} />}
                  style={styles.action}
                  onPress={() => {
                    setReviewTarget(item);
                    setReviewRating(5);
                    setReviewComment('');
                    setReviewOpen(true);
                  }}
                />
              ) : null}
              {canReturn(item) ? (
                <Button
                  title="Demander un retour"
                  variant="outline"
                  size="sm"
                  fullWidth
                  leftIcon={<RotateCcw size={14} color={colors.brandOrange} />}
                  textStyle={{ color: colors.brandOrange }}
                  style={{ ...styles.action, borderColor: colors.brandOrange }}
                  onPress={() => nav.navigate('Returns', { orderId: item.id })}
                />
              ) : null}
            </View>
          </View>
        )}
        refreshing={ordersQuery.isRefetching}
        onRefresh={() => {
          ordersQuery.refetch();
          refundsQuery.refetch();
          reviewsQuery.refetch();
          returnsQuery.refetch();
        }}
      />

      <Modal visible={cancelOpen} transparent animationType="fade" onRequestClose={() => setCancelOpen(false)}>
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Annuler la commande</Text>
            <Text style={{ color: colors.mutedForeground, marginBottom: 12 }}>
              Indiquez la raison de l'annulation.
            </Text>
            <Input
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Motif…"
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalRow}>
              <Button
                title="Annuler"
                variant="outline"
                fullWidth
                onPress={() => setCancelOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Confirmer"
                variant="destructive"
                fullWidth
                disabled={!cancelReason.trim() || cancelMutation.isPending}
                loading={cancelMutation.isPending}
                onPress={() =>
                  cancelTarget &&
                  cancelMutation.mutate({ orderId: cancelTarget.id, reason: cancelReason })
                }
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={refundOpen} transparent animationType="fade" onRequestClose={() => setRefundOpen(false)}>
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Demander un remboursement
            </Text>
            {refundTarget ? (
              <>
                <View style={[styles.amountBox, { backgroundColor: colors.muted }]}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Montant maximum</Text>
                  <Text style={[styles.amountText, { color: colors.foreground }]}>
                    {formatPrice(refundTarget.total_amount ?? 0)}
                  </Text>
                </View>
                <ScrollView contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {cancelledHasNoCardRefund ? (
                    <Pressable
                      onPress={() => setRefundMethod('card')}
                      style={[
                        styles.methodRow,
                        {
                          borderColor:
                            refundMethod === 'card' ? colors.brandOrange : colors.border,
                        },
                      ]}
                    >
                      <CreditCard size={18} color={colors.foreground} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.foreground, fontWeight: '700' }}>
                          Carte bancaire
                        </Text>
                        <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                          Remboursement -5% (frais) → {formatPrice((refundTarget.total_amount ?? 0) * 0.95)}
                        </Text>
                      </View>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => setRefundMethod('wallet')}
                    style={[
                      styles.methodRow,
                      {
                        borderColor:
                          refundMethod === 'wallet' ? colors.brandOrange : colors.border,
                      },
                    ]}
                  >
                    <Wallet size={18} color={colors.foreground} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontWeight: '700' }}>Portefeuille</Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                        Crédit total sur votre solde sans frais
                      </Text>
                    </View>
                  </Pressable>
                </ScrollView>
                <View style={styles.modalRow}>
                  <Button
                    title="Annuler"
                    variant="outline"
                    fullWidth
                    onPress={() => setRefundOpen(false)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Demander"
                    variant="brand"
                    fullWidth
                    disabled={!refundMethod || refundMutation.isPending}
                    loading={refundMutation.isPending}
                    onPress={() =>
                      refundMethod &&
                      refundTarget &&
                      refundMutation.mutate({ order: refundTarget, method: refundMethod })
                    }
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={reviewOpen} transparent animationType="fade" onRequestClose={() => setReviewOpen(false)}>
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Donnez votre avis</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setReviewRating(n)}>
                  <Star
                    size={32}
                    color={n <= reviewRating ? '#FBBF24' : colors.border}
                    fill={n <= reviewRating ? '#FBBF24' : 'transparent'}
                  />
                </Pressable>
              ))}
            </View>
            <Input
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="Votre commentaire (optionnel)…"
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalRow}>
              <Button
                title="Annuler"
                variant="outline"
                fullWidth
                onPress={() => setReviewOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Envoyer"
                variant="brand"
                fullWidth
                disabled={reviewRating < 1 || reviewMutation.isPending}
                loading={reviewMutation.isPending}
                onPress={() => reviewMutation.mutate()}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  titleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: { fontSize: 22, fontWeight: '800' },
  titleSub: { fontSize: 12, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    marginVertical: 12,
    padding: 4,
    borderRadius: 999,
  },
  tab: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 14,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 14, textAlign: 'center' },
  emptyCta: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyCtaTxt: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  idText: { fontSize: 11, fontWeight: '600' },
  totalText: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 4 },
  meta: { fontSize: 12 },
  detailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  action: { flex: 1, minWidth: '45%' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  modalRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  amountBox: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  amountText: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginVertical: 12,
  },
});
