import React, { useMemo } from 'react';
import { FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Loader } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductCard, ProductDTO } from '@/components/products/ProductCard';
import { Order, Product } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';
import { remoteDecrementAfterRemove, remoteUpsertAfterAdd } from '@/lib/cartRemote';
import { useCart } from '@/stores/cart';
import type { RootStackParamList } from '@/navigation/types';

export const HabitualProductsScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const cart = useCart();

  /**
   * Reproduit la logique web : on agrège les produits les plus fréquents
   * dans les commandes du client, puis on affiche la fiche produit complète.
   */
  const ordersQuery = useQuery({
    queryKey: ['my-orders', user?.email],
    enabled: Boolean(user?.email),
    queryFn: async () =>
      ((await Order().filter?.({ customer_email: user!.email })) ?? []) as {
        items?: { product_id?: string; name?: string; quantity: number }[];
      }[],
  });

  const topIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of ordersQuery.data ?? []) {
      for (const it of o.items ?? []) {
        const pid = it.product_id;
        if (!pid) continue;
        counts.set(pid, (counts.get(pid) ?? 0) + it.quantity);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([id]) => id);
  }, [ordersQuery.data]);

  const productsQuery = useQuery({
    queryKey: ['habitual-products', topIds],
    enabled: topIds.length > 0,
    queryFn: async () => {
      const all = ((await Product().list?.()) ?? []) as ProductDTO[];
      return all.filter((p) => topIds.includes(p.id));
    },
  });

  const cartQty = (id: string) => cart.lines.find((l) => l.productId === id)?.quantity ?? 0;
  const customerEmail = user?.email;
  const data = productsQuery.data ?? [];

  return (
    <Screen scroll={false} paddingHorizontal={0}>
      <Header onBack={nav.goBack} title="Mes habitudes" />
      {ordersQuery.isLoading || productsQuery.isLoading ? (
        <Loader />
      ) : data.length === 0 ? (
        <EmptyState title="Pas encore d'habitudes" description="Vos achats récurrents apparaîtront ici." />
      ) : (
        <FlatList
          data={data}
          numColumns={2}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 12, gap: 12 }}
          columnWrapperStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              cartQuantity={cartQty(item.id)}
              onAddToCart={(p) => {
                const line = {
                  productId: p.id,
                  name: p.name,
                  imageUrl: p.image_url,
                  unitPrice:
                    p.is_promotion && p.promotion_price != null ? p.promotion_price : p.price,
                  category: p.category,
                  unit: p.unit,
                };
                cart.add(line);
                if (customerEmail) void remoteUpsertAfterAdd(customerEmail, { ...line, quantity: 1 });
              }}
              onRemoveFromCart={(p) => {
                cart.remove(p.id);
                if (customerEmail) void remoteDecrementAfterRemove(customerEmail, p.id);
              }}
            />
          )}
        />
      )}
    </Screen>
  );
};
