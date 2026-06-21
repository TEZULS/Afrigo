import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Variant = 'default' | 'success' | 'warning' | 'destructive' | 'brand' | 'outline' | 'muted';

interface BadgeProps {
  label: string;
  variant?: Variant;
  style?: ViewStyle;
  textStyle?: TextStyle;
  leftIcon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  style,
  textStyle,
  leftIcon,
}) => {
  const { colors } = useTheme();
  const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
    default: { bg: colors.foreground, fg: colors.background },
    success: { bg: colors.success, fg: '#FFFFFF' },
    warning: { bg: colors.warning, fg: '#0F172A' },
    destructive: { bg: colors.destructive, fg: '#FFFFFF' },
    brand: { bg: colors.brandOrange, fg: '#FFFFFF' },
    outline: { bg: 'transparent', fg: colors.foreground, border: colors.border },
    muted: { bg: colors.muted, fg: colors.mutedForeground },
  };
  const v = palette[variant];
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: v.bg, borderColor: v.border, borderWidth: v.border ? 1 : 0 },
        style,
      ]}
    >
      {leftIcon}
      <Text style={[styles.text, { color: v.fg }, textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '700' },
});
