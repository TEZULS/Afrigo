import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/theme/ThemeProvider';
import { Return } from '@/api/entities';
import { formatDateTime } from '@/utils/format';
import type { RootStackParamList } from '@/navigation/types';

interface ReturnFull {
  id: string;
  status?: string;
  reason?: string;
  photos?: string[];
  items?: { product_id: string; quantity: number; name?: string }[];
  created_date?: string;
  refund_amount?: number;
}

export const ReturnDetailsScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'ReturnDetails'>>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();

  const query = useQuery<ReturnFull | null>({
    queryKey: ['return', route.params.id],
    queryFn: async () => ((await Return().get?.(route.params.id)) ?? null) as ReturnFull | null,
  });

  if (query.isLoading || !query.data) {
    return (
      <Screen>
        <Header onBack={nav.goBack} title="Retour" />
        <Loader />
      </Screen>
    );
  }

  const r = query.data;

  return (
    <Screen scroll>
      <Header onBack={nav.goBack} title={`Retour #${r.id.slice(-6).toUpperCase()}`} />
      <Card padding={14}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
            {r.created_date ? formatDateTime(r.created_date) : ''}
          </Text>
          <Badge label={r.status ?? 'pending'} variant="warning" />
        </View>
        <Text style={[styles.section, { color: colors.foreground }]}>Motif</Text>
        <Text style={{ color: colors.foreground, marginTop: 4, lineHeight: 22 }}>{r.reason}</Text>

        <Text style={[styles.section, { color: colors.foreground }]}>Articles</Text>
        {(r.items ?? []).map((it, i) => (
          <Text key={i} style={{ color: colors.foreground, marginTop: 4 }}>
            {it.quantity}× {it.name ?? it.product_id}
          </Text>
        ))}

        {(r.photos ?? []).length > 0 ? (
          <>
            <Text style={[styles.section, { color: colors.foreground }]}>Photos</Text>
            <ScrollView horizontal contentContainerStyle={{ gap: 8, marginTop: 8 }}>
              {(r.photos ?? []).map((url, i) => (
                <Image
                  key={i}
                  source={{ uri: url }}
                  style={{ width: 80, height: 80, borderRadius: 12 }}
                  contentFit="cover"
                />
              ))}
            </ScrollView>
          </>
        ) : null}
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '700', marginTop: 12 },
});
