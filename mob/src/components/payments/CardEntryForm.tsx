import React, { useEffect, useRef } from 'react';
import { PixelRatio, Platform } from 'react-native';
import { CardForm } from '@stripe/stripe-react-native';
import { useTheme } from '@/theme/ThemeProvider';

/**
 * Hauteur réservée au formulaire natif : React Native ne le mesure pas. Trop
 * bas, il est coupé ; plus haut, la place restante reste vide (jamais étiré).
 * - iOS : numéro, date + CVC, pays, code postal (demandé pour la France) et
 *   la ligne d'erreur ≈ 185 pt (captures de référence de Stripe iOS 25.10) ;
 * - Android : hauteur du modèle de Stripe (320 dp) pour les mêmes champs.
 * Les deux grandissent avec la taille du texte choisie dans les réglages.
 */
const BASE_HEIGHT = Platform.OS === 'ios' ? 196 : 320;

export const cardFormHeight = (fontScale: number = PixelRatio.getFontScale()): number =>
  Math.ceil(BASE_HEIGHT * Math.max(1, fontScale));

interface Props {
  /** Carte complète (numéro, date, CVC, code postal) ou non. */
  onCompleteChange: (complete: boolean) => void;
  testID?: string;
}

/**
 * Saisie de carte Stripe affichée dans la page (2026-10-27), comme la fenêtre
 * de paiement Stripe. Les numéros restent dans le SDK natif : seul « complet »
 * remonte, et `confirmPayment` / `createPaymentMethod` lisent la carte dans
 * le formulaire affiché — il doit rester monté jusque-là.
 *
 * Aucune prop ne doit changer pendant la saisie : sur iOS, le SDK recrée le
 * formulaire (vide) à chaque changement. Pour bloquer la saisie pendant un
 * paiement, passer par `pointerEvents` sur un parent, jamais par `disabled`.
 */
export const CardEntryForm: React.FC<Props> = ({ onCompleteChange, testID }) => {
  const { colors } = useTheme();
  const report = useRef(onCompleteChange);
  report.current = onCompleteChange;
  // Formulaire retiré (autre carte, autre moyen de paiement) : sa saisie est perdue.
  useEffect(() => () => report.current(false), []);

  return (
    <CardForm
      testID={testID}
      style={{ width: '100%', height: cardFormHeight() }}
      onFormComplete={(card) => report.current(card.complete)}
      // Android seulement ; iOS suit la langue et la région de l'appareil.
      defaultValues={{ countryCode: 'FR' }}
      placeholders={{
        number: 'Numéro de carte',
        expiration: 'MM/AA',
        cvc: 'CVC',
        postalCode: 'Code postal',
      }}
      cardStyle={{
        backgroundColor: colors.card,
        textColor: colors.foreground,
        placeholderColor: colors.mutedForeground,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 12,
        cursorColor: colors.brandOrange,
        textErrorColor: colors.destructive,
        fontSize: 16,
      }}
    />
  );
};
