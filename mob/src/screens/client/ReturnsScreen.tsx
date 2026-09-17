import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Camera,
  Trash2,
  Check,
  Minus,
  Plus,
  Package,
  Clock,
  Repeat,
  Wallet,
} from 'lucide-react-native';
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
import {
  canRequestReturn,
  hasLockingReturn,
  RETURN_WINDOW_HOURS,
  type ReturnRequestRow,
} from '@/utils/orderHelpers';
import {
  MIN_RETURN_PHOTOS,
  RETURN_REASONS,
  RETURN_RESOLUTIONS,
  type ReturnReason,
  type ReturnResolution,
} from '@/utils/returnStatus';
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
  total_price?: number;
  selected_variants?: Record<string, { type?: string; value?: string }> | null;
}

interface OrderRow {
  id: string;
  status?: string;
  delivered_date?: string;
  updated_date?: string;
  items?: OrderItem[];
}

/** Photo prise en direct, en attente d'envoi. */
interface PendingPhoto {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
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

/** Prix unitaire TTC de la ligne (les anciennes commandes n'ont que `total_price`). */
const unitPriceOf = (it: OrderItem): number => {
  if (it.unit_price != null) return Number(it.unit_price) || 0;
  if (it.total_price != null && it.quantity > 0) return round2(Number(it.total_price) / it.quantity);
  return 0;
};

const openAppSettings = () => {
  void Linking.openSettings();
};

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

  /**
   * Demandes déjà déposées : une demande approuvée ou terminée ferme la
   * commande ; une demande en attente ou refusée n'empêche pas d'en déposer
   * une nouvelle (le client peut faire plusieurs demandes).
   */
  const returnsQuery = useQuery<ReturnRequestRow[]>({
    queryKey: ['returns-mine', user?.email],
    enabled: Boolean(user?.email),
    queryFn: async () =>
      ((await Return().filter?.({ customer_email: user!.email })) ?? []) as ReturnRequestRow[],
  });

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
  /** Motif imposé : « mauvais produit » ou « date expirée ». */
  const [reasonCode, setReasonCode] = useState<'' | ReturnReason>('');
  /** Échange du produit ou remboursement (crédité sur le portefeuille). */
  const [resolution, setResolution] = useState<'' | ReturnResolution>('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);

  const selectedEntries = useMemo(
    () =>
      Object.entries(selected)
        .map(([idx, qty]) => ({ index: Number(idx), qty, item: items[Number(idx)] }))
        .filter((e): e is { index: number; qty: number; item: OrderItem } => Boolean(e.item) && e.qty > 0),
    [selected, items],
  );
  const selectedCount = selectedEntries.reduce((n, e) => n + e.qty, 0);
  const selectedAmount = round2(
    selectedEntries.reduce((s, e) => s + unitPriceOf(e.item) * e.qty, 0),
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

  /** Ce qu'il manque pour pouvoir envoyer — affiché sous le bouton. */
  const missing: string[] = [];
  if (selectedEntries.length === 0) missing.push('sélectionnez au moins un produit');
  if (!reasonCode) missing.push('choisissez la raison du retour');
  if (!description.trim()) missing.push('décrivez le problème');
  if (photos.length < MIN_RETURN_PHOTOS) {
    const left = MIN_RETURN_PHOTOS - photos.length;
    missing.push(`prenez encore ${left} photo${left > 1 ? 's' : ''}`);
  }
  if (!resolution) missing.push('indiquez si vous souhaitez un échange ou un remboursement');
  const canSubmit = missing.length === 0;

  const submit = useMutation({
    mutationFn: async () => {
      if (!canSubmit || !reasonCode || !resolution) throw new Error('Formulaire incomplet');
      // `uploadAsset` construit le multipart RN lui-même : le `UploadFile` du
      // SDK sérialisait la photo en JSON et l'envoi échouait.
      const photoUrls = await Promise.all(photos.map((p) => uploadAsset(p)));
      // Même charge utile que le web (`Returns.jsx`) et que le schéma base44 :
      // l'admin lit `items[].product_name` / `quantity` / `total_price`.
      const created = (await Return().create?.({
        order_id: route.params.orderId,
        customer_email: user?.email,
        items: selectedEntries.map((e) => ({
          product_name: itemLabel(e.item),
          quantity: e.qty,
          total_price: round2(unitPriceOf(e.item) * e.qty),
        })),
        reason: reasonCode,
        description: description.trim(),
        resolution_type: resolution,
        photos: photoUrls.filter(Boolean),
        // Un échange ne donne lieu à aucun remboursement ; sinon le montant
        // des produits retournés, crédité sur le portefeuille par l'admin.
        refund_amount: resolution === 'refund' ? selectedAmount : 0,
        status: 'pending',
      })) as { id: string };
      return created;
    },
    onSuccess: (created) => {
      toast.success('Demande de retour envoyée');
      void qc.invalidateQueries({ queryKey: ['returns-mine'] });
      void qc.invalidateQueries({ queryKey: ['my-returns'] });
      nav.replace('ReturnDetails', { id: created.id });
    },
    onError: (e: Error) =>
      toast.error(
        'Demande impossible',
        userErrorMessage(e, 'Votre demande de retour n’a pas pu être envoyée. Réessayez dans un instant.'),
      ),
  });

  /**
   * Photo prise **en direct** uniquement (pas d'import depuis la galerie) :
   * la preuve doit dater du moment de la demande.
   */
  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert(
        'Appareil photo requis',
        'Les photos du produit doivent être prises en direct. Autorisez l’accès à l’appareil photo dans les réglages.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Ouvrir les réglages', onPress: openAppSettings },
        ],
      );
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      // Pas de recadrage : la photo brute fait foi.
      allowsEditing: false,
    });
    if (r.canceled) return;
    setPhotos((p) => [
      ...p,
      ...r.assets.map((a) => ({ uri: a.uri, fileName: a.fileName, mimeType: a.mimeType })),
    ]);
  };

  const confirmSubmit = () => {
    if (!canSubmit) return;
    const what =
      resolution === 'refund'
        ? `Remboursement de ${formatPrice(selectedAmount)} sur votre portefeuille.`
        : 'Échange des produits sélectionnés.';
    Alert.alert(
      'Envoyer la demande ?',
      `${selectedCount} article${selectedCount > 1 ? 's' : ''} à retourner. ${what}`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Envoyer', onPress: () => submit.mutate() },
      ],
    );
  };

  if (orderQuery.isLoading || !orderQuery.data) {
    return (
      <Screen header={<Header onBack={nav.goBack} title="Demande de retour" />}>
        <Loader />
      </Screen>
    );
  }

  /**
   * Même garde-fou que le web (« Délai dépassé ») : le formulaire n'est
   * accessible que dans l'heure qui suit la livraison, et tant qu'aucune
   * demande n'a été approuvée ou terminée sur cette commande.
   */
  const locked = hasLockingReturn(returnsQuery.data, orderQuery.data.id);
  if (!canRequestReturn(orderQuery.data, { locked })) {
    return (
      <Screen header={<Header onBack={nav.goBack} title="Demande de retour" />}>
        <Card padding={20} style={{ marginTop: 16, alignItems: 'center' }}>
          <View style={[styles.expiredIcon, { backgroundColor: palette.rose[100] }]}>
            <Clock size={28} color={palette.rose[600]} />
          </View>
          <Text style={[styles.expiredTitle, { color: colors.foreground }]}>
            {locked ? 'Demande déjà traitée' : 'Délai dépassé'}
          </Text>
          <Text style={[styles.expiredText, { color: colors.mutedForeground }]}>
            {locked
              ? 'Une demande de retour a déjà été acceptée pour cette commande.'
              : `Le délai de ${RETURN_WINDOW_HOURS} h après la livraison pour demander un retour est dépassé.`}
          </Text>
          <Button
            title="Retour aux commandes"
            variant="brand"
            fullWidth
            onPress={() => nav.navigate('ClientTabs', { screen: 'OrdersTab' })}
            style={{ marginTop: 16 }}
          />
        </Card>
      </Screen>
    );
  }

  const sectionColor = { color: colors.foreground };

  return (
    <Screen scroll header={<Header onBack={nav.goBack} title="Demande de retour" />}>
      <Text style={[styles.section, sectionColor]}>Articles à retourner *</Text>
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
          const unit = unitPriceOf(it);
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
                  {unit > 0 ? `${formatPrice(unit)} · ` : ''}
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
          {formatPrice(selectedAmount)}
        </Text>
      ) : null}

      <Text style={[styles.section, sectionColor]}>Raison du retour *</Text>
      <View style={styles.chipRow}>
        {RETURN_REASONS.map((opt) => {
          const sel = reasonCode === opt.value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              onPress={() => setReasonCode(opt.value)}
              style={[
                styles.chip,
                {
                  borderColor: sel ? colors.brandOrange : colors.border,
                  backgroundColor: sel ? palette.orange[50] : 'transparent',
                },
              ]}
            >
              <Text style={{ color: sel ? colors.brandOrange : colors.foreground, fontWeight: '700' }}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.section, sectionColor]}>Description *</Text>
      <Input
        multiline
        value={description}
        onChangeText={setDescription}
        numberOfLines={3}
        placeholder="Décrivez le problème en détail…"
        testID="return-description"
      />

      <Text style={[styles.section, sectionColor]}>
        Photos du produit * ({photos.length}/{MIN_RETURN_PHOTOS} minimum)
      </Text>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        Prenez au moins {MIN_RETURN_PHOTOS} photos en direct avec l’appareil photo — les images de
        la galerie ne sont pas acceptées.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {photos.map((photo, i) => (
            <View key={`${photo.uri}-${i}`} style={styles.photo}>
              <Image source={{ uri: photo.uri }} style={{ width: 80, height: 80, borderRadius: 12 }} />
              <Pressable
                accessibilityLabel={`Supprimer la photo ${i + 1}`}
                onPress={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                style={styles.photoDelete}
              >
                <Trash2 size={14} color="#FFF" />
              </Pressable>
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Prendre une photo"
            testID="return-take-photo"
            onPress={() => void takePhoto()}
            style={[
              styles.addPhoto,
              {
                borderColor: colors.border,
                backgroundColor: colors.muted,
              },
            ]}
          >
            <Camera size={20} color={colors.foreground} />
            <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 4 }}>Photo</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Text style={[styles.section, sectionColor]}>Que souhaitez-vous ? *</Text>
      <View style={styles.chipRow}>
        {RETURN_RESOLUTIONS.map((opt) => {
          const sel = resolution === opt.value;
          const Icon = opt.value === 'refund' ? Wallet : Repeat;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              testID={`return-resolution-${opt.value}`}
              onPress={() => setResolution(opt.value)}
              style={[
                styles.resolutionCard,
                {
                  borderColor: sel ? colors.brandOrange : colors.border,
                  backgroundColor: sel ? palette.orange[50] : 'transparent',
                },
              ]}
            >
              <Icon size={18} color={sel ? colors.brandOrange : colors.foreground} />
              <Text
                style={{
                  color: sel ? colors.brandOrange : colors.foreground,
                  fontWeight: '700',
                  marginTop: 6,
                  textAlign: 'center',
                }}
              >
                {opt.label}
              </Text>
              <Text
                style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 4, textAlign: 'center' }}
              >
                {opt.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {resolution === 'refund' ? (
        <View style={[styles.walletNote, { backgroundColor: palette.purple[50], borderColor: palette.purple[200] }]}>
          <Wallet size={14} color={palette.purple[700]} />
          <Text style={{ color: palette.purple[700], fontSize: 12, flex: 1, lineHeight: 17 }}>
            Le remboursement se fait uniquement sur votre portefeuille AfriGo
            {selectedAmount > 0 ? ` (${formatPrice(selectedAmount)})` : ''}, une fois le retour
            terminé.
          </Text>
        </View>
      ) : null}

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
        disabled={!canSubmit || submit.isPending}
        onPress={confirmSubmit}
        style={{ marginTop: 24 }}
      />
      {!canSubmit ? (
        <Text style={[styles.missing, { color: colors.mutedForeground }]}>
          Pour envoyer : {missing.join(', ')}.
        </Text>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  section: { marginTop: 14, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  hint: { fontSize: 12, marginBottom: 8, lineHeight: 17 },
  summary: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  missing: { fontSize: 12, marginTop: 8, lineHeight: 17, textAlign: 'center' },
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
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    flexGrow: 1,
    alignItems: 'center',
  },
  resolutionCard: {
    flex: 1,
    minWidth: 140,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
  },
  walletNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  expiredIcon: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  expiredTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  expiredText: { fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 19 },
});

