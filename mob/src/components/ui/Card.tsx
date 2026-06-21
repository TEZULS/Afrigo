import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

interface CardProps extends ViewProps {
  elevated?: boolean;
  padding?: number;
}

export const Card: React.FC<CardProps> = ({
  style,
  children,
  elevated = false,
  padding,
  ...rest
}) => {
  const { colors, shadow } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          padding,
        },
        elevated && shadow.md,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
  },
});
