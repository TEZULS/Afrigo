import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MapPin, CreditCard, Wallet, Truck, ChevronRight, Tag } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/theme/ThemeProvider';
import { useCart } from '@/stores/cart';
import type { CartLine } from '@/stores/cart';
import {
  Order,
  DeliveryZone,
  DeliverySlot,
  DiscountCode,
  DiscountCodeUsage,
  WalletTransaction,
  invokeFunction,
} from '@/api/entities';
import { getBase44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { formatPrice } from '@/utils/format';
import { useToast } from '@/hooks/useToast';
import { clearServerCartForCustomer } from '@/services/cartServerSync';
import { useAppSettings } from '@/hooks/useAppSettings';
import type { RootStackParamList } from '@/navigation/types';

/** Schéma Order aligné sur Checkout.jsx + entité Base44 */
type ApiPaymentMethod = 'card' | 'delivery';

interface ZoneRow {
  id: string;
  name: string;
  delivery_fee: number;
  free_delivery_threshold?: number;
  postal_codes?: string[];
  is_active?: boolean;
  min_order_amount?: number;
}

interface SlotRow {
  id: string;
  date?: string;
  time_slot?: string;
  max_orders?: number;
  current_orders?: number;
  is_available?: boolean;
}

interface PromoCodeRow {
  id: string;
  code: string;
  discount_percentage: number;
  is_active?: boolean;
  valid_from?: string;
  valid_until?: string;
  min_order_amount?: number;
  max_uses_per_customer?: number;
  total_uses?: number;
  applicable_order_numbers?: number[];
}

function lineToSelectedVariants(
  line: CartLine,
): Record<string, { type: string; value: string }> | null {
  const t = line.variant?.type;
  const v = line.variant?.value;
  if (t && v) return { choice: { type: String(t), value: String(v) } };
  return null;
}

export const CheckoutScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { lines, total, clear } = useCart();
  const toast = useToast();
  const appSettings = useAppSettings();
  const deliverySlotsEnabled = Boolean(appSettings.data?.delivery_slots_enabled);

  const [address, setAddress] = useState((user?.['address'] as string) ?? '');
  const [postalCode, setPostalCode] = useState((user?.['postal_code'] as string) ?? '');
  const [city, setCity] = useState((user?.['city'] as string) ?? '');
  const [phone, setPhone] = useState((user?.['phone'] as string) ?? '');
  const [zone, setZone] = useState<ZoneRow | null>(null);
  const [slot, setSlot] = useState<SlotRow | null>(null);
  const [payment, setPayment] = useState<ApiPaymentMethod>('card');

  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<PromoCodeRow | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);

  const [useWallet, setUseWallet] = useState(false);
  const walletBalance = Number((user?.['wallet_balance'] as number | undefined) ?? 0);

  const zonesQuery = useQuery<ZoneRow[]>({
    queryKey: ['delivery-zones'],
    queryFn: async () => {
      const raw = ((await DeliveryZone().list?.()) ?? []) as Record<string, unknown>[];
      return raw
        .filter((z) => z.is_active !== false)
        .map((z) => ({
          id: String(z.id),
          name: String(z.name ?? ''),
          delivery_fee: Number(z.delivery_fee ?? 0),
          free_delivery_threshold:
            z.free_delivery_threshold != null ? Number(z.free_delivery_threshold) : undefined,
          postal_codes: z.postal_codes as string[] | undefined,
          is_active: z.is_active as boolean | undefined,
          min_order_amount: z.min_order_amount != null ? Number(z.min_order_amount) : 0,
        }));
    },
  });

  const slotsQuery = useQuery<SlotRow[]>({
    queryKey: ['delivery-slots'],
    enabled: deliverySlotsEnabled && lines.length > 0,
    queryFn: async () => {
      const list =
        ((await DeliverySlot().list?.('-date')) as SlotRow[] | undefined) ?? ([] as SlotRow[]);
      const today = new Date().toISOString().split('T')[0]!;
      return list.filter(
        (s) =>
          s.is_available !== false &&
          (!s.date || s.date >= today) &&
          (s.current_orders ?? 0) < (s.max_orders ?? 9999),
      );
    },
  });

  /** Correspondance automatique zone / code postal — comme Checkout.jsx */
  useEffect(() => {
    const zones = zonesQuery.data ?? [];
    if (!postalCode.trim()) return;
    const found = zones.find((z) => z.postal_codes?.includes(postalCode.trim()));
    if (found) setZone(found);
  }, [postalCode, zonesQuery.data]);

  /**
   * Synchronise les champs adresse/CP/ville/téléphone avec le profil utilisateur :
   * quand l'utilisateur modifie son adresse côté Profil puis revient au Checkout,
   * la nouvelle adresse remplace la valeur initiale (sauf s'il a déjà saisi un
   * autre adresse manuellement dans le formulaire).
   */
  const lastSyncedRef = React.useRef({
    address: (user?.['address'] as string) ?? '',
    postal: (user?.['postal_code'] as string) ?? '',
    city: (user?.['city'] as string) ?? '',
    phone: (user?.['phone'] as string) ?? '',
  });
  useEffect(() => {
    const u = {
      address: (user?.['address'] as string) ?? '',
      postal: (user?.['postal_code'] as string) ?? '',
      city: (user?.['city'] as string) ?? '',
      phone: (user?.['phone'] as string) ?? '',
    };
    const ref = lastSyncedRef.current;
    if (u.address !== ref.address && (address === ref.address || !address)) {
      setAddress(u.address);
    }
    if (u.postal !== ref.postal && (postalCode === ref.postal || !postalCode)) {
      setPostalCode(u.postal);
    }
    if (u.city !== ref.city && (city === ref.city || !city)) {
      setCity(u.city);
    }
    if (u.phone !== ref.phone && (phone === ref.phone || !phone)) {
      setPhone(u.phone);
    }
    lastSyncedRef.current = u;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    (user?.['address'] as string) ?? '',
    (user?.['postal_code'] as string) ?? '',
    (user?.['city'] as string) ?? '',
    (user?.['phone'] as string) ?? '',
  ]);

  const subTotal = total();
  const freeTh = zone?.free_delivery_threshold;
  const FREE_THRESHOLD = freeTh != null ? Number(freeTh) : 0;
  const isFreeDelivery =
    Boolean(zone) && (FREE_THRESHOLD === 0 || subTotal >= FREE_THRESHOLD);
  const deliveryFee =
    zone != null ? (isFreeDelivery ? 0 : Number(zone.delivery_fee ?? 0)) : 0;
  const totalBeforeDiscounts = subTotal + deliveryFee;

  const promoDiscount = appliedPromo
    ? Math.round(((subTotal * appliedPromo.discount_percentage) / 100) * 100) / 100
    : 0;
  const totalAfterPromo = Math.max(0, totalBeforeDiscounts - promoDiscount);
  const walletApplied = useWallet && walletBalance > 0
    ? Math.min(walletBalance, totalAfterPromo)
    : 0;
  const grandTotal = Math.max(0, totalAfterPromo - walletApplied);

  const minOrderAmount = zone != null ? Number(zone.min_order_amount ?? 0) : 0;
  const meetsMinimum = subTotal >= minOrderAmount;

  const slotsCount = slotsQuery.data?.length ?? 0;
  /** Aligné sur Checkout.jsx : créneau requis si la fonctionnalité est activée côté admin. */
  const slotsBlocked =
    deliverySlotsEnabled && (slotsCount === 0 || slot == null);

  const slotLabel = useMemo(() => {
    if (!slot?.date && !slot?.time_slot) return '';
    return [slot.date, slot.time_slot].filter(Boolean).join(' · ');
  }, [slot]);

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const codes = ((await DiscountCode().filter?.({ code: code.toUpperCase() })) ??
        []) as PromoCodeRow[];
      if (codes.length === 0) {
        setPromoError('Code promo invalide');
        setAppliedPromo(null);
        return;
      }
      const c = codes[0]!;
      if (c.is_active === false) {
        setPromoError("Ce code n'est plus actif");
        setAppliedPromo(null);
        return;
      }
      const today = new Date();
      if (c.valid_from && new Date(c.valid_from) > today) {
        setPromoError("Ce code n'est pas encore valide");
        setAppliedPromo(null);
        return;
      }
      if (c.valid_until && new Date(c.valid_until) < today) {
        setPromoError('Ce code a expiré');
        setAppliedPromo(null);
        return;
      }
      if (c.min_order_amount && subTotal < c.min_order_amount) {
        setPromoError(`Commande minimale de ${c.min_order_amount}€ requise`);
        setAppliedPromo(null);
        return;
      }
      if (user?.email) {
        const usages = ((await DiscountCodeUsage().filter?.({
          customer_email: user.email,
          code: c.code,
        })) ?? []) as { id: string }[];
        if (c.max_uses_per_customer && usages.length >= c.max_uses_per_customer) {
          setPromoError("Vous avez atteint la limite d'utilisation de ce code");
          setAppliedPromo(null);
          return;
        }
      }
      setAppliedPromo(c);
      toast.success(`Code appliqué : -${c.discount_percentage}%`);
    } catch (e) {
      setPromoError((e as Error).message);
      setAppliedPromo(null);
    } finally {
      setPromoBusy(false);
    }
  };

  const removePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError(null);
  };

  const placeOrder = useMutation({
    mutationFn: async () => {
      if (!user) {
        nav.navigate('Login');
        throw new Error('Login requis');
      }
      if (slot?.id) {
        await DeliverySlot().update?.(slot.id, {
          current_orders: (slot.current_orders ?? 0) + 1,
        });
      }

      const items = lines.map((l) => ({
        product_id: l.productId,
        product_name: l.name,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        total_price: l.unitPrice * l.quantity,
        selected_variants: lineToSelectedVariants(l),
      }));

      const apiPayment: ApiPaymentMethod = payment;

      const created = (await Order().create?.({
        customer_email: user.email,
        items,
        total_amount: totalBeforeDiscounts,
        payment_method: apiPayment,
        payment_status: 'pending',
        wallet_amount_used: walletApplied,
        promo_code: appliedPromo?.code ?? null,
        promo_discount: promoDiscount,
        amount_to_pay: grandTotal,
        status: 'pending',
        delivery_address: address.trim(),
        delivery_postal_code: postalCode.trim(),
        delivery_city: city.trim() || '—',
        notes: phone ? `Tel: ${phone}` : undefined,
        estimated_delivery: slot?.date,
        delivery_time: slot?.time_slot,
      })) as { id: string };

      if (appliedPromo) {
        await DiscountCodeUsage().create?.({
          code: appliedPromo.code,
          customer_email: user.email,
          order_id: created.id,
          discount_amount: promoDiscount,
          used_at: new Date().toISOString(),
        }).catch(() => {});
        await DiscountCode().update?.(appliedPromo.id, {
          total_uses: (appliedPromo.total_uses ?? 0) + 1,
        }).catch(() => {});
      }

      if (walletApplied > 0) {
        const newBalance = walletBalance - walletApplied;
        await getBase44()
          .auth.updateMe({ wallet_balance: newBalance } as Record<string, unknown>)
          .catch(() => {});
        await WalletTransaction().create?.({
          customer_email: user.email,
          amount: walletApplied,
          type: 'debit',
          reason: `Paiement commande #${created.id.slice(-8)}`,
        }).catch(() => {});
      }

      await invokeFunction('updateStockAfterOrder', { orderId: created.id }).catch(() => {});
      await invokeFunction('notifyAdminsNewOrder', {
        orderId: created.id,
        customerEmail: user.email,
        customerName: (user.full_name as string | undefined) ?? user.email,
        totalAmount: grandTotal,
        paymentMethod: apiPayment === 'card' ? 'carte' : 'livraison',
      }).catch(() => {});

      return created;
    },
    onSuccess: async (order) => {
      if (payment === 'card') {
        nav.replace('Payment', { orderId: order.id, amount: grandTotal });
      } else {
        if (user?.email) await clearServerCartForCustomer(user.email).catch(() => {});
        clear();
        toast.success('Commande passée', 'Votre commande a bien été enregistrée.');
        nav.replace('OrderDetails', { id: order.id });
      }
    },
    onError: (e: Error) => {
      if (e.message !== 'Login requis') toast.error('Erreur', e.message);
    },
  });

  const canProceed =
    Boolean(address.trim() && postalCode.trim() && city.trim() && zone) &&
    meetsMinimum &&
    !slotsBlocked;

  return (
    <Screen
      scroll
      contentStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 32 }}
      keyboardBehavior="padding"
    >
      <Header onBack={nav.goBack} title="Validation" />

      <Text style={[styles.section, { color: colors.foreground }]}>Adresse de livraison</Text>
      <Card padding={14} style={{ marginTop: 8 }}>
        <Input label="Adresse" value={address} onChangeText={setAddress} placeholder="Rue…" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Input
            label="Code postal"
            value={postalCode}
            onChangeText={setPostalCode}
            keyboardType="numeric"
            containerStyle={{ flex: 1 }}
          />
          <Input
            label="Ville"
            value={city}
            onChangeText={setCity}
            containerStyle={{ flex: 1.2 }}
          />
        </View>
        <Input
          label="Téléphone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      </Card>

      {/*
        La zone de livraison est dérivée automatiquement du code postal saisi
        (cf. useEffect ci-dessus). Un récapitulatif léger remplace l'ancien
        bloc « Zone de livraison » qui obligeait l'utilisateur à choisir
        manuellement une zone.
      */}
      {zone ? (
        <Card padding={12} style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} color={colors.brandOrange} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 13 }}>
                {zone.name}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                {isFreeDelivery ? 'Livraison gratuite' : `Livraison : ${formatPrice(deliveryFee)}`}
              </Text>
            </View>
          </View>
        </Card>
      ) : postalCode.trim() ? (
        <Text
          style={{
            marginTop: 12,
            fontSize: 12,
            color: colors.mutedForeground,
            fontWeight: '500',
          }}
        >
          Aucune zone trouvée pour le code postal {postalCode.trim()}.
        </Text>
      ) : null}

      {!meetsMinimum && zone != null && minOrderAmount > 0 ? (
        <Text
          style={{
            marginTop: 14,
            fontSize: 13,
            lineHeight: 19,
            color: colors.brandOrange,
            fontWeight: '600',
          }}
        >
          Montant minimum pour la zone sélectionnée : {formatPrice(minOrderAmount)} (panier{' '}
          {formatPrice(subTotal)}).
        </Text>
      ) : null}

      {deliverySlotsEnabled ? (
        <>
          <Text style={[styles.section, { color: colors.foreground }]}>Créneau</Text>
          {slotsQuery.isLoading ? (
            <Card padding={14} style={{ marginTop: 8 }}>
              <Text style={{ color: colors.mutedForeground }}>Chargement des créneaux…</Text>
            </Card>
          ) : slotsCount === 0 ? (
            <Card padding={14} style={{ marginTop: 8, borderColor: colors.border }}>
              <Text style={{ color: colors.destructive, fontWeight: '600' }}>
                Aucun créneau disponible pour le moment. Réessayez plus tard ou contactez le service
                client.
              </Text>
            </Card>
          ) : (
            <Card padding={6} style={{ marginTop: 8 }}>
              {(slotsQuery.data ?? []).map((s) => {
                const selected = slot?.id === s.id;
                const label = [s.date, s.time_slot].filter(Boolean).join(' · ');
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => setSlot(s)}
                    style={[
                      styles.row,
                      { borderColor: selected ? colors.brandOrange : 'transparent' },
                    ]}
                  >
                    <Truck size={18} color={colors.foreground} />
                    <Text style={{ flex: 1, color: colors.foreground }}>{label || s.id}</Text>
                    <ChevronRight size={16} color={colors.mutedForeground} />
                  </Pressable>
                );
              })}
            </Card>
          )}
        </>
      ) : null}

      <Text style={[styles.section, { color: colors.foreground }]}>Code promo</Text>
      <Card padding={14} style={{ marginTop: 8 }}>
        {appliedPromo ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 4,
            }}
          >
            <Tag size={18} color={colors.brandOrange} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontWeight: '700' }}>
                {appliedPromo.code}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                -{appliedPromo.discount_percentage}% sur les articles
              </Text>
            </View>
            <Button title="Retirer" variant="ghost" size="sm" onPress={removePromo} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Input
              placeholder="Saisissez votre code"
              value={promoInput}
              onChangeText={(v) => {
                setPromoInput(v);
                if (promoError) setPromoError(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              error={promoError ?? undefined}
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
            <Button
              title="Appliquer"
              variant="outline"
              size="md"
              loading={promoBusy}
              disabled={!promoInput.trim() || promoBusy}
              onPress={() => void applyPromo()}
            />
          </View>
        )}
      </Card>

      {walletBalance > 0 ? (
        <>
          <Text style={[styles.section, { color: colors.foreground }]}>Portefeuille</Text>
          <Card padding={14} style={{ marginTop: 8 }}>
            <Pressable
              onPress={() => setUseWallet((u) => !u)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: useWallet ? colors.brandOrange : colors.border,
                  backgroundColor: useWallet ? colors.brandOrange : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {useWallet ? (
                  <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 14 }}>✓</Text>
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.foreground, fontWeight: '700' }}>
                  Utiliser mon portefeuille
                </Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                  Solde disponible : {formatPrice(walletBalance)}
                </Text>
              </View>
              {useWallet ? (
                <Text style={{ color: colors.brandOrange, fontWeight: '800' }}>
                  -{formatPrice(walletApplied)}
                </Text>
              ) : null}
            </Pressable>
          </Card>
        </>
      ) : null}

      <Text style={[styles.section, { color: colors.foreground }]}>Paiement</Text>
      <Card padding={6} style={{ marginTop: 8 }}>
        {(
          [
            { id: 'card' as const, label: 'Carte bancaire', Icon: CreditCard },
            { id: 'delivery' as const, label: 'Paiement à la livraison', Icon: Wallet },
          ] as const
        ).map((p) => {
          const selected = payment === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPayment(p.id)}
              style={[
                styles.row,
                { borderColor: selected ? colors.brandOrange : 'transparent' },
              ]}
            >
              <p.Icon size={18} color={colors.foreground} />
              <Text style={{ flex: 1, color: colors.foreground, fontWeight: '600' }}>{p.label}</Text>
            </Pressable>
          );
        })}
      </Card>

      <Card padding={14} style={{ marginTop: 16 }}>
        <View style={styles.totalRow}>
          <Text style={{ color: colors.mutedForeground }}>Sous-total</Text>
          <Text style={{ color: colors.foreground }}>{formatPrice(subTotal)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={{ color: colors.mutedForeground }}>Livraison</Text>
          <Text style={{ color: colors.foreground }}>
            {zone ? (isFreeDelivery ? 'Gratuit' : formatPrice(deliveryFee)) : '—'}
          </Text>
        </View>
        {appliedPromo ? (
          <View style={styles.totalRow}>
            <Text style={{ color: colors.mutedForeground }}>
              Code promo {appliedPromo.code}
            </Text>
            <Text style={{ color: colors.brandOrange, fontWeight: '700' }}>
              -{formatPrice(promoDiscount)}
            </Text>
          </View>
        ) : null}
        {walletApplied > 0 ? (
          <View style={styles.totalRow}>
            <Text style={{ color: colors.mutedForeground }}>Portefeuille</Text>
            <Text style={{ color: colors.brandOrange, fontWeight: '700' }}>
              -{formatPrice(walletApplied)}
            </Text>
          </View>
        ) : null}
        {slotLabel ? (
          <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 6 }}>
            Créneau : {slotLabel}
          </Text>
        ) : null}
        <View style={[styles.totalRow, { marginTop: 6 }]}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.foreground }}>Total à payer</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.foreground }}>
            {formatPrice(grandTotal)}
          </Text>
        </View>
      </Card>

      <Button
        title={user ? 'Confirmer ma commande' : 'Se connecter pour commander'}
        variant="brand"
        size="lg"
        fullWidth
        loading={placeOrder.isPending}
        disabled={!user ? false : !canProceed}
        onPress={() => (user ? placeOrder.mutate() : nav.navigate('Login'))}
        style={{ marginTop: 20 }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  section: { marginTop: 16, fontSize: 14, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 6,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
});
