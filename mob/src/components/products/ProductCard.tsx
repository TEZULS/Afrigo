import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Image } from 'expo-image';
import { Plus, Minus, ShoppingBag, Percent, Users } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@/theme/ThemeProvider';
import { Badge } from '@/components/ui/Badge';
import { palette } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';
import { CATEGORY_LABELS } from '@/utils/categories';
import { unitLabel } from '@/utils/units';
import {
  catalogPrice,
  hasPromotion,
  promotionDiscountPercent,
  sellingPrice,
  splitPrice,
} from '@/utils/productPricing';

export interface ProductDTO {
  id: string;
  name: string;
  category?: string;
  unit?: string;
  /** Prix HT quand `vat_rate` est renseigné, sinon prix client (produits anciens). */
  price: number;
  /** Prix TTC calculé par l'admin — c'est lui qui est affiché et facturé. */
  price_ttc?: number | null;
  vat_rate?: number | null;
  promotion_price?: number;
  is_promotion?: boolean;
  image_url?: string;
  stock_quantity?: number;
  show_purchase_count?: boolean;
  purchase_count?: number;
  purchase_count_message?: string;
  variants?: { value?: string; image_url?: string }[];
  /** Produit masqué du catalogue quand `false` (base44 `Product.is_active`). */
  is_active?: boolean;
  /** Niveaux de fidélité autorisés à acheter — vide/absent = tous. */
  allowed_tiers?: string[];
  /** Date de création (UTC sans fuseau côté base44) — sert aux « Nouveaux produits ». */
  created_date?: string;
  /** Mises en avant admin (`nouveaute`, `meilleure_vente`…). */
  featured_groups?: string[];
}

interface ProductCardProps {
  product: ProductDTO;
  cartQuantity?: number;
  onAddToCart: (p: ProductDTO) => void;
  onRemoveFromCart: (p: ProductDTO) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  cartQuantity = 0,
  onAddToCart,
  onRemoveFromCart,
}) => {
  const { colors } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const isOutOfStock = (product.stock_quantity ?? 0) <= 0;
  // Au moins une variante : le choix est obligatoire, on renvoie vers la fiche produit
  // (même règle que le web déployé — sinon la variante et son `price_modifier` sont ignorés).
  const requiresVariantChoice = (product.variants?.length ?? 0) > 0;
  const isPromotion = hasPromotion(product);
  // Prix TTC (`price_ttc` dès que la TVA est renseignée, sinon `price`).
  const basePrice = catalogPrice(product);
  const displayPrice = sellingPrice(product);
  const discount = promotionDiscountPercent(product);

  const imgUri =
    product.image_url ??
    product.variants?.find((v) => v.image_url)?.image_url ??
    'https://images.unsplash.com/photo-1543168256-418811576931?w=400';

  const { int: intPart, dec: decPart } = splitPrice(displayPrice);

  return (
    <Pressable
      onPress={() => nav.navigate('ProductDetails', { id: product.id })}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.95 : 1 },
      ]}
    >
      {isPromotion && (
        <View style={styles.promo}>
          <Badge
            variant="brand"
            label={`-${discount}%`}
            leftIcon={<Percent size={12} color="#FFF" />}
            style={{ backgroundColor: palette.rose[500] }}
          />
        </View>
      )}

      <View style={[styles.imageWrap, { backgroundColor: palette.slate[50] }]}>
        <Image source={{ uri: imgUri }} style={styles.image} contentFit="cover" />
        {isOutOfStock && (
          <View style={styles.outOfStock}>
            <Text style={styles.outOfStockText}>Épuisé</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {(() => {
          const raw = (
            CATEGORY_LABELS[product.category ?? ''] ??
            product.category ??
            ''
          ).trim();
          if (!raw) return null;
          return (
            <Text style={[styles.category, { color: palette.brand.orange }]} numberOfLines={1}>
              {raw.toUpperCase()}
            </Text>
          );
        })()}
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {product.name}
        </Text>
        {product.show_purchase_count && (product.purchase_count ?? 0) > 0 ? (
          <View style={styles.purchaseRow}>
            <Users size={12} color={palette.emerald[600]} />
            <Text style={[styles.purchaseText, { color: palette.emerald[600] }]} numberOfLines={1}>
              {product.purchase_count}{' '}
              {product.purchase_count_message ?? 'personnes ont acheté ce produit'}
            </Text>
          </View>
        ) : null}

        <View style={styles.priceRow}>
          <Text style={[styles.priceInt, { color: colors.foreground }]}>{intPart}</Text>
          <Text style={[styles.priceDec, { color: colors.foreground }]}>.{decPart}</Text>
          <Text style={[styles.currency, { color: colors.foreground }]}> €</Text>
          {unitLabel(product.unit) ? (
            <Text style={[styles.unit, { color: colors.mutedForeground }]}>
              / {unitLabel(product.unit)}
            </Text>
          ) : null}
        </View>
        {isPromotion ? (
          <Text style={[styles.priceStrike, { color: colors.mutedForeground }]}>
            {basePrice.toFixed(2)} €
          </Text>
        ) : null}

        {isOutOfStock ? (
          <View style={[styles.btnDisabled, { backgroundColor: palette.slate[100], borderColor: palette.slate[200] }]}>
            <Text style={{ color: palette.slate[400], fontWeight: '700' }}>Épuisé</Text>
          </View>
        ) : cartQuantity === 0 || requiresVariantChoice ? (
          <Pressable
            onPress={(e) => {
              e?.stopPropagation?.();
              if (requiresVariantChoice) {
                nav.navigate('ProductDetails', { id: product.id });
                return;
              }
              onAddToCart(product);
            }}
            android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
            style={[styles.addBtn, { backgroundColor: palette.brand.green }]}
          >
            <ShoppingBag size={16} color="#FFF" />
            <Text style={styles.addBtnText}>
              {requiresVariantChoice ? 'Choisir' : 'Ajouter'}
            </Text>
          </Pressable>
        ) : (
          <View
            style={[
              styles.qtyRow,
              {
                backgroundColor: palette.slate[200],
                borderWidth: 0,
              },
            ]}
          >
            <Pressable
              hitSlop={8}
              onPress={(e) => {
                e?.stopPropagation?.();
                onRemoveFromCart(product);
              }}
              style={({ pressed }) => [styles.qtyBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Minus size={18} color={palette.slate[700]} strokeWidth={2.5} />
            </Pressable>
            <Text style={[styles.qtyText, { color: palette.slate[700] }]}>{cartQuantity}</Text>
            <Pressable
              hitSlop={8}
              disabled={cartQuantity >= (product.stock_quantity ?? 0)}
              onPress={(e) => {
                e?.stopPropagation?.();
                onAddToCart(product);
              }}
              style={({ pressed }) => [
                styles.qtyBtn,
                {
                  opacity: cartQuantity >= (product.stock_quantity ?? 0) ? 0.4 : pressed ? 0.6 : 1,
                },
              ]}
            >
              <Plus size={18} color={palette.slate[700]} strokeWidth={2.5} />
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  promo: { position: 'absolute', top: 12, left: 12, zIndex: 10 },
  imageWrap: { aspectRatio: 1, padding: 10, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%', borderRadius: 14, backgroundColor: palette.slate[100] },
  outOfStock: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  outOfStockText: {
    backgroundColor: 'rgba(15,23,42,0.85)',
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  content: { padding: 14 },
  category: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  name: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  purchaseRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  purchaseText: { fontSize: 11, fontWeight: '600', flex: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  priceInt: { fontSize: 26, fontWeight: '800' },
  priceDec: { fontSize: 16, fontWeight: '800' },
  currency: { fontSize: 18, fontWeight: '800' },
  unit: { fontSize: 12, marginLeft: 4 },
  priceStrike: { fontSize: 12, textDecorationLine: 'line-through', marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    marginTop: 10,
  },
  addBtnText: { color: '#FFF', fontWeight: '700' },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 6,
    marginTop: 10,
  },
  qtyBtn: { padding: 8 },
  qtyText: { fontSize: 16, fontWeight: '700' },
  btnDisabled: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
});
