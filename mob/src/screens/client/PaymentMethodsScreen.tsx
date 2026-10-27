import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CreditCard, Plus, ArrowLeft, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardEntryForm } from '@/components/payments/CardEntryForm';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/hooks/useToast';
import { deleteSavedCard, saveCardFromForm } from '@/services/savedCardActions';
import {
  cardholderNameOf,
  formatCardExpiry,
  isCardExpired,
  savedCardOf,
  savedCardTitle,
} from '@/utils/savedCard';
import {
  PersistentBottomNav,
} from '@/components/PersistentBottomNav';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Écran « Moyens de paiement » (Paramètres › Paiement), comme la page web :
 * carte enregistrée, suppression, ajout ou remplacement d'une carte avec le
 * formulaire Stripe. Une seule carte par client (fonctions cloud `saveCard` /
 * `deleteCard`, voir `services/savedCardActions.ts`).
 */
export const PaymentMethodsScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const savedCard = savedCardOf(user);
  const expired = savedCard != null && isCardExpired(savedCard);
  const expiry = savedCard ? formatCardExpiry(savedCard) : '';

  const [adding, setAdding] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = () => {
    if (!savedCard) return;
    Alert.alert(
      'Supprimer ma carte',
      `Votre ${savedCardTitle(savedCard)} ne vous sera plus proposée au paiement.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const result = await deleteSavedCard();
            if (result.ok) {
              await refreshUser();
              toast.success('Carte supprimée');
            } else {
              toast.error('Suppression impossible', result.message);
            }
            setDeleting(false);
          },
        },
      ],
    );
  };

  const saveCard = async () => {
    if (!user?.email || !cardComplete) return;
    setSaving(true);
    const result = await saveCardFromForm({
      customer: { email: user.email, name: cardholderNameOf(user) },
      replacesSavedCard: savedCard != null,
    });
    if (result.ok) {
      await refreshUser();
      setAdding(false);
      toast.success('Carte enregistrée', 'Elle vous sera proposée lors de votre prochain paiement.');
    } else {
      toast.error('Carte non enregistrée', result.message);
    }
    setSaving(false);
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
        {savedCard ? (
          <View
            style={[styles.savedRow, { backgroundColor: palette.emerald[50], borderColor: palette.emerald[200] }]}
            testID="payment-methods-saved-card"
          >
            <View style={[styles.savedIcon, { backgroundColor: colors.card }]}>
              <CreditCard size={22} color={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.savedTitle, { color: colors.foreground }]}>{savedCardTitle(savedCard)}</Text>
              {expiry ? (
                <Text style={[styles.savedHint, { color: expired ? palette.red[700] : colors.mutedForeground }]}>
                  {expired ? `Expirée depuis ${expiry}` : `Expire ${expiry}`}
                </Text>
              ) : null}
            </View>
            <Button
              title="Supprimer"
              variant="ghost"
              size="sm"
              loading={deleting}
              leftIcon={<Trash2 size={14} color={palette.red[600]} />}
              textStyle={{ color: palette.red[600] }}
              onPress={confirmDelete}
              testID="payment-methods-delete"
            />
          </View>
        ) : (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { borderColor: colors.border }]}>
              <CreditCard size={28} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Aucune carte enregistrée
            </Text>
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Ajoutez une carte ci-dessous, ou cochez « Enregistrer ma carte » lors de votre prochain
              paiement par carte.
            </Text>
          </View>
        )}
      </Card>

      <Card padding={16} style={[styles.card, styles.addCard, { borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Plus size={18} color={colors.foreground} />
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            {savedCard ? 'Utiliser une autre carte' : 'Ajouter une carte'}
          </Text>
          {adding ? null : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setAdding(true)}
              android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
              style={[styles.addBtn, { backgroundColor: palette.emerald[400] }]}
              testID="payment-methods-add"
            >
              <Plus size={14} color="#FFF" strokeWidth={2.5} />
              <Text style={styles.addBtnTxt}>{savedCard ? 'Changer de carte' : 'Ajouter'}</Text>
            </Pressable>
          )}
        </View>
        {adding ? (
          <View style={{ marginTop: 12 }} pointerEvents={saving ? 'none' : 'auto'}>
            <CardEntryForm testID="payment-methods-card-form" onCompleteChange={setCardComplete} />
            {savedCard ? (
              <Text style={[styles.addHint, { color: colors.mutedForeground, marginTop: 0 }]}>
                Elle remplacera votre {savedCardTitle(savedCard)}.
              </Text>
            ) : null}
            <View style={styles.formActions}>
              <Button
                title="Enregistrer cette carte"
                variant="primary"
                size="md"
                loading={saving}
                disabled={!cardComplete}
                onPress={() => void saveCard()}
                testID="payment-methods-save"
                style={{ flex: 1 }}
              />
              <Button
                title="Annuler"
                variant="outline"
                size="md"
                onPress={() => setAdding(false)}
                testID="payment-methods-cancel"
              />
            </View>
          </View>
        ) : (
          <Text style={[styles.addHint, { color: colors.mutedForeground }]}>
            {savedCard
              ? 'Remplacez votre carte enregistrée par une nouvelle carte.'
              : 'Enregistrez une carte pour payer plus vite vos prochaines commandes.'}
          </Text>
        )}
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

  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  savedIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedTitle: { fontSize: 15, fontWeight: '700' },
  savedHint: { fontSize: 12, marginTop: 2 },

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
  formActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
});
