import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { ProductRequest } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { useToast } from '@/hooks/useToast';
import { formatDateTime } from '@/utils/format';
import type { RootStackParamList } from '@/navigation/types';

interface RequestRow {
  id: string;
  product_name: string;
  description?: string;
  status?: string;
  created_date?: string;
}

export const ProductRequestsScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const query = useQuery<RequestRow[]>({
    queryKey: ['product-requests', user?.email],
    enabled: Boolean(user?.email),
    queryFn: async () =>
      ((await ProductRequest().filter?.({ customer_email: user!.email })) ?? []) as RequestRow[],
  });

  const create = useMutation({
    mutationFn: async () => {
      await ProductRequest().create?.({
        customer_email: user!.email,
        customer_name: (user?.full_name as string | undefined)?.trim() || user!.email,
        product_name: name.trim(),
        description: desc.trim(),
        quantity: 1,
        status: 'pending',
      });
    },
    onSuccess: () => {
      setName('');
      setDesc('');
      toast.success('Demande envoyée');
      qc.invalidateQueries({ queryKey: ['product-requests', user?.email] });
    },
  });

  return (
    <Screen scroll>
      <Header onBack={nav.goBack} title="Demandes de produits" />
      <Card padding={14}>
        <Input label="Produit recherché" value={name} onChangeText={setName} />
        <Input label="Description (optionnelle)" multiline numberOfLines={3} value={desc} onChangeText={setDesc} />
        <Button
          title="Envoyer la demande"
          variant="brand"
          fullWidth
          loading={create.isPending}
          disabled={!name.trim()}
          leftIcon={<Plus size={16} color="#FFF" />}
          onPress={() => create.mutate()}
        />
      </Card>

      <Text style={[styles.section, { color: colors.foreground }]}>Mes demandes</Text>
      {query.isLoading ? (
        <Loader />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState title="Aucune demande" />
      ) : (
        <FlatList
          scrollEnabled={false}
          data={query.data}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ gap: 8 }}
          renderItem={({ item }) => (
            <Card padding={14}>
              <View style={styles.row}>
                <Text style={{ flex: 1, color: colors.foreground, fontWeight: '700' }}>
                  {item.product_name}
                </Text>
                <Badge label={item.status ?? 'pending'} variant="warning" />
              </View>
              {item.description ? (
                <Text style={{ color: colors.mutedForeground, marginTop: 4 }}>{item.description}</Text>
              ) : null}
              {item.created_date ? (
                <Text style={[styles.date, { color: colors.mutedForeground }]}>
                  {formatDateTime(item.created_date)}
                </Text>
              ) : null}
            </Card>
          )}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { fontSize: 14, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  date: { fontSize: 11, marginTop: 6 },
});
