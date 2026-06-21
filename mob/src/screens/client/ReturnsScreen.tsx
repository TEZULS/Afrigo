import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, Trash2 } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/theme/ThemeProvider';
import { Order, Return, UploadFile } from '@/api/entities';
import { useToast } from '@/hooks/useToast';
import type { RootStackParamList } from '@/navigation/types';

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
}

export const ReturnsScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'Returns'>>();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const toast = useToast();

  const orderQuery = useQuery({
    queryKey: ['order', route.params.orderId],
    queryFn: async () =>
      (await Order().get?.(route.params.orderId)) as { id: string; items?: OrderItem[] } | null,
  });

  const [selected, setSelected] = useState<Record<string, number>>({});
  /**
   * Motif imposé : selon la règle métier, un client ne peut demander un retour
   * que pour « mauvais produit » (wrong_product) ou « date expirée » (expired).
   */
  const [reasonCode, setReasonCode] = useState<'' | 'wrong_product' | 'expired'>('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  const REASON_OPTIONS: { value: 'wrong_product' | 'expired'; label: string }[] = [
    { value: 'wrong_product', label: 'Mauvais produit' },
    { value: 'expired', label: 'Date expirée' },
  ];

  const submit = useMutation({
    mutationFn: async () => {
      const photoUploads = await Promise.all(
        photos.map(async (uri) => {
          // Le SDK Base44 attend un File-like ; en RN on construit un objet
          // compatible (uri/name/type) consommé par axios via FormData.
          const file = { uri, name: 'return.jpg', type: 'image/jpeg' } as unknown as File;
          const upload = (await UploadFile({ file })) as { url?: string };
          return upload.url;
        }),
      );
      if (!reasonCode) throw new Error('Motif requis');
      const created = (await Return().create?.({
        order_id: route.params.orderId,
        items: Object.entries(selected)
          .filter(([, q]) => q > 0)
          .map(([product_id, quantity]) => ({ product_id, quantity })),
        reason: reasonCode,
        description: reasonDetail.trim() || undefined,
        photos: photoUploads.filter(Boolean),
        status: 'pending',
      })) as { id: string };
      return created;
    },
    onSuccess: (created) => {
      toast.success('Demande de retour envoyée');
      nav.replace('ReturnDetails', { id: created.id });
    },
    onError: (e: Error) => toast.error('Erreur', e.message),
  });

  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled) setPhotos((p) => [...p, ...r.assets.map((a) => a.uri)]);
  };

  if (!orderQuery.data) {
    return (
      <Screen>
        <Header onBack={nav.goBack} title="Retour" />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header onBack={nav.goBack} title="Demande de retour" />
      <Text style={[styles.section, { color: colors.foreground }]}>Articles à retourner</Text>
      <Card padding={6}>
        {(orderQuery.data.items ?? []).map((it) => {
          const qty = selected[it.product_id] ?? 0;
          return (
            <View key={it.product_id} style={styles.itemRow}>
              <Text style={{ flex: 1, color: colors.foreground }}>{it.name}</Text>
              <View style={[styles.qtyBox, { backgroundColor: colors.muted }]}>
                <Pressable
                  onPress={() => setSelected((s) => ({ ...s, [it.product_id]: Math.max(0, qty - 1) }))}
                >
                  <Text style={{ paddingHorizontal: 8, color: colors.foreground }}>−</Text>
                </Pressable>
                <Text style={{ minWidth: 24, textAlign: 'center', color: colors.foreground }}>
                  {qty}
                </Text>
                <Pressable
                  onPress={() =>
                    setSelected((s) => ({
                      ...s,
                      [it.product_id]: Math.min(it.quantity, qty + 1),
                    }))
                  }
                >
                  <Text style={{ paddingHorizontal: 8, color: colors.foreground }}>+</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </Card>

      <Text style={[styles.section, { color: colors.foreground }]}>Motif *</Text>
      <View style={styles.reasonRow}>
        {REASON_OPTIONS.map((opt) => {
          const sel = reasonCode === opt.value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
              onPress={() => setReasonCode(opt.value)}
              style={[
                styles.reasonChip,
                {
                  borderColor: sel ? colors.brandOrange : colors.border,
                  backgroundColor: sel ? colors.muted : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  color: sel ? colors.brandOrange : colors.foreground,
                  fontWeight: '700',
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.section, { color: colors.foreground }]}>Description (optionnel)</Text>
      <Input
        multiline
        value={reasonDetail}
        onChangeText={setReasonDetail}
        numberOfLines={3}
        placeholder="Précisez si nécessaire…"
      />

      <Text style={[styles.section, { color: colors.foreground }]}>Photos (preuves)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {photos.map((uri, i) => (
            <View key={i} style={styles.photo}>
              <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 12 }} />
              <Pressable
                onPress={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                style={styles.photoDelete}
              >
                <Trash2 size={14} color="#FFF" />
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={pickPhoto}
            style={[styles.addPhoto, { borderColor: colors.border, backgroundColor: colors.muted }]}
          >
            <Camera size={20} color={colors.foreground} />
          </Pressable>
        </View>
      </ScrollView>

      <Button
        title="Envoyer la demande"
        variant="brand"
        size="lg"
        fullWidth
        loading={submit.isPending}
        disabled={!Object.values(selected).some((q) => q > 0) || !reasonCode}
        onPress={() => submit.mutate()}
        style={{ marginTop: 24 }}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  section: { marginTop: 12, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 10 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 4 },
  photo: { position: 'relative' },
  photoDelete: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 999,
    padding: 4,
  },
  addPhoto: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  reasonChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    flexGrow: 1,
    alignItems: 'center',
  },
});
