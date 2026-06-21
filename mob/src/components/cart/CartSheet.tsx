import React, { useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetView,
  BottomSheetFooter,
  type BottomSheetFooterProps,
} from '@gorhom/bottom-sheet';
import { Image } from 'expo-image';
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCart } from '@/stores/cart';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/lib/AuthContext';
import {
  remoteDecrementAfterRemove,
  remoteDeleteLine,
  remoteUpsertAfterAdd,
} from '@/lib/cartRemote';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatPrice } from '@/utils/format';
import type { RootStackParamList } from '@/navigation/types';
import type { CartLine } from '@/stores/cart';

export interface CartSheetRef {
  open: () => void;
  close: () => void;
}

export const CartSheet = forwardRef<CartSheetRef>((_, ref) => {
  const sheetRef = useRef<BottomSheet>(null);
  const { lines, add, remove, setQuantity, total } = useCart();
  const { colors } = useTheme();
  const { user } = useAuth();
  const email = user?.email;
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const snapPoints = useMemo(() => ['65%', '92%'], []);

  useImperativeHandle(
    ref,
    () => ({
      open: () => sheetRef.current?.snapToIndex(0),
      close: () => sheetRef.current?.close(),
    }),
    [],
  );

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    [],
  );

  const handleCheckout = () => {
    sheetRef.current?.close();
    nav.navigate('Checkout');
  };

  const renderLine = useCallback(
    ({ item }: { item: CartLine }) => (
      <View
        style={[
          styles.line,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Image
          source={{
            uri: item.imageUrl ?? 'https://images.unsplash.com/photo-1543168256-418811576931?w=200',
          }}
          style={styles.thumb}
          contentFit="cover"
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.variant?.value ? (
            <Text style={[styles.variant, { color: colors.mutedForeground }]}>{item.variant.value}</Text>
          ) : null}
          <Text style={[styles.price, { color: colors.foreground }]}>{formatPrice(item.unitPrice)}</Text>
        </View>
        <View style={[styles.qtyBox, { backgroundColor: colors.muted }]}>
          <Pressable
            hitSlop={6}
            onPress={() => {
              remove(item.productId, item.variant?.value);
              if (email) void remoteDecrementAfterRemove(email, item.productId, item.variant);
            }}
            style={styles.qtyBtn}
          >
            <Minus size={16} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.qty, { color: colors.foreground }]}>{item.quantity}</Text>
          <Pressable
            hitSlop={6}
            onPress={() => {
              add({ ...item, quantity: 1, variant: item.variant ?? undefined });
              if (email)
                void remoteUpsertAfterAdd(email, {
                  productId: item.productId,
                  name: item.name,
                  imageUrl: item.imageUrl,
                  unitPrice: item.unitPrice,
                  category: item.category,
                  unit: item.unit,
                  variant: item.variant,
                  quantity: 1,
                });
            }}
            style={styles.qtyBtn}
          >
            <Plus size={16} color={colors.foreground} />
          </Pressable>
        </View>
        <Pressable
          hitSlop={8}
          onPress={() => {
            setQuantity(item.productId, 0, item.variant?.value);
            if (email) void remoteDeleteLine(email, item.productId, item.variant);
          }}
        >
          <Trash2 size={18} color={colors.destructive} />
        </Pressable>
      </View>
    ),
    [add, colors, email, remove, setQuantity],
  );

  const footerPad = Math.max(insets.bottom, 12);

  /** Hauteur réservée sous la liste pour que le dock ne masque pas la dernière ligne. */
  const FOOTER_BLOCK = 132;

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => {
      if (lines.length === 0) return null;
      return (
        <BottomSheetFooter {...props} bottomInset={0}>
          <View
            style={[
              styles.sheetFooter,
              {
                borderTopColor: colors.border,
                backgroundColor: colors.background,
                paddingBottom: footerPad,
              },
            ]}
          >
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Total</Text>
              <Text style={[styles.totalValue, { color: colors.foreground }]}>
                {formatPrice(total())}
              </Text>
            </View>
            <Button
              title="Passer la commande"
              variant="brand"
              size="lg"
              fullWidth
              onPress={handleCheckout}
            />
          </View>
        </BottomSheetFooter>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines.length, colors.border, colors.background, colors.mutedForeground, colors.foreground, footerPad, total],
  );

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      footerComponent={renderFooter}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      backgroundStyle={{ backgroundColor: colors.background }}
    >
      {lines.length === 0 ? (
        <BottomSheetView style={[styles.emptyWrap, { paddingBottom: footerPad }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Mon panier</Text>
          <EmptyState
            title="Panier vide"
            description="Ajoutez vos produits préférés depuis la page d'accueil."
            icon={<ShoppingBag size={48} color={colors.mutedForeground} />}
          />
        </BottomSheetView>
      ) : (
        <BottomSheetView style={styles.sheetRoot}>
          <Text style={[styles.title, { color: colors.foreground }]}>Mon panier</Text>
          <View style={styles.listSlot}>
            <BottomSheetFlatList
              data={lines}
              keyExtractor={(item) => `${item.productId}-${item.variant?.value ?? ''}`}
              renderItem={renderLine}
              contentContainerStyle={[styles.listContent, { paddingBottom: FOOTER_BLOCK + footerPad }]}
            />
          </View>
        </BottomSheetView>
      )}
    </BottomSheet>
  );
});

CartSheet.displayName = 'CartSheet';

const styles = StyleSheet.create({
  emptyWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sheetRoot: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  listSlot: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    paddingVertical: 4,
    gap: 8,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  name: { fontSize: 14, fontWeight: '700' },
  variant: { fontSize: 11, marginTop: 2 },
  price: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 4 },
  qtyBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  qty: { fontSize: 14, fontWeight: '700', minWidth: 24, textAlign: 'center' },
  sheetFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 12,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 14, fontWeight: '600' },
  totalValue: { fontSize: 22, fontWeight: '800' },
});
