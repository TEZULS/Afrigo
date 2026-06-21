import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, Minus, ShoppingBag, Star, ShoppingCart, Truck, MapPin } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { ProductCard, ProductDTO } from '@/components/products/ProductCard';
import { useTheme } from '@/theme/ThemeProvider';
import { Product, Review, DeliveryZone } from '@/api/entities';
import { useCart } from '@/stores/cart';
import { useAuth } from '@/lib/AuthContext';
import { remoteDecrementAfterRemove, remoteUpsertAfterAdd } from '@/lib/cartRemote';
import { formatPrice } from '@/utils/format';
import { palette } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

type Variant = {
  type?: string;
  value?: string;
  price_modifier?: number;
  promotion_price?: number;
  image_url?: string;
  stock_quantity?: number;
  color_code?: string;
};

interface ProductFull {
  id: string;
  name: string;
  description?: string;
  price: number;
  promotion_price?: number;
  is_promotion?: boolean;
  promotion_end_date?: string;
  image_url?: string;
  images?: string[];
  category?: string;
  unit?: string;
  stock_quantity?: number;
  variants?: Variant[];
  country_of_origin?: string;
  featured_groups?: string[];
}

interface ZoneRow {
  id: string;
  name: string;
  delivery_fee: number;
  delivery_time_days?: string;
  free_delivery_threshold?: number;
  postal_codes?: string[];
}

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1543168256-418811576931?w=600';

const FEATURED_GROUPS: Record<string, { label: string; icon: string }> = {
  nouveaute: { label: 'Nouveauté', icon: '✨' },
  meilleure_vente: { label: 'Meilleure vente', icon: '🔥' },
  coup_de_coeur: { label: 'Coup de cœur', icon: '❤️' },
  recommande: { label: 'Recommandé', icon: '⭐' },
  bio: { label: 'Bio & Local', icon: '🌱' },
  exclusif: { label: 'Exclusif', icon: '💎' },
};

const COUNTRIES: Record<string, { name: string; flag: string }> = {
  FR: { name: 'France', flag: '🇫🇷' },
  CM: { name: 'Cameroun', flag: '🇨🇲' },
  CI: { name: "Côte d'Ivoire", flag: '🇨🇮' },
  SN: { name: 'Sénégal', flag: '🇸🇳' },
  ML: { name: 'Mali', flag: '🇲🇱' },
  BJ: { name: 'Bénin', flag: '🇧🇯' },
  TG: { name: 'Togo', flag: '🇹🇬' },
  BF: { name: 'Burkina Faso', flag: '🇧🇫' },
  NE: { name: 'Niger', flag: '🇳🇪' },
  TD: { name: 'Tchad', flag: '🇹🇩' },
  CG: { name: 'Congo', flag: '🇨🇬' },
  CD: { name: 'RD Congo', flag: '🇨🇩' },
  GA: { name: 'Gabon', flag: '🇬🇦' },
  GN: { name: 'Guinée', flag: '🇬🇳' },
  MA: { name: 'Maroc', flag: '🇲🇦' },
  TN: { name: 'Tunisie', flag: '🇹🇳' },
  DZ: { name: 'Algérie', flag: '🇩🇿' },
  EG: { name: 'Égypte', flag: '🇪🇬' },
  NG: { name: 'Nigeria', flag: '🇳🇬' },
  GH: { name: 'Ghana', flag: '🇬🇭' },
  KE: { name: 'Kenya', flag: '🇰🇪' },
  ET: { name: 'Éthiopie', flag: '🇪🇹' },
  ZA: { name: 'Afrique du Sud', flag: '🇿🇦' },
  ES: { name: 'Espagne', flag: '🇪🇸' },
  IT: { name: 'Italie', flag: '🇮🇹' },
  PT: { name: 'Portugal', flag: '🇵🇹' },
  BE: { name: 'Belgique', flag: '🇧🇪' },
  NL: { name: 'Pays-Bas', flag: '🇳🇱' },
  DE: { name: 'Allemagne', flag: '🇩🇪' },
  GB: { name: 'Royaume-Uni', flag: '🇬🇧' },
  BR: { name: 'Brésil', flag: '🇧🇷' },
  US: { name: 'États-Unis', flag: '🇺🇸' },
  CN: { name: 'Chine', flag: '🇨🇳' },
  IN: { name: 'Inde', flag: '🇮🇳' },
  TH: { name: 'Thaïlande', flag: '🇹🇭' },
  VN: { name: 'Vietnam', flag: '🇻🇳' },
  MX: { name: 'Mexique', flag: '🇲🇽' },
  AR: { name: 'Argentine', flag: '🇦🇷' },
  CO: { name: 'Colombie', flag: '🇨🇴' },
  OTHER: { name: 'Autre', flag: '🌍' },
};

const VARIANT_TYPE_LABELS: Record<string, string> = {
  taille: 'Taille',
  forme: 'Forme',
  poids: 'Poids',
  pack: 'Type de pack',
};

/**
 * Suffixe affiché à côté du prix selon l'unité de vente du produit
 * (cf. schéma Product.unit). Aligné sur le web où on voit « 2,49 € / kilo ».
 */
const UNIT_PRICE_SUFFIX: Record<string, string> = {
  piece: 'pièce',
  unite: 'unité',
  kg: 'kilo',
  litre: 'litre',
  metre: 'mètre',
  bouteille: 'bouteille',
  pack: 'pack',
  lot: 'lot',
  carton: 'carton',
  sac: 'sac',
  sache: 'sachet',
  boite: 'boîte',
};

const unitSuffix = (unit?: string): string =>
  unit && UNIT_PRICE_SUFFIX[unit] ? ` / ${UNIT_PRICE_SUFFIX[unit]}` : '';

const WIN_W = Dimensions.get('window').width;

export const ProductDetailsScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'ProductDetails'>>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { add, remove, lines, count: cartCount } = useCart();
  const syncEmail = user?.email;
  const galleryRef = useRef<FlatList<string>>(null);

  const [variant, setVariant] = useState<Variant | null>(null);
  const [qtyPick, setQtyPick] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);

  const productQuery = useQuery<ProductFull | null>({
    queryKey: ['product', route.params.id],
    queryFn: async () => (await Product().get?.(route.params.id) as Promise<ProductFull | null>),
  });

  const reviewsQuery = useQuery({
    queryKey: ['product-reviews', route.params.id],
    queryFn: async () =>
      (await Review().filter?.({ product_id: route.params.id })) as
        | { rating: number; comment: string; user_name?: string }[]
        | undefined,
  });

  const allProductsQuery = useQuery<ProductDTO[]>({
    queryKey: ['products'],
    queryFn: async () => ((await Product().list?.()) ?? []) as ProductDTO[],
  });

  const zonesQuery = useQuery<ZoneRow[]>({
    queryKey: ['delivery-zones'],
    queryFn: async () => ((await DeliveryZone().list?.()) ?? []) as ZoneRow[],
  });

  const product = productQuery.data;
  const userPostal = (user?.['postal_code'] as string | undefined) ?? '';
  const userZone = useMemo(
    () =>
      userPostal
        ? (zonesQuery.data ?? []).find((z) => z.postal_codes?.includes(userPostal))
        : null,
    [zonesQuery.data, userPostal],
  );

  const variantKey = variant?.value ?? '';
  useEffect(() => {
    setQtyPick(1);
    setImgIdx(0);
  }, [product?.id, variantKey]);

  const cartQty =
    lines.find(
      (l) => l.productId === product?.id && (l.variant?.value ?? null) === (variant?.value ?? null),
    )?.quantity ?? 0;

  const variantPromoPrice = variant?.promotion_price;
  const isPromotion = Boolean(
    variantPromoPrice || (product?.is_promotion && product?.promotion_price),
  );
  const baseFromVariant = variantPromoPrice
    ? Number(variantPromoPrice)
    : isPromotion && product?.promotion_price
      ? product.promotion_price
      : (product?.price ?? 0);
  const unitPrice = variantPromoPrice
    ? Number(variantPromoPrice)
    : baseFromVariant + (variant?.price_modifier ?? 0);
  const stock = variant?.stock_quantity ?? product?.stock_quantity ?? 0;

  const images = useMemo(() => {
    if (!product) return [FALLBACK_IMG];
    const main = product.image_url || product.variants?.find((v) => v.image_url)?.image_url;
    const list = main
      ? [main, ...(product.images ?? []).filter((i) => i !== main)]
      : (product.images ?? []);
    if (variant?.image_url && !list.includes(variant.image_url)) list.push(variant.image_url);
    return list.length > 0 ? list : [FALLBACK_IMG];
  }, [product, variant]);

  useEffect(() => {
    if (variant?.image_url) {
      const i = images.indexOf(variant.image_url);
      if (i >= 0) {
        setImgIdx(i);
        galleryRef.current?.scrollToIndex({ index: i, animated: true });
      }
    }
  }, [variant, images]);

  const reviews = reviewsQuery.data ?? [];
  const avgRating =
    reviews.length > 0 ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length : null;

  const variantsByType = useMemo(() => {
    const map: Record<string, Variant[]> = {};
    for (const v of product?.variants ?? []) {
      const key = v.type ?? 'option';
      if (!map[key]) map[key] = [];
      map[key].push(v);
    }
    return map;
  }, [product?.variants]);

  const similarProducts = useMemo(() => {
    if (!product) return [];
    return (allProductsQuery.data ?? [])
      .filter((p) => p.id !== product.id && p.category === product.category)
      .slice(0, 6);
  }, [product, allProductsQuery.data]);

  const bumpQtyPick = (d: number) => {
    setQtyPick((q) => Math.min(Math.max(1, q + d), Math.max(stock, 1)));
  };

  const linePayload = () => ({
    productId: product!.id,
    name: product!.name,
    imageUrl: images[imgIdx] ?? images[0],
    unitPrice,
    variant: variant ?? undefined,
    category: product!.category,
    unit: product!.unit,
  });

  const headerCart = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ouvrir le panier"
      hitSlop={10}
      onPress={() => nav.navigate('ClientTabs', { screen: 'CartTab' })}
      style={({ pressed }) => [styles.hdrCart, { opacity: pressed ? 0.65 : 1 }]}
    >
      <ShoppingCart size={23} strokeWidth={2} color={colors.foreground} />
      {cartCount() > 0 ? (
        <View style={[styles.hdrBadge, { backgroundColor: palette.brand.green }]}>
          <Text style={styles.hdrBadgeTxt}>{cartCount() > 99 ? '99+' : cartCount()}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  if (productQuery.isLoading || !product) {
    return (
      <Screen>
        <Header onBack={nav.goBack} title="Produit" centerTitle />
        <Loader />
      </Screen>
    );
  }

  const country = product.country_of_origin ? COUNTRIES[product.country_of_origin] : null;
  const featuredGroups = (product.featured_groups ?? []).filter((g) => FEATURED_GROUPS[g]);
  const footerInset = Math.max(insets.bottom, 12);

  const onGalleryScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const w = e.nativeEvent.layoutMeasurement.width;
    if (w > 0) setImgIdx(Math.round(x / w));
  };

  return (
    <Screen scroll={false} paddingHorizontal={0} bg={colors.background} edges={['top', 'left', 'right', 'bottom']}>
      <Header
        onBack={nav.goBack}
        title={product.name}
        centerTitle
        right={headerCart}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroBand, { backgroundColor: palette.slate[50] }]}>
          <View style={[styles.heroCard, { backgroundColor: colors.card }]}>
            <FlatList
              ref={galleryRef}
              data={images}
              horizontal
              pagingEnabled
              keyExtractor={(uri, i) => `${i}-${uri}`}
              showsHorizontalScrollIndicator={false}
              onScroll={onGalleryScroll}
              scrollEventThrottle={16}
              renderItem={({ item }) => (
                <Image source={{ uri: item }} style={styles.heroImg} contentFit="cover" />
              )}
              getItemLayout={(_, index) => ({
                length: WIN_W - 32,
                offset: (WIN_W - 32) * index,
                index,
              })}
            />
            {isPromotion ? (
              <View style={styles.heroBadge}>
                <Badge variant="brand" label="Promo" />
              </View>
            ) : null}
            {images.length > 1 ? (
              <View style={styles.dotsRow}>
                {images.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: i === imgIdx ? '#FFF' : 'rgba(255,255,255,0.5)',
                        width: i === imgIdx ? 18 : 6,
                      },
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </View>

          {images.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbs}
            >
              {images.map((uri, i) => (
                <Pressable
                  key={`${uri}-${i}`}
                  onPress={() => {
                    setImgIdx(i);
                    galleryRef.current?.scrollToIndex({ index: i, animated: true });
                  }}
                  style={[
                    styles.thumb,
                    {
                      borderColor: i === imgIdx ? colors.brandOrange : 'transparent',
                    },
                  ]}
                >
                  <Image source={{ uri }} style={styles.thumbImg} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>

        <View style={styles.main}>
          {featuredGroups.length > 0 ? (
            <View style={styles.badgesRow}>
              {featuredGroups.map((g) => (
                <View
                  key={g}
                  style={[
                    styles.featuredBadge,
                    { backgroundColor: palette.emerald[50], borderColor: palette.emerald[200] },
                  ]}
                >
                  <Text style={[styles.featuredText, { color: palette.emerald[700] }]}>
                    {FEATURED_GROUPS[g]!.icon} {FEATURED_GROUPS[g]!.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={[styles.title, { color: colors.foreground }]}>{product.name}</Text>

          {country ? (
            <View style={styles.countryRow}>
              <Text style={{ fontSize: 22 }}>{country.flag}</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: '600' }}>
                Origine : {country.name}
              </Text>
            </View>
          ) : null}

          <View style={styles.priceBlock}>
            <Text style={[styles.price, { color: colors.foreground }]}>
              {formatPrice(unitPrice)}
              <Text style={[styles.priceUnit, { color: colors.mutedForeground }]}>
                {unitSuffix(product.unit)}
              </Text>
            </Text>
            {isPromotion ? (
              <Text style={[styles.strike, { color: colors.mutedForeground }]}>
                {formatPrice(product.price)}
              </Text>
            ) : null}
            {variantPromoPrice ? (
              <Badge label="Promo variante" variant="brand" />
            ) : null}
          </View>

          {product.is_promotion && product.promotion_end_date ? (
            <Text style={[styles.promoEnd, { color: palette.brand.orange }]}>
              🏷️ Promotion valable jusqu'au{' '}
              {new Date(product.promotion_end_date).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          ) : null}

          {stock <= 0 ? (
            <Badge label="Épuisé" variant="destructive" style={{ marginTop: 8, alignSelf: 'flex-start' }} />
          ) : null}

          {avgRating != null ? (
            <Pressable
              style={styles.ratingRow}
              onPress={() => nav.navigate('AllReviews', { productId: product.id })}
            >
              <Star size={16} color={palette.yellow[400]} fill={palette.yellow[400]} />
              <Text style={{ color: colors.foreground, fontWeight: '700' }}>
                {avgRating.toFixed(1)}
              </Text>
              <Text style={{ color: colors.mutedForeground }}>({reviews.length})</Text>
            </Pressable>
          ) : null}

          {product.description ? (
            <Text style={[styles.desc, { color: colors.mutedForeground }]}>{product.description}</Text>
          ) : null}

          {Object.keys(variantsByType).length > 0 ? (
            <View style={{ marginTop: 18 }}>
              {Object.entries(variantsByType).map(([type, variants]) => (
                <View key={type} style={{ marginBottom: 12 }}>
                  <Text style={[styles.sectionLbl, { color: colors.foreground }]}>
                    {VARIANT_TYPE_LABELS[type] ?? type} <Text style={{ color: palette.rose[500] }}>*</Text>
                  </Text>
                  <View style={styles.variantRow}>
                    {variants.map((v, i) => {
                      const selected = variant?.value === v.value;
                      const variantUnitPrice = v.promotion_price
                        ? Number(v.promotion_price)
                        : product.price + (v.price_modifier ?? 0);
                      return (
                        <Pressable
                          key={`${type}-${i}`}
                          onPress={() => setVariant(selected ? null : v)}
                          style={[
                            styles.variantChip,
                            {
                              borderColor: selected ? palette.emerald[500] : colors.border,
                              backgroundColor: selected ? palette.emerald[50] : 'transparent',
                            },
                          ]}
                        >
                          {v.color_code ? (
                            <View style={[styles.colorDot, { backgroundColor: v.color_code }]} />
                          ) : null}
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{ color: colors.foreground, fontWeight: '600', fontSize: 13 }}
                            >
                              {v.value}
                            </Text>
                            {v.promotion_price ? (
                              <View
                                style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}
                              >
                                <Text
                                  style={{
                                    color: palette.brand.orange,
                                    fontWeight: '700',
                                    fontSize: 12,
                                  }}
                                >
                                  {formatPrice(Number(v.promotion_price))}
                                </Text>
                                <Text
                                  style={{
                                    color: colors.mutedForeground,
                                    fontSize: 10,
                                    textDecorationLine: 'line-through',
                                  }}
                                >
                                  {formatPrice(product.price + (v.price_modifier ?? 0))}
                                </Text>
                              </View>
                            ) : v.price_modifier ? (
                              <Text style={{ color: palette.emerald[600], fontSize: 11, marginTop: 2 }}>
                                {v.price_modifier > 0 ? '+' : ''}
                                {formatPrice(variantUnitPrice)}
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <Card padding={12} style={{ marginTop: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Truck size={16} color={palette.blue[600]} />
              <Text style={{ color: palette.blue[700], fontWeight: '600', fontSize: 13 }}>
                Livraison gratuite dès {userZone?.free_delivery_threshold ?? 29}€
              </Text>
            </View>
            {userZone ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <MapPin size={16} color={palette.blue[600]} />
                <Text style={{ color: palette.blue[700], fontSize: 12 }}>
                  Zone : {userZone.name}
                  {userZone.delivery_time_days ? ` (${userZone.delivery_time_days})` : ''}
                </Text>
              </View>
            ) : user ? (
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                Indiquez votre code postal dans votre profil pour les délais.
              </Text>
            ) : (
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                Connectez-vous pour voir vos délais de livraison.
              </Text>
            )}
          </Card>

          {similarProducts.length > 0 ? (
            <View style={{ marginTop: 24 }}>
              <Text style={[styles.title, { color: colors.foreground, fontSize: 18 }]}>
                Produits similaires
              </Text>
              <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {similarProducts.map((p) => (
                  <View key={p.id} style={{ width: (WIN_W - 16 - 16 - 12) / 2 }}>
                    <ProductCard
                      product={p}
                      cartQuantity={
                        lines.find((l) => l.productId === p.id && !l.variant?.value)?.quantity ?? 0
                      }
                      onAddToCart={(prod) => {
                        const line = {
                          productId: prod.id,
                          name: prod.name,
                          imageUrl: prod.image_url,
                          unitPrice:
                            prod.is_promotion && prod.promotion_price != null
                              ? prod.promotion_price
                              : prod.price,
                          category: prod.category,
                          unit: prod.unit,
                        };
                        add(line);
                        if (syncEmail) void remoteUpsertAfterAdd(syncEmail, { ...line, quantity: 1 });
                      }}
                      onRemoveFromCart={(prod) => {
                        remove(prod.id);
                        if (syncEmail) void remoteDecrementAfterRemove(syncEmail, prod.id);
                      }}
                    />
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: 14,
            paddingHorizontal: 16,
          },
        ]}
      >
        {cartQty === 0 && stock > 0 ? (
          <View style={[styles.pickRow, { backgroundColor: colors.muted }]}>
            <Pressable hitSlop={8} onPress={() => bumpQtyPick(-1)} disabled={qtyPick <= 1}>
              <Minus size={22} color={qtyPick <= 1 ? colors.mutedForeground : colors.foreground} />
            </Pressable>
            <Text style={[styles.pickVal, { color: colors.foreground }]}>{qtyPick}</Text>
            <Pressable hitSlop={8} onPress={() => bumpQtyPick(1)} disabled={qtyPick >= stock}>
              <Plus size={22} color={qtyPick >= stock ? colors.mutedForeground : colors.foreground} />
            </Pressable>
          </View>
        ) : null}

        {cartQty === 0 ? (
          <Button
            title={stock > 0 ? 'Ajouter au panier' : 'Indisponible'}
            variant="primary"
            size="lg"
            disabled={stock <= 0}
            fullWidth
            leftIcon={<ShoppingBag size={18} color="#FFF" />}
            style={{ marginTop: cartQty === 0 && stock > 0 ? 10 : 0, borderRadius: 10 }}
            onPress={() => {
              const line = linePayload();
              add({ ...line, quantity: qtyPick });
              if (syncEmail)
                void remoteUpsertAfterAdd(syncEmail, { ...line, quantity: qtyPick });
              setQtyPick(1);
            }}
          />
        ) : (
          <View style={[styles.inCartRow, { backgroundColor: colors.muted }]}>
            <Text style={[styles.inCartLbl, { color: colors.foreground }]}>
              Dans votre panier
            </Text>
            <View style={styles.inCartCtrls}>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  remove(product.id, variant?.value);
                  if (syncEmail)
                    void remoteDecrementAfterRemove(syncEmail, product.id, variant ?? undefined);
                }}
              >
                <Minus size={22} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.inCartQty, { color: colors.foreground }]}>{cartQty}</Text>
              <Pressable
                hitSlop={8}
                disabled={cartQty >= stock}
                onPress={() => {
                  const line = linePayload();
                  add({ ...line, quantity: 1 });
                  if (syncEmail)
                    void remoteUpsertAfterAdd(syncEmail, { ...line, quantity: 1 });
                }}
              >
                <Plus
                  size={22}
                  color={cartQty >= stock ? colors.mutedForeground : colors.foreground}
                />
              </Pressable>
            </View>
          </View>
        )}

        {cartQty > 0 ? (
          <Button
            title="Voir le panier"
            variant="outline"
            size="md"
            fullWidth
            onPress={() => nav.navigate('ClientTabs', { screen: 'CartTab' })}
            style={{ marginTop: 10, borderRadius: 10 }}
          />
        ) : null}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hdrCart: {
    padding: 8,
    position: 'relative',
    marginRight: -4,
  },
  hdrBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  hdrBadgeTxt: { color: '#FFF', fontSize: 10, fontWeight: '800' },

  heroBand: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  heroCard: {
    width: WIN_W - 32,
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  heroImg: { width: WIN_W - 32, aspectRatio: 1 },
  heroBadge: { position: 'absolute', top: 12, left: 12 },
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { height: 6, borderRadius: 999 },

  thumbs: { gap: 8, paddingTop: 12 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 2,
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },

  main: {
    paddingHorizontal: 16,
    paddingTop: 4,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 4 },
  featuredBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  featuredText: { fontSize: 11, fontWeight: '700' },

  title: { fontSize: 21, fontWeight: '700', letterSpacing: -0.2, marginTop: 6 },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  priceBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  price: { fontSize: 26, fontWeight: '800' },
  priceUnit: { fontSize: 14, fontWeight: '500' },
  strike: { fontSize: 16, textDecorationLine: 'line-through' },
  promoEnd: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  stock: { fontSize: 14, fontWeight: '600', marginTop: 10 },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  desc: { fontSize: 14, lineHeight: 21, marginTop: 14 },
  sectionLbl: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  variantRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    minWidth: 110,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },

  footer: {
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  pickVal: { fontSize: 17, fontWeight: '800' },

  inCartRow: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inCartLbl: { fontWeight: '600', fontSize: 14 },
  inCartCtrls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  inCartQty: { fontSize: 18, fontWeight: '800', minWidth: 28, textAlign: 'center' },
});
