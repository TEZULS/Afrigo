import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Lock } from 'lucide-react-native';
import { CardEntryForm } from '@/components/payments/CardEntryForm';
import { useTheme } from '@/theme/ThemeProvider';
import {
  formatCardExpiry,
  isCardExpired,
  savedCardTitle,
  type SavedCard,
} from '@/utils/savedCard';

interface Props {
  /** Carte enregistrée sur le profil (même expirée), ou `null`. */
  savedCard: SavedCard | null;
  /** Payer avec la carte enregistrée ; sinon le formulaire est affiché. */
  useSavedCard: boolean;
  onUseSavedCardChange: (useSaved: boolean) => void;
  saveNewCard: boolean;
  onSaveNewCardChange: (save: boolean) => void;
  onNewCardCompleteChange: (complete: boolean) => void;
  /** Paiement en cours : plus aucune saisie (sans toucher au formulaire natif). */
  busy?: boolean;
}

const RadioRow: React.FC<{
  title: string;
  hint?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  testID: string;
}> = ({ title, hint, selected, disabled, onPress, testID }) => {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        { borderColor: selected ? colors.brandOrange : colors.border },
        disabled ? styles.choiceDisabled : null,
      ]}
    >
      <View style={[styles.radio, { borderColor: selected ? colors.brandOrange : colors.border }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: colors.brandOrange }]} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.foreground, fontWeight: '600' }}>{title}</Text>
        {hint ? <Text style={[styles.hint, { color: colors.mutedForeground }]}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
};

/**
 * Carte bancaire, dépliée sous « Carte bancaire » à la validation (demande du
 * 2026-10-27) : le formulaire de carte Stripe s'affiche d'office, les autres
 * moyens de paiement restent en dessous. Carte enregistrée : proposée en
 * premier, « Utiliser une autre carte » affiche le formulaire. La case
 * « Enregistrer ma carte » la garde pour les prochains paiements (une seule
 * carte par client, supprimable dans Paramètres › Paiement).
 */
export const CardPaymentPanel: React.FC<Props> = ({
  savedCard,
  useSavedCard,
  onUseSavedCardChange,
  saveNewCard,
  onSaveNewCardChange,
  onNewCardCompleteChange,
  busy,
}) => {
  const { colors } = useTheme();
  const expired = savedCard != null && isCardExpired(savedCard);
  const showForm = savedCard == null || expired || !useSavedCard;
  const expiry = savedCard ? formatCardExpiry(savedCard) : '';

  return (
    <View style={styles.panel} pointerEvents={busy ? 'none' : 'auto'} testID="checkout-card-panel">
      {savedCard ? (
        <View style={styles.choices}>
          <RadioRow
            testID="checkout-card-saved"
            title={savedCardTitle(savedCard)}
            hint={expired ? 'Carte expirée : utilisez une autre carte' : expiry ? `Expire ${expiry}` : undefined}
            selected={!showForm}
            disabled={expired}
            onPress={() => onUseSavedCardChange(true)}
          />
          <RadioRow
            testID="checkout-card-new"
            title="Utiliser une autre carte"
            selected={showForm}
            onPress={() => onUseSavedCardChange(false)}
          />
        </View>
      ) : null}

      {showForm ? (
        <>
          <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>
            Informations de la carte bancaire
          </Text>
          <CardEntryForm testID="checkout-card-form" onCompleteChange={onNewCardCompleteChange} />
          <Pressable
            testID="checkout-save-card"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: saveNewCard }}
            accessibilityLabel="Enregistrer ma carte pour mes prochains paiements"
            onPress={() => onSaveNewCardChange(!saveNewCard)}
            style={styles.saveRow}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: saveNewCard ? colors.brandOrange : colors.border,
                  backgroundColor: saveNewCard ? colors.brandOrange : 'transparent',
                },
              ]}
            >
              {saveNewCard ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontWeight: '600' }}>
                Enregistrer ma carte pour mes prochains paiements
              </Text>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                {savedCard ? `Elle remplacera votre ${savedCardTitle(savedCard)}. ` : ''}
                Vous pourrez la supprimer à tout moment dans Paramètres › Paiement.
              </Text>
            </View>
          </Pressable>
        </>
      ) : null}

      <View style={styles.secure}>
        <Lock size={12} color={colors.mutedForeground} />
        <Text style={[styles.secureTxt, { color: colors.mutedForeground }]}>
          Vos numéros de carte vont directement à Stripe : AfriGo ne les voit ni ne les stocke.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: { paddingHorizontal: 12, paddingBottom: 12 },
  choices: { gap: 8, marginBottom: 4 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  choiceDisabled: { opacity: 0.6 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  hint: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  formLabel: { fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 8 },
  saveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkmark: { color: '#FFF', fontWeight: '900', fontSize: 14 },
  secure: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  secureTxt: { flex: 1, fontSize: 11, lineHeight: 15 },
});
