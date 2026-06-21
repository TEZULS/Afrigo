import React from 'react';
import { View, Text, StyleSheet, Linking, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Phone, Navigation as NavigationIcon, CheckCircle2, XCircle } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { Order, invokeFunction } from '@/api/entities';
import { useTheme } from '@/theme/ThemeProvider';
import { useToast } from '@/hooks/useToast';
import { formatPrice } from '@/utils/format';
import type { DelivererStackParamList } from '@/navigation/types';

interface OrderFull {
  id: string;
  status?: string;
  total: number;
  delivery?: { address?: string; phone?: string; lat?: number; lng?: number };
  items?: { name: string; quantity: number; unit_price: number }[];
}

export const DelivererOrderDetailsScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<DelivererStackParamList>>();
  const route = useRoute<RouteProp<DelivererStackParamList, 'DelivererOrderDetails'>>();
  const { colors } = useTheme();
  const toast = useToast();
  const qc = useQueryClient();

  const query = useQuery<OrderFull | null>({
    queryKey: ['order', route.params.id],
    queryFn: async () => ((await Order().get?.(route.params.id)) ?? null) as OrderFull | null,
  });

  const updateStatus = useMutation({
    mutationFn: async (status: 'delivered' | 'not_delivered') => {
      await Order().update?.(route.params.id, { status });
      if (status === 'delivered') {
        await invokeFunction('addLoyaltyPointsOnDelivery', { order_id: route.params.id }).catch(() => {});
      } else {
        await invokeFunction('sendNotDeliveredNotification', { order_id: route.params.id }).catch(() => {});
      }
    },
    onSuccess: () => {
      toast.success('Statut mis à jour');
      qc.invalidateQueries({ queryKey: ['order', route.params.id] });
      qc.invalidateQueries({ queryKey: ['deliverer-orders'] });
      nav.goBack();
    },
  });

  if (!query.data) {
    return (
      <Screen>
        <Header onBack={nav.goBack} title="Livraison" />
        <Loader />
      </Screen>
    );
  }
  const order = query.data;
  const lat = order.delivery?.lat ?? 48.8566;
  const lng = order.delivery?.lng ?? 2.3522;

  const callClient = () => {
    if (order.delivery?.phone) Linking.openURL(`tel:${order.delivery.phone}`);
  };

  const openNavigation = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url).catch(() => {});
  };

  const confirmNotDelivered = () =>
    Alert.alert(
      'Marquer comme non livrée',
      'Cette action notifiera le client et l\'administrateur. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', style: 'destructive', onPress: () => updateStatus.mutate('not_delivered') },
      ],
    );

  return (
    <Screen scroll>
      <Header onBack={nav.goBack} title={`#${order.id.slice(-6).toUpperCase()}`} />

      <Card padding={0} style={{ overflow: 'hidden' }}>
        <MapView
          style={{ height: 220 }}
          initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        >
          <Marker coordinate={{ latitude: lat, longitude: lng }} />
        </MapView>
      </Card>

      <Card padding={14} style={{ marginTop: 12 }}>
        <Text style={{ fontWeight: '700', color: colors.foreground }}>Adresse</Text>
        <Text style={{ color: colors.foreground, marginTop: 4 }}>{order.delivery?.address ?? '—'}</Text>
        <Text style={{ color: colors.mutedForeground, marginTop: 4 }}>
          Tél : {order.delivery?.phone ?? '—'}
        </Text>
      </Card>

      <Card padding={14} style={{ marginTop: 12 }}>
        <Text style={{ fontWeight: '700', color: colors.foreground }}>Articles</Text>
        {(order.items ?? []).map((it, i) => (
          <View key={i} style={styles.row}>
            <Text style={{ color: colors.foreground }}>
              {it.quantity}× {it.name}
            </Text>
            <Text style={{ color: colors.foreground }}>{formatPrice(it.unit_price * it.quantity)}</Text>
          </View>
        ))}
        <View style={[styles.row, { marginTop: 8 }]}>
          <Text style={{ fontWeight: '800', color: colors.foreground }}>Total à encaisser</Text>
          <Text style={{ fontWeight: '800', color: colors.foreground }}>
            {formatPrice(order.total)}
          </Text>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        <Button
          title="Appeler"
          variant="outline"
          fullWidth
          leftIcon={<Phone size={16} color={colors.foreground} />}
          onPress={callClient}
          style={{ flex: 1 }}
        />
        <Button
          title="Itinéraire"
          variant="outline"
          fullWidth
          leftIcon={<NavigationIcon size={16} color={colors.foreground} />}
          onPress={openNavigation}
          style={{ flex: 1 }}
        />
      </View>

      <Button
        title="Marquer comme livrée"
        variant="brand"
        size="lg"
        fullWidth
        loading={updateStatus.isPending}
        leftIcon={<CheckCircle2 size={18} color="#FFF" />}
        onPress={() => updateStatus.mutate('delivered')}
        style={{ marginTop: 16 }}
      />
      <Button
        title="Non livrée"
        variant="ghost"
        fullWidth
        leftIcon={<XCircle size={16} color={colors.destructive} />}
        textStyle={{ color: colors.destructive }}
        onPress={confirmNotDelivered}
        style={{ marginTop: 8 }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
});
