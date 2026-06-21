import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Star, Package, User as UserIcon } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Review, Product } from '@/api/entities';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { formatDate } from '@/utils/format';
import {
  PersistentBottomNav,
  PERSISTENT_NAV_HEIGHT,
} from '@/components/PersistentBottomNav';
import type { RootStackParamList } from '@/navigation/types';

interface ReviewDTO {
  id: string;
  product_id?: string;
  order_id?: string;
  rating: number;
  comment?: string;
  user_name?: string;
  customer_name?: string;
  customer_email?: string;
  review_type?: 'general' | 'product';
  is_visible?: boolean;
  admin_response?: string;
  created_date?: string;
}

interface ProductLite {
  id: string;
  name?: string;
  image_url?: string;
}

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1543168256-418811576931?w=200';

export const AllReviewsScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AllReviews'>>();
  const { colors } = useTheme();

  const productId = (route.params?.productId ?? '').trim();
  const isProductMode = productId.length > 0;

  /**
   * Mode produit : avis du produit uniquement.
   * Mode global : on récupère tous les avis (cf. web `AllReviews.jsx` qui
   * appelle `Review.list('-created_date')` sans filtre, puis filtre côté
   * client `is_visible !== false`).
   */
  const reviewsQuery = useQuery<ReviewDTO[]>({
    queryKey: ['reviews-all', productId || 'global'],
    queryFn: async () => {
      if (isProductMode) {
        return ((await Review().filter?.({ product_id: productId })) ?? []) as ReviewDTO[];
      }
      const all =
        ((await Review().list?.('-created_date')) as ReviewDTO[] | undefined) ??
        ((await Review().list?.()) as ReviewDTO[] | undefined) ??
        [];
      return all;
    },
  });

  const productsQuery = useQuery<ProductLite[]>({
    queryKey: ['products-light'],
    enabled: !isProductMode,
    queryFn: async () => ((await Product().list?.()) ?? []) as ProductLite[],
  });

  const productById = useMemo(() => {
    const map = new Map<string, ProductLite>();
    for (const p of productsQuery.data ?? []) map.set(p.id, p);
    return map;
  }, [productsQuery.data]);

  const visibleReviews = useMemo(
    () => (reviewsQuery.data ?? []).filter((r) => r.is_visible !== false),
    [reviewsQuery.data],
  );

  const filteredReviews = visibleReviews;

  const averageRating =
    visibleReviews.length > 0
      ? (visibleReviews.reduce((acc, r) => acc + r.rating, 0) / visibleReviews.length).toFixed(1)
      : '0.0';

  const headerTitle = isProductMode ? 'Avis sur le produit' : 'Avis clients';

  if (reviewsQuery.isLoading) {
    return (
      <Screen>
        <Header onBack={nav.goBack} title={headerTitle} />
        <Loader />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} bottomBar={<PersistentBottomNav />}>
      <Header title={headerTitle} />

      {!isProductMode && visibleReviews.length > 0 ? (
        <View style={styles.statsRow}>
          <Card padding={12} style={[styles.statCard, { borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Note moyenne</Text>
            <View style={styles.statValueRow}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{averageRating}</Text>
              <Star size={16} color={palette.yellow[400]} fill={palette.yellow[400]} />
            </View>
          </Card>
          <Card padding={12} style={[styles.statCard, { borderColor: colors.border }]}>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Total avis</Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {visibleReviews.length}
            </Text>
          </Card>
        </View>
      ) : null}

      {filteredReviews.length === 0 ? (
        <EmptyState
          title="Aucun avis"
          description={
            isProductMode
              ? 'Soyez le premier à donner votre avis sur ce produit.'
              : visibleReviews.length === 0
                ? 'Aucun avis pour le moment. Une fois vos commandes livrées, partagez votre expérience.'
                : 'Aucun avis ne correspond à votre recherche.'
          }
        />
      ) : (
        <FlatList
          data={filteredReviews}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingVertical: 12, gap: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const product = item.product_id ? productById.get(item.product_id) : null;
            return (
              <Card padding={14}>
                <View style={styles.row}>
                  {product ? (
                    <Pressable
                      onPress={() =>
                        product?.id && nav.navigate('ProductDetails', { id: product.id })
                      }
                    >
                      <Image
                        source={{ uri: product.image_url || FALLBACK_IMG }}
                        style={styles.productImg}
                        contentFit="cover"
                      />
                    </Pressable>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <View style={styles.starsRow}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          color={palette.yellow[400]}
                          fill={i < item.rating ? palette.yellow[400] : 'transparent'}
                        />
                      ))}
                      {item.created_date ? (
                        <Text style={[styles.dateTxt, { color: colors.mutedForeground }]}>
                          {formatDate(item.created_date, 'dd MMM yyyy')}
                        </Text>
                      ) : null}
                    </View>
                    {product ? (
                      <Pressable
                        onPress={() => nav.navigate('ProductDetails', { id: product.id })}
                      >
                        <View style={styles.metaRow}>
                          <Package size={14} color={colors.mutedForeground} />
                          <Text style={[styles.metaTxt, { color: colors.foreground }]} numberOfLines={1}>
                            {product.name ?? 'Produit'}
                          </Text>
                        </View>
                      </Pressable>
                    ) : null}
                    <View style={styles.metaRow}>
                      <UserIcon size={14} color={colors.mutedForeground} />
                      <Text style={[styles.customerTxt, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {item.customer_name || item.user_name || 'Client vérifié'}
                      </Text>
                    </View>
                  </View>
                </View>

                {item.comment ? (
                  <View style={[styles.commentBox, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.commentTxt, { color: colors.foreground }]}>
                      « {item.comment} »
                    </Text>
                  </View>
                ) : null}

                {item.admin_response ? (
                  <View style={[styles.adminBox, { backgroundColor: palette.blue[50] }]}>
                    <Text style={[styles.adminLabel, { color: palette.blue[700] }]}>
                      Réponse du vendeur
                    </Text>
                    <Text style={[styles.adminTxt, { color: palette.blue[700] }]}>
                      {item.admin_response}
                    </Text>
                  </View>
                ) : null}
              </Card>
            );
          }}
          refreshing={reviewsQuery.isRefetching}
          onRefresh={() => {
            reviewsQuery.refetch();
            productsQuery.refetch();
          }}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  statCard: { flex: 1, borderWidth: 1 },
  statLabel: { fontSize: 11, fontWeight: '600' },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statValue: { fontSize: 22, fontWeight: '800' },

  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  productImg: { width: 64, height: 64, borderRadius: 12 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  dateTxt: { fontSize: 11, marginLeft: 8, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  metaTxt: { fontSize: 13, fontWeight: '700', flex: 1 },
  customerTxt: { fontSize: 12, flex: 1 },

  commentBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
  },
  commentTxt: { fontSize: 14, lineHeight: 21, fontStyle: 'italic' },

  adminBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: palette.blue[500],
  },
  adminLabel: { fontSize: 11, fontWeight: '800', marginBottom: 4 },
  adminTxt: { fontSize: 13, lineHeight: 19 },
});
