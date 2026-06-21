import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export const Loader: React.FC<{ size?: 'small' | 'large'; fullscreen?: boolean }> = ({
  size = 'large',
  fullscreen = false,
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, fullscreen && styles.fullscreen, { backgroundColor: fullscreen ? colors.background : 'transparent' }]}>
      <ActivityIndicator size={size} color={colors.brandOrange} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  fullscreen: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
