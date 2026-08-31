import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { MapPin, X } from 'lucide-react-native';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/theme/ThemeProvider';
import {
  useAddressAutocomplete,
  type AutocompleteKind,
} from '@/hooks/useAddressAutocomplete';
import {
  MIN_ADDRESS_QUERY_LENGTH,
  type AddressSuggestion,
} from '@/services/addressAutocomplete';

export interface AddressAutocompleteProps {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  /**
   * Suggestion choisie : l'écran appelant remplit adresse + code postal +
   * ville d'un seul coup.
   */
  onSelectSuggestion: (suggestion: AddressSuggestion) => void;
  placeholder?: string;
  /** `city` cherche des communes (remplit Ville + Code postal). */
  kind?: AutocompleteKind;
  /** Code postal déjà saisi — restreint la recherche d'adresse à la commune. */
  postalCode?: string;
  containerStyle?: ViewStyle;
  onContainerLayout?: (e: LayoutChangeEvent) => void;
  onFocus?: () => void;
  error?: string;
  testID?: string;
}

/**
 * Champ « Adresse » avec suggestions de la Base Adresse Nationale.
 *
 * La liste est rendue **dans le flux** (et non en overlay absolu) : dans un
 * ScrollView, un dropdown positionné en absolu est rogné sur Android et passe
 * sous les champs suivants sur iOS. Le formulaire parent doit conserver
 * `keyboardShouldPersistTaps="always"` pour que le 1er tap sur une suggestion
 * soit pris en compte sans fermer d'abord le clavier.
 *
 * La liste ne dépend **pas** du focus du champ : fermer le clavier (touche
 * Retour, glissement de la liste) fait perdre le focus, mais l'utilisateur
 * veut justement voir les suggestions et en choisir une. Elle ne se replie
 * que sur un choix, sur « Masquer », ou quand un autre champ prend le clavier.
 */
export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  label,
  value,
  onChangeText,
  onSelectSuggestion,
  placeholder,
  kind = 'address',
  postalCode,
  containerStyle,
  onContainerLayout,
  onFocus,
  error,
  testID,
}) => {
  const { colors } = useTheme();
  /** Panneau de suggestions déplié (ouvert à la saisie, replié au choix / Masquer). */
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );

  const { suggestions, loading } = useAddressAutocomplete(value, {
    enabled: open,
    kind,
    postalCode,
  });

  const handleChange = useCallback(
    (next: string) => {
      setOpen(true);
      onChangeText(next);
    },
    [onChangeText],
  );

  const handleSelect = useCallback(
    (suggestion: AddressSuggestion) => {
      setOpen(false);
      onSelectSuggestion(suggestion);
    },
    [onSelectSuggestion],
  );

  const isCity = kind === 'city';
  const helper = isCity
    ? 'Choisissez votre commune : le code postal se remplit tout seul.'
    : 'Commencez à taper : nous complétons le code postal et la ville.';
  const showList = open && value.trim().length >= MIN_ADDRESS_QUERY_LENGTH;
  const showEmpty = showList && !loading && suggestions.length === 0;

  return (
    // `onLayout` sur l'enveloppe (et non sur l'Input) : le formulaire mesure la
    // position du champ par rapport à SON conteneur pour le remonter au-dessus du
    // clavier. Mesuré sur l'Input, l'offset valait 0 (relatif à cette enveloppe)
    // et le champ Adresse restait caché sous le clavier.
    <View style={containerStyle} onLayout={onContainerLayout}>
      <Input
        label={label ?? (isCity ? 'Ville' : 'Adresse')}
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder ?? (isCity ? 'Châlons-en-Champagne' : '12 rue de la République')}
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete={isCity ? 'postal-address-locality' : 'street-address'}
        textContentType={isCity ? 'addressCity' : 'fullStreetAddress'}
        error={error}
        testID={testID}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setFocused(true);
          setOpen(true);
          onFocus?.();
        }}
        /*
          Perte de focus différée : sur certains écrans le champ perd le focus
          au `touchStart` du tap sur une suggestion. On laisse le temps au tap
          d'aboutir, puis on ne replie la liste que si le clavier est resté
          ouvert — c'est-à-dire qu'un AUTRE champ a pris la main. Clavier
          fermé (Retour, glissement) : la liste reste visible pour être choisie.
        */
        onBlur={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          blurTimer.current = setTimeout(() => {
            blurTimer.current = null;
            setFocused(false);
            if (Keyboard.isVisible()) setOpen(false);
          }, 180);
        }}
        helperText={focused && !showList ? helper : undefined}
      />

      {showList ? (
        <View
          style={[
            styles.panel,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          {loading && suggestions.length === 0 ? (
            <View style={styles.row}>
              <ActivityIndicator size="small" color={colors.mutedForeground} />
              <Text style={[styles.rowMuted, { color: colors.mutedForeground }]}>
                {isCity ? 'Recherche de communes…' : 'Recherche d’adresses…'}
              </Text>
            </View>
          ) : null}

          {suggestions.length > 0 ? (
            <View style={[styles.panelHead, { borderBottomColor: colors.border }]}>
              <Text style={[styles.panelHeadText, { color: colors.mutedForeground }]}>
                {isCity ? 'Communes proposées' : 'Adresses proposées'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Masquer les suggestions"
                testID="address-suggestions-close"
                onPress={() => setOpen(false)}
                hitSlop={10}
                style={styles.panelClose}
              >
                <X size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          ) : null}

          {suggestions.map((s, index) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={`Utiliser l’adresse ${s.label}`}
              testID={`address-suggestion-${index}`}
              onPress={() => handleSelect(s)}
              style={({ pressed }) => [
                styles.row,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                pressed && { backgroundColor: colors.muted },
              ]}
            >
              <MapPin size={16} color={colors.brandOrange} />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {isCity ? s.city : s.street || s.city}
                </Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {[s.postalCode, s.city].filter(Boolean).join(' ')}
                  {s.context ? ` · ${s.context}` : ''}
                </Text>
              </View>
            </Pressable>
          ))}

          {showEmpty ? (
            <View style={styles.row}>
              <Text style={[styles.rowMuted, { color: colors.mutedForeground }]}>
                {isCity
                  ? 'Aucune commune trouvée — vous pouvez la saisir manuellement.'
                  : 'Aucune adresse trouvée — vous pouvez la saisir manuellement.'}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    marginTop: -6,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  panelHeadText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  panelClose: { padding: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  rowMuted: { fontSize: 13, flex: 1 },
});
