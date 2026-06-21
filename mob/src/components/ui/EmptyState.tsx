import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: 16 }}>
          <Button title={actionLabel} onPress={onAction} variant="brand" />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 32, alignItems: 'center', justifyContent: 'center' },
  icon: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  description: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
