import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Sparkles, X } from 'lucide-react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Button } from '@/components/ui/Button';
import { WelcomeMessage } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { hydrateKvFromDisk, kv } from '@/services/storage';
import {
  selectWelcomeMessage,
  todayKey,
  welcomeButtonLabel,
  WELCOME_DAILY_KEY,
  WELCOME_DISMISSED_KEY,
  type WelcomeMessageRow,
} from '@/utils/welcomeMessage';
import type { RootStackParamList } from '@/navigation/types';

/** Messages déjà montrés pendant cette ouverture de l'app (`every_login`). */
const shownThisSession = new Set<string>();

/**
 * Message de bienvenue configuré par l'admin (`WelcomeMessage`), affiché à
 * l'accueil comme sur le site : titre, texte, un bouton dont le libellé dépend
 * du profil (invité → « S'inscrire/Se connecter », qui ouvre la connexion).
 */
export const WelcomeMessageDialog: React.FC = () => {
  const { colors } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isLoadingAuth } = useAuth();
  const email = user?.email ?? null;
  const [hydrated, setHydrated] = useState(false);
  const [dismissedNow, setDismissedNow] = useState<string | null>(null);

  useEffect(() => {
    void hydrateKvFromDisk().finally(() => setHydrated(true));
  }, []);

  const query = useQuery<WelcomeMessageRow[]>({
    queryKey: ['welcomeMessages'],
    enabled: hydrated && !isLoadingAuth,
    staleTime: 60_000,
    queryFn: async () => ((await WelcomeMessage().list?.()) ?? []) as WelcomeMessageRow[],
  });

  const message = useMemo(() => {
    if (!hydrated || isLoadingAuth || !query.data) return null;
    const m = selectWelcomeMessage(query.data, email, {
      dismissedIds: kv.get<string[]>(WELCOME_DISMISSED_KEY) ?? [],
      daily: kv.get<Record<string, string>>(WELCOME_DAILY_KEY) ?? {},
      shownThisSession: [...shownThisSession],
    });
    return m && m.id !== dismissedNow ? m : null;
  }, [hydrated, isLoadingAuth, query.data, email, dismissedNow]);

  if (!message) return null;

  const dismiss = () => {
    const frequency = message.display_frequency || 'once';
    if (frequency === 'once') {
      const ids = kv.get<string[]>(WELCOME_DISMISSED_KEY) ?? [];
      if (!ids.includes(message.id)) kv.set(WELCOME_DISMISSED_KEY, [...ids, message.id]);
    } else if (frequency === 'daily') {
      kv.set(WELCOME_DAILY_KEY, {
        ...(kv.get<Record<string, string>>(WELCOME_DAILY_KEY) ?? {}),
        [message.id]: todayKey(),
      });
    }
    shownThisSession.add(message.id);
    setDismissedNow(message.id);
  };

  const onPrimary = () => {
    dismiss();
    if (!email) nav.navigate('Login', { initialMode: 'login' });
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Fermer" style={StyleSheet.absoluteFill} onPress={dismiss} />
        <View style={[styles.card, { backgroundColor: colors.background }]} testID="welcome-message">
          <View style={styles.head}>
            <View style={[styles.headIcon, { backgroundColor: palette.orange[100] }]}>
              <Sparkles size={20} color={palette.brand.orange} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {message.title?.trim() || 'Bienvenue'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              onPress={dismiss}
              hitSlop={10}
              style={styles.closeBtn}
              testID="welcome-close"
            >
              <X size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={[styles.body, { color: colors.foreground }]}>{message.message?.trim()}</Text>
          </ScrollView>
          <Button
            title={welcomeButtonLabel(message, email)}
            variant="primary"
            size="lg"
            fullWidth
            onPress={onPrimary}
            style={{ backgroundColor: palette.emerald[500], borderRadius: 14 }}
            testID="welcome-primary"
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: { borderRadius: 20, padding: 18, maxHeight: '75%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 18, fontWeight: '800', lineHeight: 24 },
  closeBtn: { padding: 4 },
  scroll: { flexGrow: 0, marginVertical: 14 },
  scrollContent: { paddingBottom: 4 },
  body: { fontSize: 15, lineHeight: 23 },
});
