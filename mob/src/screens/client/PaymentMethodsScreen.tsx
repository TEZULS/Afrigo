import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CreditCard, Plus, ArrowLeft } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import {
  PersistentBottomNav,
  PERSISTENT_NAV_HEIGHT,
} from '@/components/PersistentBottomNav';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Écran « Moyens de paiement » accessible via le menu latéral. Reproduit la
 * page web : carte enregistrée + ajout d'une nouvelle carte. La gestion des
 * cartes Stripe se fait via les fonctions cloud `saveCard` / `deleteCard`.
 */
export const PaymentMethodsScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();

  const onAddCard = () => {
    /* TODO : intégration `saveCard` via PaymentSheet « setup intent ». */
    Alert.alert(
      'Carte bancaire',
      'L\'enregistrement de la carte se fera à la prochaine commande en cochant « Enregistrer cette carte ».',
    );
  };

  return (
    <Screen
      scroll
      paddingHorizontal={16}
      contentStyle={{ paddingBottom: 24 }}
      bottomBar={<PersistentBottomNav />}
    >
      <Header title="Moyens de paiement" />

      <Pressable
        accessibilityRole="link"
        onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate('ClientTabs', { screen: 'HomeTab' }))}
        style={styles.backRow}
        hitSlop={6}
      >
        <ArrowLeft size={18} color={colors.foreground} />
        <Text style={[styles.backTxt, { color: colors.foreground }]}>Retour</Text>
      </Pressable>

      <View style={styles.heroWrap}>
        <View style={[styles.heroIcon, { backgroundColor: palette.emerald[100] }]}>
          <CreditCard size={26} color={palette.emerald[700]} />
        </View>
        <Text style={[styles.heroTitle, { color: colors.foreground }]}>
          Moyens de paiement
        </Text>
        <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
          Gérez votre carte bancaire enregistrée
        </Text>
      </View>

      <Card padding={16} style={[styles.card, { borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <CreditCard size={18} color={colors.foreground} />
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Ma carte enregistrée
          </Text>
        </View>
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { borderColor: colors.border }]}>
            <CreditCard size={28} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Aucune carte enregistrée
          </Text>
          <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
            Enregistrez une carte ci-dessous ou cochez l&apos;option lors de votre prochaine commande.
          </Text>
        </View>
      </Card>

      <Card padding={16} style={[styles.card, styles.addCard, { borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Plus size={18} color={colors.foreground} />
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Ajouter une carte
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onAddCard}
            android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
            style={[styles.addBtn, { backgroundColor: palette.emerald[400] }]}
          >
            <Plus size={14} color="#FFF" strokeWidth={2.5} />
            <Text style={styles.addBtnTxt}>Ajouter</Text>
          </Pressable>
        </View>
        <Text style={[styles.addHint, { color: colors.mutedForeground }]}>
          Cliquez sur «&nbsp;Ajouter&nbsp;» pour enregistrer une carte bancaire.
        </Text>
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  backTxt: { fontSize: 14, fontWeight: '600' },
  heroWrap: { alignItems: 'center', paddingVertical: 16, gap: 10 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '800' },
  heroSubtitle: { fontSize: 14, textAlign: 'center' },

  card: { borderWidth: 1, marginTop: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '800', flex: 1 },

  emptyWrap: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyIcon: {
    width: 56,
    height: 38,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 14, fontWeight: '700' },
  emptyHint: { fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 8 },

  addCard: { marginTop: 12 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addBtnTxt: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  addHint: { fontSize: 12, marginTop: 10, textAlign: 'center' },
});
