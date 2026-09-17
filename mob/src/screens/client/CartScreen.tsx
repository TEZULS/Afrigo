import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Platform } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Image } from 'expo-image';
import {
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  Truck,
  X,
  Check,
  MapPin,
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useCart, cartLineKey, type CartLine } from '@/stores/cart';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/lib/AuthContext';
import { DeliveryZone } from '@/api/entities';
import {
  remoteDecrementAfterRemove,
  remoteDeleteLine,
  remoteUpsertAfterAdd,
} from '@/lib/cartRemote';
import { formatPrice } from '@/utils/format';
import { useCartVatRates } from '@/hooks/useCartVatRates';
import { palette } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

const lineKey = cartLineKey;

export const CartScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const { colors } = useTheme();
  const { user } = useAuth();
  const email = user?.email;
  const userObj = user as Record<string, unknown> | null;
  const userPostal = (userObj?.postal_code as string | undefined) ?? '';
  const hasAddress = !!userPostal;

  const { lines, add, remove, setQuantity } = useCart();

  // sélection initiale = toutes les lignes cochées (comme web)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(lines.map(lineKey)),
  );

  // synchronise la sélection si la composition du panier change
  React.useEffect(() => {
    setSelectedKeys((prev) => {
      const keys = new Set(lines.map(lineKey));
      // garde uniquement les sélections encore présentes ; si rien ne reste, tout cocher
      const next = new Set<string>();
      prev.forEach((k) => {
        if (keys.has(k)) next.add(k);
      });
      if (next.size === 0 && lines.length > 0) lines.forEach((l) => next.add(lineKey(l)));
      // ajoute par défaut les nouvelles lignes (cochées)
      keys.forEach((k) => {
        if (!next.has(k)) next.add(k);
      });
      return next;
    });
  }, [lines]);

  const zonesQuery = useQuery({
    queryKey: ['delivery-zones'],
    queryFn: async () =>
      ((await DeliveryZone().list?.()) ?? []) as {
        id: string;
        name: string;
        postal_codes?: string[];
        free_delivery_threshold?: number;
      }[],
  });
  const userZone = useMemo(
    () =>
      userPostal
        ? (zonesQuery.data ?? []).find((z) => z.postal_codes?.includes(userPostal))
        : null,
    [zonesQuery.data, userPostal],
  );

  const selectedLines = useMemo(
    () => lines.filter((l) => selectedKeys.has(lineKey(l))),
    [lines, selectedKeys],
  );
  const subTotal = useMemo(
    () => selectedLines.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0),
    [selectedLines],
  );
  const articleCount = selectedLines.reduce((acc, l) => acc + l.quantity, 0);
  const { totalsOf } = useCartVatRates(lines);
  const vat = useMemo(() => totalsOf(selectedLines), [totalsOf, selectedLines]);
  const freeThreshold = Number(userZone?.free_delivery_threshold ?? 29);
  const remainingForFree = Math.max(0, freeThreshold - subTotal);
  const eligibleFree = subTotal >= freeThreshold;

  const allChecked = lines.length > 0 && selectedKeys.size === lines.length;

  const toggleAll = useCallback(() => {
    setSelectedKeys((prev) => {
      if (prev.size === lines.length) return new Set();
      return new Set(lines.map(lineKey));
    });
  }, [lines]);

  const toggleLine = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const removeSelected = useCallback(() => {
    selectedLines.forEach((l) => {
      setQuantity(l.productId, 0, l.variant?.value);
      if (email) void remoteDeleteLine(email, l.productId, l.variant);
    });
    setSelectedKeys(new Set());
  }, [selectedLines, setQuantity, email]);

  const isTab = route.name === 'CartTab';
  const handleClose = useCallback(() => {
    if (nav.canGoBack()) nav.goBack();
    else nav.navigate('ClientTabs', { screen: 'HomeTab' });
  }, [nav]);

  const renderLine = useCallback(
    ({ item }: { item: CartLine }) => {
      const k = lineKey(item);
      const selected = selectedKeys.has(k);
      return (
        <View
          style={[
            styles.line,
            {
              backgroundColor: selected ? palette.emerald[50] : colors.card,
              borderColor: selected ? palette.emerald[200] : colors.border,
            },
          ]}
        >
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            onPress={() => toggleLine(k)}
            hitSlop={10}
            style={[
              styles.checkbox,
              {
                backgroundColor: selected ? palette.slate[900] : 'transparent',
                borderColor: selected ? palette.slate[900] : colors.border,
              },
            ]}
          >
            {selected ? <Check size={14} color="#FFF" /> : null}
          </Pressable>

          <Image
            source={{
              uri:
                item.imageUrl ?? 'https://images.unsplash.com/photo-1543168256-418811576931?w=200',
            }}
            style={styles.thumb}
            contentFit="cover"
          />

          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.price, { color: colors.foreground }]}>
              {formatPrice(item.unitPrice)}
            </Text>
            <View style={[styles.qtyBox, { backgroundColor: colors.muted }]}>
              <Pressable
                hitSlop={6}
                onPress={() => {
                  remove(item.productId, item.variant?.value);
                  if (email) void remoteDecrementAfterRemove(email, item.productId, item.variant);
                }}
              >
                <Minus size={16} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.qty, { color: colors.foreground }]}>{item.quantity}</Text>
              <Pressable
                hitSlop={6}
                onPress={() => {
                  add({
                    productId: item.productId,
                    name: item.name,
                    imageUrl: item.imageUrl,
                    unitPrice: item.unitPrice,
                    category: item.category,
                    unit: item.unit,
                    vatRate: item.vatRate,
                    variant: item.variant ?? undefined,
                    quantity: 1,
                  });
                  if (email)
                    void remoteUpsertAfterAdd(email, {
                      productId: item.productId,
                      name: item.name,
                      imageUrl: item.imageUrl,
                      unitPrice: item.unitPrice,
                      category: item.category,
                      unit: item.unit,
                      vatRate: item.vatRate,
                      variant: item.variant,
                      quantity: 1,
                    });
                }}
              >
                <Plus size={16} color={colors.foreground} />
              </Pressable>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <Text style={[styles.lineTotal, { color: colors.foreground }]}>
              {formatPrice(item.unitPrice * item.quantity)}
            </Text>
            <Pressable
              accessibilityLabel="Supprimer la ligne"
              hitSlop={8}
              onPress={() => {
                setQuantity(item.productId, 0, item.variant?.value);
                if (email) void remoteDeleteLine(email, item.productId, item.variant);
              }}
            >
              <Trash2 size={18} color={colors.destructive} />
            </Pressable>
          </View>
        </View>
      );
    },
    [add, colors, email, remove, selectedKeys, setQuantity, toggleLine],
  );

  if (lines.length === 0) {
    return (
      <Screen scroll={false} paddingHorizontal={0} edges={['top', 'left', 'right', 'bottom']}>
        <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toolbarTitle, { color: colors.foreground }]}>Mon Panier</Text>
            <Text style={[styles.toolbarSub, { color: colors.mutedForeground }]}>0 article</Text>
          </View>
          <Pressable accessibilityLabel="Fermer" onPress={handleClose} hitSlop={10} style={styles.closeBtn}>
            <X size={18} color={palette.slate[500]} />
          </Pressable>
        </View>
        <EmptyState
          title="Panier vide"
          description="Ajoutez vos produits préférés depuis l'accueil."
          icon={<ShoppingBag size={48} color={colors.mutedForeground} />}
          actionLabel="Voir les produits"
          onAction={() => nav.navigate('ClientTabs', { screen: 'HomeTab' })}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} paddingHorizontal={0} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.page}>
        <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={handleClose}
            accessibilityLabel="Retour"
            hitSlop={10}
            style={{ marginRight: 4 }}
          >
            <Text style={[styles.toolbarBack, { color: colors.foreground }]}>←</Text>
          </Pressable>
          <View style={[styles.toolbarBadge, { backgroundColor: palette.emerald[100] }]}>
            <ShoppingBag size={14} color={palette.emerald[700]} />
          </View>
          <Text style={[styles.toolbarTitle, { color: colors.foreground }]}>Mon Panier</Text>
          <View style={{ flex: 1 }} />
          <Text style={[styles.toolbarSub, { color: colors.mutedForeground, marginRight: 12 }]}>
            {lines.length} {lines.length > 1 ? 'articles' : 'article'}
          </Text>
          <Pressable
            accessibilityLabel="Fermer"
            onPress={handleClose}
            hitSlop={10}
            style={styles.closeBtn}
          >
            <X size={18} color={palette.slate[500]} />
          </Pressable>
        </View>

        <View style={[styles.selectBar, { borderBottomColor: colors.border }]}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allChecked }}
            onPress={toggleAll}
            style={styles.selectLeft}
            hitSlop={10}
          >
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: allChecked ? palette.slate[900] : 'transparent',
                  borderColor: allChecked ? palette.slate[900] : colors.border,
                },
              ]}
            >
              {allChecked ? <Check size={14} color="#FFF" /> : null}
            </View>
            <Text style={[styles.selectAllText, { color: colors.foreground }]}>
              Tout sélectionner ({selectedKeys.size}/{lines.length})
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel={`Supprimer ${selectedKeys.size} éléments`}
            onPress={removeSelected}
            disabled={selectedKeys.size === 0}
            hitSlop={6}
            style={({ pressed }) => [styles.selectDelete, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Trash2 size={16} color={selectedKeys.size === 0 ? colors.mutedForeground : palette.rose[600]} />
            <Text
              style={[
                styles.selectDeleteText,
                {
                  color: selectedKeys.size === 0 ? colors.mutedForeground : palette.rose[600],
                },
              ]}
            >
              Supprimer ({selectedKeys.size})
            </Text>
          </Pressable>
        </View>

        <FlatList
          style={styles.list}
          data={lines}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(it) => lineKey(it)}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 16 }}
          renderItem={renderLine}
        />

        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: isTab ? 16 : 12,
            },
          ]}
        >
          <View style={styles.subRow}>
            <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>
              Sous-total ({articleCount} article{articleCount > 1 ? 's' : ''})
            </Text>
            <Text style={[styles.subValue, { color: colors.foreground }]}>
              {formatPrice(subTotal)}
            </Text>
          </View>

          {eligibleFree ? (
            <View
              style={[
                styles.banner,
                { backgroundColor: palette.emerald[50], borderColor: palette.emerald[200] },
              ]}
            >
              <Truck size={14} color={palette.emerald[700]} />
              <Text style={[styles.bannerText, { color: palette.emerald[700] }]} numberOfLines={2}>
                🎉 Vous bénéficiez de la livraison gratuite !
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.banner,
                { backgroundColor: palette.orange[50], borderColor: palette.orange[100] },
              ]}
            >
              <Truck size={14} color={palette.orange[600]} />
              <Text style={[styles.bannerText, { color: palette.orange[600] }]} numberOfLines={2}>
                Encore {formatPrice(remainingForFree)} pour la livraison gratuite
              </Text>
            </View>
          )}

          {!hasAddress ? (
            <View style={[styles.warnBanner, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
              <MapPin size={14} color="#92400E" />
              <Text style={[styles.warnText, { color: '#92400E' }]} numberOfLines={2}>
                Ajoutez votre adresse dans votre profil pour calculer les frais exacts
              </Text>
            </View>
          ) : null}

          {/*
            Détail HT / TVA des lignes cochées, seulement s'il y a de la TVA :
            les prix du catalogue sont TTC, la TVA est retrouvée à partir du
            taux du produit (`vat_rate`). Sans TVA, on n'affiche que le total.
          */}
          {vat.vat > 0 ? (
          <View style={[styles.vatBox, { borderColor: colors.border }]} testID="cart-vat-breakdown">
            <View style={styles.vatRow}>
              <Text style={[styles.vatLabel, { color: colors.mutedForeground }]}>Montant HT</Text>
              <Text style={[styles.vatValue, { color: colors.foreground }]}>{formatPrice(vat.ht)}</Text>
            </View>
            <View style={styles.vatRow}>
              <Text style={[styles.vatLabel, { color: colors.mutedForeground }]}>
                TVA{vat.byRate.length === 1 && vat.byRate[0]!.rate > 0 ? ` (${vat.byRate[0]!.rate} %)` : ''}
              </Text>
              <Text style={[styles.vatValue, { color: colors.foreground }]}>{formatPrice(vat.vat)}</Text>
            </View>
          </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, { color: colors.foreground }]}>
              {vat.vat > 0 ? 'Total TTC' : 'Total'}
            </Text>
            <Text style={[styles.totalValue, { color: palette.emerald[600] }]}>
              {formatPrice(subTotal)}
            </Text>
          </View>
          <Button
            title={`Commander (${articleCount}) →`}
            variant="primary"
            size="lg"
            fullWidth
            disabled={selectedLines.length === 0}
            // Seules les lignes cochées partent en commande ; les autres restent au panier.
            onPress={() =>
              nav.navigate('Checkout', { lineKeys: selectedLines.map(lineKey) })
            }
          />
        </View>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  toolbarBack: { fontSize: 22, fontWeight: '600', paddingHorizontal: 4 },
  toolbarBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarTitle: { fontSize: 17, fontWeight: '800' },
  toolbarSub: { fontSize: 12 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectAllText: { fontSize: 14, fontWeight: '600' },
  selectDelete: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selectDeleteText: { fontSize: 13, fontWeight: '700' },

  list: { flex: 1 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  name: { fontSize: 14, fontWeight: '700' },
  price: { fontSize: 13, fontWeight: '600', color: palette.emerald[600], marginTop: 2 },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
  },
  qty: { fontSize: 14, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  lineTotal: { fontSize: 14, fontWeight: '800' },

  footer: {
    padding: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  subRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subLabel: { fontSize: 13, fontWeight: '500' },
  subValue: { fontSize: 16, fontWeight: '700' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  bannerText: { fontSize: 12, fontWeight: '700', flex: 1 },

  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  warnText: { fontSize: 12, fontWeight: '600', flex: 1 },

  vatBox: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 2 },
  vatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vatLabel: { fontSize: 12, fontWeight: '500' },
  vatValue: { fontSize: 13, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 15, fontWeight: '700' },
  totalValue: { fontSize: 22, fontWeight: '900' },
});
