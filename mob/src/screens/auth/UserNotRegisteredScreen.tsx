import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { UserX } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/lib/AuthContext';

export const UserNotRegisteredScreen: React.FC = () => {
  const { colors } = useTheme();
  const { logout, refresh } = useAuth();
  return (
    <Screen>
      <View style={styles.container}>
        <UserX size={64} color={colors.destructive} />
        <Text style={[styles.title, { color: colors.foreground }]}>Compte non enregistré</Text>
        <Text style={[styles.message, { color: colors.mutedForeground }]}>
          Votre compte n'a pas accès à AfriGo. Si c'est une erreur, veuillez contacter le service
          client ou vous reconnecter avec un autre compte.
        </Text>
        <Button title="Réessayer" variant="brand" onPress={refresh} fullWidth style={{ marginTop: 24 }} />
        <Button title="Se déconnecter" variant="ghost" onPress={logout} fullWidth style={{ marginTop: 8 }} />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 22, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  message: { fontSize: 14, marginTop: 8, lineHeight: 22, textAlign: 'center' },
});
