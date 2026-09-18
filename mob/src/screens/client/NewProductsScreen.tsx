import React, { useMemo } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Loader } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductCard, ProductDTO } from '@/components/products/ProductCard';
import { Product } from '@/api/entities';
import { remoteDecrementAfterRemove, remoteUpsertAfterAdd } from '@/lib/cartRemote';
import { useAuth } from '@/lib/AuthContext';
import { useCart } from '@/stores/cart';
import type { RootStackParamList } from '@/navigation/types';
import { sellingPrice } from '@/utils/productPricing';
import { selectNewProducts } from '@/utils/newProducts';

export const NewProductsScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const cart = useCart();
  const { user } = useAuth();
  const query = useQuery<ProductDTO[]>({
    queryKey: ['products'],
    queryFn: async () => ((await Product().list?.()) ?? []) as ProductDTO[],
  });

  const cartQty = (id: string) => cart.lines.find((l) => l.productId === id)?.quantity ?? 0;
  const customerEmail = user?.email;
  // Mêmes règles que l'accueil et le site : créés depuis 7 jours, actifs, plus récents d'abord.
  const data = useMemo(
    () => selectNewProducts((query.data ?? []).filter((p) => p.is_active !== false)),
    [query.data],
  );

  const headerBack = nav.canGoBack() ? nav.goBack : undefined;

  return (
    <Screen scroll={false} paddingHorizontal={0}>
      <Header onBack={headerBack} title="Nouveaux produits" />
      {query.isLoading ? (
        <Loader />
      ) : data.length === 0 ? (
        <EmptyState title="Aucun nouveau produit" description="Les nouveautés des 7 derniers jours apparaîtront ici." />
      ) : (
        <FlatList
          data={data}
          numColumns={2}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 12, gap: 12 }}
          columnWrapperStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <View style={styles.gridCell}>
              <ProductCard
                product={item}
                cartQuantity={cartQty(item.id)}
                onAddToCart={(p) => {
                  const line = {
                    productId: p.id,
                    name: p.name,
                    imageUrl: p.image_url,
                    unitPrice: sellingPrice(p),
                    category: p.category,
                    unit: p.unit,
                    vatRate: p.vat_rate ?? null,
                  };
                  cart.add(line);
                  if (customerEmail) void remoteUpsertAfterAdd(customerEmail, { ...line, quantity: 1 });
                }}
                onRemoveFromCart={(p) => {
                  cart.remove(p.id);
                  if (customerEmail) void remoteDecrementAfterRemove(customerEmail, p.id);
                }}
              />
            </View>
          )}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  /** Cellule d'une grille 2 par 2 : sans `flex: 1`, la carte (largeur 100 %) prenait toute la ligne. */
  gridCell: { flex: 1, maxWidth: '50%' },
});
