import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
  PressableProps,
} from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'brand';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  title?: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading,
  leftIcon,
  rightIcon,
  fullWidth,
  disabled,
  style,
  textStyle,
  children,
  ...rest
}) => {
  const { colors } = useTheme();

  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.primaryForeground },
    secondary: { bg: colors.secondary, fg: colors.secondaryForeground },
    outline: { bg: 'transparent', fg: colors.foreground, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.foreground },
    destructive: { bg: colors.destructive, fg: colors.destructiveForeground },
    brand: { bg: colors.brandOrange, fg: '#FFFFFF' },
  };

  const sizing: Record<Size, { h: number; px: number; fs: number; gap: number }> = {
    sm: { h: 36, px: 12, fs: 13, gap: 6 },
    md: { h: 44, px: 16, fs: 15, gap: 8 },
    lg: { h: 52, px: 20, fs: 16, gap: 10 },
    icon: { h: 40, px: 0, fs: 14, gap: 0 },
  };

  const v = palette[variant];
  const s = sizing[size];

  /**
   * On évite le `style={({pressed}) => ...}` : le `cssInterop` de NativeWind
   * (JSX compilé avec `jsxImportSource: 'nativewind'`) remplace un style
   * fonction par `{}`, ce qui rendait certains boutons (primary, brand,
   * destructive) invisibles bien que cliquables — cf. `@/components/ui/Pressable`.
   * On utilise un style statique + `android_ripple` pour le feedback.
   */
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      android_ripple={
        v.bg === 'transparent'
          ? { color: 'rgba(0,0,0,0.08)' }
          : { color: 'rgba(255,255,255,0.18)' }
      }
      style={[
        styles.base,
        {
          height: s.h,
          paddingHorizontal: size === 'icon' ? 0 : s.px,
          width: size === 'icon' ? s.h : fullWidth ? '100%' : undefined,
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: v.border ? 1 : 0,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={[styles.row, { gap: s.gap }]}>
          {leftIcon}
          {title ? (
            <Text style={[styles.text, { color: v.fg, fontSize: s.fs }, textStyle]} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {children}
          {rightIcon}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
});
