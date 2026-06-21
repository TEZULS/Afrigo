import React, { forwardRef, useState, useImperativeHandle, useRef } from 'react';
import {
  TextInput,
  TextInputProps,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  Platform,
  Pressable,
} from 'react-native';
import { X, Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  /** Affiche un bouton ❌ pour effacer le contenu quand l'input est focus + non vide.
   *  Désactivé par défaut sur les inputs `secureTextEntry` (mots de passe). */
  showClear?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      containerStyle,
      style,
      placeholderTextColor,
      showClear,
      onChangeText,
      onFocus,
      onBlur,
      value,
      secureTextEntry,
      ...rest
    },
    ref,
  ) => {
    const { colors } = useTheme();
    const innerRef = useRef<TextInput>(null);
    useImperativeHandle(ref, () => innerRef.current as TextInput);

    const [focused, setFocused] = useState(false);
    /** Toggle œil pour les champs `secureTextEntry` (mot de passe, etc.). */
    const [revealed, setRevealed] = useState(false);

    /**
     * Bouton croix : visible quand le champ est focus + a du contenu, sauf
     * pour les mots de passe (UX standard). On peut le forcer via
     * `showClear={false}` (cas des inputs read-only / plain).
     */
    const clearEnabled = showClear ?? !secureTextEntry;
    const showClearBtn = clearEnabled && focused && !!value && String(value).length > 0;
    /** Œil affiché uniquement pour les champs secureTextEntry, dès qu'il y
     *  a du contenu (sinon ça encombre inutilement le champ vide). */
    const showRevealBtn = !!secureTextEntry && !!value && String(value).length > 0;

    const handleClear = () => {
      onChangeText?.('');
      // Garder le focus pour que l'utilisateur puisse retaper.
      requestAnimationFrame(() => innerRef.current?.focus());
    };

    return (
      <View style={[styles.wrapper, containerStyle]}>
        {label ? <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text> : null}
        <View
          style={[
            styles.inputRow,
            {
              borderColor: error
                ? colors.destructive
                : focused
                  ? colors.brandOrange
                  : colors.border,
              backgroundColor: colors.surfaceMuted,
            },
          ]}
        >
          {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
          <TextInput
            ref={innerRef}
            style={[
              styles.input,
              { color: colors.foreground, paddingLeft: leftIcon ? 0 : 14 },
              Platform.OS === 'ios' && { paddingVertical: 12 },
              style,
            ]}
            placeholderTextColor={placeholderTextColor ?? colors.mutedForeground}
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={secureTextEntry && !revealed}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            {...rest}
          />
          {showRevealBtn ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={revealed ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              onPress={() => setRevealed((v) => !v)}
              hitSlop={8}
              style={styles.revealBtn}
            >
              {revealed ? (
                <EyeOff size={18} color={colors.mutedForeground} />
              ) : (
                <Eye size={18} color={colors.mutedForeground} />
              )}
            </Pressable>
          ) : null}
          {showClearBtn ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Effacer le champ"
              onPress={handleClear}
              hitSlop={8}
              style={styles.clearBtn}
            >
              <X size={14} color="#FFF" />
            </Pressable>
          ) : null}
          {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
        </View>
        {error ? (
          <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
        ) : helperText ? (
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>{helperText}</Text>
        ) : null}
      </View>
    );
  },
);
Input.displayName = 'Input';

const styles = StyleSheet.create({
  wrapper: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 44,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  iconLeft: { paddingLeft: 12, paddingRight: 6 },
  iconRight: { paddingRight: 12, paddingLeft: 6 },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  revealBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  error: { fontSize: 12, marginTop: 4 },
  helper: { fontSize: 12, marginTop: 4 },
});
