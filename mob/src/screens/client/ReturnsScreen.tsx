import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking, Platform } from 'react-native';
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
import { MIN_RETURN_PHOTOS, RETURN_REASONS, type ReturnReason } from '@/utils/returnStatus';
import type { RootStackParamList } from '@/navigation/types';
import { userErrorMessage } from '@/lib/userErrors';
import { kv } from '@/services/storage';
import { clearReturnDraft, readReturnDraft, saveReturnDraft } from '@/utils/returnDraft';

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
  /** Réclamation réactivée par l'admin : plus de délai d'une heure. */
  return_request_reopened?: boolean;
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

/**
 * Crée la réclamation sans choix de résolution (l'admin tranche). Tant que
 * `resolution_type` reste obligatoire dans base44, la création est refusée :
 * on renvoie alors une valeur d'attente (`exchange`), jamais affichée au client
 * tant que la demande n'a pas été traitée.
 */
const createReturn = async (payload: Record<string, unknown>): Promise<{ id: string }> => {
  try {
    return (await Return().create?.(payload)) as { id: string };
  } catch {
    return (await Return().create?.({ ...payload, resolution_type: 'exchange' })) as { id: string };
  }
};

export const ReturnsScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'Returns'>>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();

  /**
   * Toujours relue à l'ouverture : la version en cache peut dater d'avant la
   * livraison (écran de la commande ouvert juste après l'achat) et faisait
   * afficher « Délai dépassé » sur une commande tout juste livrée.
   */
  const orderQuery = useQuery<OrderRow | null>({
    queryKey: ['order', route.params.orderId],
    staleTime: 0,
    refetchOnMount: 'always',
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
    staleTime: 0,
    refetchOnMount: 'always',
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

  /**
   * Réclamation en cours reprise telle quelle : Android peut fermer l'app
   * pendant la prise de vue (voir `utils/returnDraft.ts`).
   */
  const [restored] = useState(() => readReturnDraft(route.params.orderId, user?.email));
  const [selected, setSelected] = useState<Selection>(() => (restored?.selected ?? {}) as Selection);
  /** Motif imposé : « mauvais produit » ou « date expirée ». */
  const [reasonCode, setReasonCode] = useState<'' | ReturnReason>(
    () => RETURN_REASONS.find((r) => r.value === restored?.reasonCode)?.value ?? '',
  );
  const [description, setDescription] = useState(() => restored?.description ?? '');
  const [photos, setPhotos] = useState<PendingPhoto[]>(() => restored?.photos ?? []);

  /** Appareil photo ouvert depuis ce formulaire (noté dans le brouillon). */
  const cameraOpenedAt = useRef<number | undefined>(undefined);
  const form = useRef({ selected, reasonCode, description, photos });
  const persistDraft = useCallback(() => {
    const email = user?.email;
    if (!email) return;
    const f = form.current;
    const empty =
      Object.keys(f.selected).length === 0 && !f.reasonCode && !f.description.trim() && f.photos.length === 0;
    if (empty && !cameraOpenedAt.current) {
      clearReturnDraft(route.params.orderId);
      return;
    }
    saveReturnDraft({
      orderId: route.params.orderId,
      email,
      selected: f.selected,
      reasonCode: f.reasonCode,
      description: f.description,
      photos: f.photos,
      cameraOpenedAt: cameraOpenedAt.current,
    });
  }, [route.params.orderId, user?.email]);

  useEffect(() => {
    form.current = { selected, reasonCode, description, photos };
    persistDraft();
  }, [selected, reasonCode, description, photos, persistDraft]);

  // Retour après une fermeture par Android pendant la prise de vue : le client
  // est prévenu, et la photo prise à ce moment-là est récupérée.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !restored?.cameraOpenedAt) return;
    resumed.current = true;
    toast.info('Réclamation reprise', 'Vous pouvez continuer là où vous en étiez.');
    if (Platform.OS !== 'android') return;
    void ImagePicker.getPendingResultAsync()
      .then((r) => {
        if (!r || 'code' in r || r.canceled || !r.assets?.length) return;
        const taken = r.assets.map((a) => ({ uri: a.uri, fileName: a.fileName, mimeType: a.mimeType }));
        setPhotos((p) => [...p, ...taken.filter((t) => !p.some((x) => x.uri === t.uri))]);
      })
      .catch(() => undefined);
  }, [restored, toast]);

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
  const canSubmit = missing.length === 0;

  const submit = useMutation({
    mutationFn: async () => {
      if (!canSubmit || !reasonCode) throw new Error('Formulaire incomplet');
      // `uploadAsset` construit le multipart RN lui-même : le `UploadFile` du
      // SDK sérialisait la photo en JSON et l'envoi échouait.
      const photoUrls = await Promise.all(photos.map((p) => uploadAsset(p)));
      // Même charge utile que le web (`Returns.jsx`) et que le schéma base44 :
      // l'admin lit `items[].product_name` / `quantity` / `total_price`.
      const payload = {
        order_id: route.params.orderId,
        customer_email: user?.email,
        items: selectedEntries.map((e) => ({
          product_name: itemLabel(e.item),
          quantity: e.qty,
          total_price: round2(unitPriceOf(e.item) * e.qty),
        })),
        reason: reasonCode,
        description: description.trim(),
        photos: photoUrls.filter(Boolean),
        // Échange ou remboursement : c'est l'admin qui tranche (demande du
        // 2026-10-01). Le montant des produits lui est transmis pour le cas où
        // il choisit de rembourser.
        refund_amount: selectedAmount,
        status: 'pending',
      };
      const created = await createReturn(payload);
      // Réclamation réactivée par l'admin : elle est consommée par cette
      // demande (comme sur le site), sinon le client pourrait en refaire une.
      if (orderQuery.data?.return_request_reopened) {
        try {
          await Order().update?.(route.params.orderId, { return_request_reopened: false });
        } catch {
          /* sans incidence sur la demande, déjà enregistrée */
        }
      }
      return created;
    },
    onSuccess: (created) => {
      clearReturnDraft();
      toast.success('Réclamation envoyée');
      void qc.invalidateQueries({ queryKey: ['returns-mine'] });
      void qc.invalidateQueries({ queryKey: ['my-returns'] });
      void qc.invalidateQueries({ queryKey: ['order', route.params.orderId] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
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
    // Android peut fermer l'app pendant la prise de vue : le brouillon est
    // écrit sur le disque avant d'ouvrir l'appareil photo.
    cameraOpenedAt.current = Date.now();
    persistDraft();
    await kv.flush();
    let r: ImagePicker.ImagePickerResult;
    try {
      r = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        // Pas de recadrage : la photo brute fait foi.
        allowsEditing: false,
      });
    } finally {
      cameraOpenedAt.current = undefined;
      persistDraft();
    }
    if (r.canceled) return;
    setPhotos((p) => [
      ...p,
      ...r.assets.map((a) => ({ uri: a.uri, fileName: a.fileName, mimeType: a.mimeType })),
    ]);
  };

  const confirmSubmit = () => {
    if (!canSubmit) return;
    Alert.alert(
      'Envoyer la demande ?',
      `${selectedCount} article${selectedCount > 1 ? 's' : ''} concerné${selectedCount > 1 ? 's' : ''}. AfriGo choisira l’échange ou le remboursement.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Envoyer', onPress: () => submit.mutate() },
      ],
    );
  };

  // On ne tranche qu'avec la commande (et les demandes) relues à l'instant.
  const returnsReady = !user?.email || returnsQuery.isFetchedAfterMount;
  if (!orderQuery.data || !orderQuery.isFetchedAfterMount || !returnsReady) {
    return (
      <Screen header={<Header onBack={nav.goBack} title="Réclamation" />}>
        <Loader />
      </Screen>
    );
  }

  /**
   * Même garde-fou que le web (« Délai dépassé ») : le formulaire n'est
   * accessible que dans l'heure qui suit la livraison, et tant qu'aucune
   * demande n'a été approuvée ou terminée sur cette commande.
   */
  const locked = hasLockingReturn(returnsQuery.data, orderQuery.data.id, {
    reopened: orderQuery.data.return_request_reopened === true,
  });
  const notDelivered = orderQuery.data.status !== 'delivered';
  if (!canRequestReturn(orderQuery.data, { locked })) {
    return (
      <Screen header={<Header onBack={nav.goBack} title="Réclamation" />}>
        <Card padding={20} style={{ marginTop: 16, alignItems: 'center' }}>
          <View style={[styles.expiredIcon, { backgroundColor: palette.rose[100] }]}>
            <Clock size={28} color={palette.rose[600]} />
          </View>
          <Text style={[styles.expiredTitle, { color: colors.foreground }]}>
            {locked
              ? 'Demande déjà traitée'
              : notDelivered
                ? 'Commande pas encore livrée'
                : 'Délai dépassé'}
          </Text>
          <Text style={[styles.expiredText, { color: colors.mutedForeground }]}>
            {locked
              ? 'Une demande de retour a déjà été acceptée pour cette commande.'
              : notDelivered
                ? `Vous pourrez demander un retour pendant ${RETURN_WINDOW_HOURS} h à partir de la livraison.`
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
    <Screen scroll header={<Header onBack={nav.goBack} title="Réclamation" />}>
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

