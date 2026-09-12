import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, Trash2, Check, Minus, Plus, Package } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { Order, Product, Return } from '@/api/entities';
import { uploadAsset } from '@/services/fileUpload';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/hooks/useToast';
import { formatPrice } from '@/utils/format';
import { round2 } from '@/utils/checkoutMath';
import type { RootStackParamList } from '@/navigation/types';
import { userErrorMessage } from '@/lib/userErrors';

/** Ligne de `Order.items` telle que créée par le checkout (mobile et web). */
interface OrderItem {
  product_id?: string;
  product_name?: string;
  /** Ancien format. */
  name?: string;
  quantity: number;
  unit_price?: number;
  selected_variants?: Record<string, { type?: string; value?: string }> | null;
}

interface OrderRow {
  id: string;
  items?: OrderItem[];
}

/** Sélection : index de la ligne → quantité à retourner (0 = non sélectionnée). */
type Selection = Record<number, number>;

const itemLabel = (it: OrderItem): string => it.product_name ?? it.name ?? 'Article';

const variantLabel = (it: OrderItem): string =>
  it.selected_variants
    ? Object.values(it.selected_variants)
        .map((v) => v?.value)
        .filter(Boolean)
        .join(' · ')
    : '';

export const ReturnsScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'Returns'>>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  const orderQuery = useQuery<OrderRow | null>({
    queryKey: ['order', route.params.orderId],
    queryFn: async () => ((await Order().get?.(route.params.orderId)) ?? null) as OrderRow | null,
  });
  const items = useMemo(() => orderQuery.data?.items ?? [], [orderQuery.data]);

  /** Visuels des produits (best-effort : la commande ne stocke pas l'image). */
  const productIds = useMemo(
    () => [...new Set(items.map((it) => it.product_id).filter((id): id is string => Boolean(id)))],
    [items],
  );
  const productsQuery = useQuery<Record<string, { image_url?: string }>>({
    queryKey: ['return-products', productIds],
    enabled: productIds.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(
        productIds.map(async (id) => {
          try {
            const p = (await Product().get?.(id)) as { image_url?: string } | null | undefined;
            return [id, { image_url: p?.image_url }] as const;
          } catch {
            return [id, {}] as const;
          }
        }),
      );
      return Object.fromEntries(entries);
    },
  });

  const [selected, setSelected] = useState<Selection>({});
  /**
   * Motif imposé : selon la règle métier, un client ne peut demander un retour
   * que pour « mauvais produit » (wrong_product) ou « date expirée » (expired).
   */
  const [reasonCode, setReasonCode] = useState<'' | 'wrong_product' | 'expired'>('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  const REASON_OPTIONS: { value: 'wrong_product' | 'expired'; label: string }[] = [
    { value: 'wrong_product', label: 'Mauvais produit' },
    { value: 'expired', label: 'Date expirée' },
  ];

  const selectedEntries = useMemo(
    () =>
      Object.entries(selected)
        .map(([idx, qty]) => ({ index: Number(idx), qty, item: items[Number(idx)] }))
        .filter((e): e is { index: number; qty: number; item: OrderItem } => Boolean(e.item) && e.qty > 0),
    [selected, items],
  );
  const selectedCount = selectedEntries.reduce((n, e) => n + e.qty, 0);
  const refundAmount = round2(
    selectedEntries.reduce((s, e) => s + (e.item.unit_price ?? 0) * e.qty, 0),
  );

  const toggleItem = (index: number, it: OrderItem) =>
    setSelected((s) => {
      const next = { ...s };
      if ((next[index] ?? 0) > 0) delete next[index];
      else next[index] = it.quantity;
      return next;
    });

  const setQty = (index: number, it: OrderItem, qty: number) =>
    setSelected((s) => {
      const next = { ...s };
      const clamped = Math.max(0, Math.min(it.quantity, qty));
      if (clamped === 0) delete next[index];
      else next[index] = clamped;
      return next;
    });

  const submit = useMutation({
    mutationFn: async () => {
      if (!reasonCode) throw new Error('Motif requis');
      if (selectedEntries.length === 0) throw new Error('Sélectionnez au moins un article');
      // `uploadAsset` construit le multipart RN lui-même : le `UploadFile` du
      // SDK sérialisait la photo en JSON et l'envoi échouait.
      const photoUploads = await Promise.all(photos.map((uri) => uploadAsset({ uri })));
      // Même charge utile que le web (`Returns.jsx`) : l'admin lit
      // `items[].product_name` / `quantity` ; on ajoute l'identifiant et le prix.
      const created = (await Return().create?.({
        order_id: route.params.orderId,
        customer_email: user?.email,
        items: selectedEntries.map((e) => ({
          product_id: e.item.product_id,
          product_name: itemLabel(e.item),
          quantity: e.qty,
          unit_price: e.item.unit_price,
        })),
        reason: reasonCode,
        description: reasonDetail.trim() || undefined,
        photos: photoUploads.filter(Boolean),
        refund_amount: refundAmount,
        status: 'pending',
      })) as { id: string };
      return created;
    },
    onSuccess: (created) => {
      toast.success('Demande de retour envoyée');
      // Le bouton « Demander un retour » disparaît sur cette commande.
      void qc.invalidateQueries({ queryKey: ['returns-mine'] });
      nav.replace('ReturnDetails', { id: created.id });
    },
    onError: (e: Error) =>
      toast.error(
        'Demande impossible',
        userErrorMessage(e, 'Votre demande de retour n’a pas pu être envoyée. Réessayez dans un instant.'),
      ),
  });

  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled) setPhotos((p) => [...p, ...r.assets.map((a) => a.uri)]);
  };

  const confirmSubmit = () =>
    Alert.alert(
      'Envoyer la demande ?',
      `${selectedCount} article${selectedCount > 1 ? 's' : ''} à retourner, pour ${formatPrice(refundAmount)}.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Envoyer', onPress: () => submit.mutate() },
      ],
    );

  if (orderQuery.isLoading || !orderQuery.data) {
    return (
      <Screen header={<Header onBack={nav.goBack} title="Demande de retour" />}>
        <Loader />
      </Screen>
    );
  }

  return (
    <Screen scroll header={<Header onBack={nav.goBack} title="Demande de retour" />}>
      <Text style={[styles.section, { color: colors.foreground }]}>Articles à retourner</Text>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Cochez les produits concernés et ajustez la quantité si besoin.
      </Text>
      <Card padding={6}>
        {items.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, padding: 10 }}>
            Aucun article dans cette commande.
          </Text>
        ) : null}
        {items.map((it, index) => {
          const qty = selected[index] ?? 0;
          const isSelected = qty > 0;
          const image = it.product_id ? productsQuery.data?.[it.product_id]?.image_url : undefined;
          const variant = variantLabel(it);
          return (
            <Pressable
              key={`${it.product_id ?? 'item'}-${index}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${itemLabel(it)}, quantité commandée ${it.quantity}`}
              testID={`return-item-${index}`}
              onPress={() => toggleItem(index, it)}
              style={[
                styles.itemRow,
                {
                  backgroundColor: isSelected ? palette.emerald[50] : 'transparent',
                  borderColor: isSelected ? palette.emerald[200] : 'transparent',
                },
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: isSelected ? palette.emerald[600] : 'transparent',
                    borderColor: isSelected ? palette.emerald[600] : colors.border,
                  },
                ]}
              >
                {isSelected ? <Check size={14} color="#FFF" /> : null}
              </View>

              <View style={[styles.thumb, { backgroundColor: colors.muted }]}>
                {image ? (
                  <Image source={{ uri: image }} style={styles.thumbImg} contentFit="cover" />
                ) : (
                  <Package size={20} color={colors.mutedForeground} />
                )}
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.foreground, fontWeight: '700' }} numberOfLines={2}>
                  {itemLabel(it)}
                </Text>
                {variant ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }} numberOfLines={1}>
                    {variant}
                  </Text>
                ) : null}
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                  {it.unit_price != null ? `${formatPrice(it.unit_price)} · ` : ''}
                  {it.quantity} commandé{it.quantity > 1 ? 's' : ''}
                </Text>
              </View>

              {isSelected ? (
                <View style={[styles.qtyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Pressable
                    accessibilityLabel="Retirer un exemplaire"
                    hitSlop={6}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      setQty(index, it, qty - 1);
                    }}
                    style={styles.qtyBtn}
                  >
                    <Minus size={16} color={colors.foreground} />
                  </Pressable>
                  <Text style={[styles.qtyText, { color: colors.foreground }]} testID={`return-qty-${index}`}>
                    {qty}
                  </Text>
                  <Pressable
                    accessibilityLabel="Ajouter un exemplaire"
                    hitSlop={6}
                    disabled={qty >= it.quantity}
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      setQty(index, it, qty + 1);
                    }}
                    style={[styles.qtyBtn, { opacity: qty >= it.quantity ? 0.35 : 1 }]}
                  >
                    <Plus size={16} color={colors.foreground} />
                  </Pressable>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </Card>
      {selectedCount > 0 ? (
        <Text style={[styles.summary, { color: palette.emerald[700] }]}>
          {selectedCount} article{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''} ·{' '}
          {formatPrice(refundAmount)}
        </Text>
      ) : null}

      <Text style={[styles.section, { color: colors.foreground }]}>Motif *</Text>
      <View style={styles.reasonRow}>
        {REASON_OPTIONS.map((opt) => {
          const sel = reasonCode === opt.value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              onPress={() => setReasonCode(opt.value)}
              style={[
                styles.reasonChip,
                {
                  borderColor: sel ? colors.brandOrange : colors.border,
                  backgroundColor: sel ? palette.orange[50] : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: sel ? colors.brandOrange : colors.foreground,
                  fontWeight: '700',
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.section, { color: colors.foreground }]}>Description (optionnel)</Text>
      <Input
        multiline
        value={reasonDetail}
        onChangeText={setReasonDetail}
        numberOfLines={3}
        placeholder="Précisez si nécessaire…"
      />

      <Text style={[styles.section, { color: colors.foreground }]}>Photos (preuves)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {photos.map((uri, i) => (
            <View key={i} style={styles.photo}>
              <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 12 }} />
              <Pressable
                onPress={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                style={styles.photoDelete}
              >
                <Trash2 size={14} color="#FFF" />
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={pickPhoto}
            style={[styles.addPhoto, { borderColor: colors.border, backgroundColor: colors.muted }]}
          >
            <Camera size={20} color={colors.foreground} />
          </Pressable>
        </View>
      </ScrollView>

      <Button
        title={
          selectedCount > 0
            ? `Envoyer la demande (${selectedCount} article${selectedCount > 1 ? 's' : ''})`
            : 'Envoyer la demande'
        }
        variant="brand"
        size="lg"
        fullWidth
        loading={submit.isPending}
        disabled={selectedCount === 0 || !reasonCode}
        onPress={confirmSubmit}
        style={{ marginTop: 24 }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  section: { marginTop: 12, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  hint: { fontSize: 12, marginBottom: 8 },
  summary: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 2,
  },
  qtyBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  qtyText: { minWidth: 22, textAlign: 'center', fontWeight: '700' },
  photo: { position: 'relative' },
  photoDelete: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 999,
    padding: 4,
  },
  addPhoto: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  reasonChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    flexGrow: 1,
    alignItems: 'center',
  },
});
