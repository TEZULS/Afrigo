import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CreditCard, RotateCcw, Banknote } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/lib/AuthContext';
import { palette } from '@/theme/tokens';
import {
  PersistentBottomNav,
} from '@/components/PersistentBottomNav';
import type { RootStackParamList } from '@/navigation/types';
import type { IconComponent } from '@/types/icon';

interface SettingsEntry {
  name: string;
  description: string;
  Icon: IconComponent;
  route: 'PaymentMethods' | 'MyReturns' | 'MyRefunds';
}

/**
 * Regroupe les entrées qui encombraient le menu latéral. Mêmes libellés,
 * descriptions et ordre que la page « Paramètres » du web.
 */
const ENTRIES: SettingsEntry[] = [
  {
    name: 'Paiement',
    description: 'Gérer vos moyens de paiement',
    Icon: CreditCard,
    route: 'PaymentMethods',
  },
  {
    name: 'Mes retours',
    description: 'Suivre et effectuer des retours',
    Icon: RotateCcw,
    route: 'MyReturns',
  },
  {
    name: 'Mes remboursements',
    description: 'Consulter vos remboursements',
    Icon: Banknote,
    route: 'MyRefunds',
  },
];

export const SettingsScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();

  /* Ces trois écrans exigent un compte : on renvoie vers la connexion sinon. */
  const open = (route: SettingsEntry['route']) => {
    if (!isAuthenticated) {
      nav.navigate('Login', { initialMode: 'login' });
      return;
    }
    nav.navigate(route);
  };

  return (
    <Screen scroll contentStyle={{ paddingBottom: 24 }} bottomBar={<PersistentBottomNav />}>
      <Header title="Paramètres" />
      <View style={styles.list}>
        {ENTRIES.map((entry) => {
          const RowIcon = entry.Icon;
          return (
            <Pressable
              key={entry.route}
              accessibilityRole="button"
              accessibilityLabel={`${entry.name} — ${entry.description}`}
              onPress={() => open(entry.route)}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            >
              <Card padding={16} style={[styles.row, { borderColor: colors.border }]}>
                <View style={[styles.iconRing, { backgroundColor: palette.orange[50] }]}>
                  <RowIcon size={20} color={palette.brand.orange} />
                </View>
                <View style={styles.texts}>
                  <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                    {entry.name}
                  </Text>
                  <Text
                    style={[styles.description, { color: colors.mutedForeground }]}
                    numberOfLines={2}
                  >
                    {entry.description}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  list: { gap: 12, paddingTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
  },
  iconRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  texts: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '700' },
  description: { fontSize: 13 },
});
