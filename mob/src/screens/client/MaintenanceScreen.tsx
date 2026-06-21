import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Wrench } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/lib/AuthContext';

export const MaintenanceScreen: React.FC<{ message?: string }> = ({ message }) => {
  const { colors } = useTheme();
  const { refresh } = useAuth();
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.container}>
        <Wrench size={64} color={colors.brandOrange} />
        <Text style={[styles.title, { color: colors.foreground }]}>AfriGo est en maintenance</Text>
        <Text style={[styles.message, { color: colors.mutedForeground }]}>
          {message ?? 'Nous reviendrons très bientôt. Merci de votre patience.'}
        </Text>
        <Button title="Réessayer" variant="brand" size="lg" onPress={refresh} style={{ marginTop: 24 }} />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 22, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  message: { fontSize: 14, marginTop: 8, lineHeight: 22, textAlign: 'center' },
});
