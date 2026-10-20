import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Bell, Copy } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/hooks/useToast';
import {
  getPushStatus,
  getPushTokens,
  registerPushToken,
  requestPushPermission,
  type PushStatus,
} from '@/services/pushNotifications';
import {
  getBackgroundRefreshState,
  type BackgroundRefreshState,
} from '@/services/backgroundNotifications';

const STATUS_TEXT: Record<PushStatus, string> = {
  granted: 'Activées sur cet appareil',
  denied: 'Désactivées — autorisez-les dans les réglages du téléphone',
  undetermined: 'Pas encore activées',
  unsupported: 'Indisponibles sur cet appareil',
};

/**
 * Notifications push dans « Paramètres » (2026-10-10) : état réel de la
 * permission, bouton pour l'activer (ou ouvrir les réglages si elle a été
 * refusée), et copie du jeton de l'appareil pour un envoi de test depuis la
 * console Push d'Apple.
 */
export const NotificationsSettingsCard: React.FC = () => {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [busy, setBusy] = useState(false);
  /** Actualisation en arrière-plan : sans elle, rien n'arrive app fermée sur iPhone. */
  const [background, setBackground] = useState<BackgroundRefreshState | null>(null);

  const refresh = useCallback(async () => {
    const s = await getPushStatus();
    setStatus(s.status);
    setCanAskAgain(s.canAskAgain);
    setBackground(await getBackgroundRefreshState());
  }, []);

  /* Au retour des réglages du téléphone, l'état a pu changer. */
  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const enable = async () => {
    if (status === 'denied' && !canAskAgain) {
      void Linking.openSettings();
      return;
    }
    setBusy(true);
    try {
      const result = await requestPushPermission();
      if (result === 'granted') {
        if (isAuthenticated) await registerPushToken();
        toast.success('Notifications activées', 'Vous serez prévenu de l’avancement de vos commandes.');
      } else if (result === 'denied') {
        void Linking.openSettings();
      }
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  const copyToken = async () => {
    setBusy(true);
    try {
      const { apnsToken, expoToken } = await getPushTokens();
      const token = Platform.OS === 'ios' ? apnsToken : expoToken;
      if (!token) {
        toast.error('Jeton indisponible', 'Réessayez dans un instant, avec une connexion internet.');
        return;
      }
      await Clipboard.setStringAsync(token);
      // Profil base44 remis à jour au passage.
      if (isAuthenticated) void registerPushToken();
      toast.success(
        'Jeton copié',
        Platform.OS === 'ios'
          ? 'Collez-le dans la console Push d’Apple (environnement Production).'
          : 'Jeton Expo de l’appareil copié.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;
  const granted = status === 'granted';

  return (
    <Card padding={16} style={[styles.card, { borderColor: colors.border }]} testID="settings-notifications">
      <View style={styles.row}>
        <View style={[styles.iconRing, { backgroundColor: palette.orange[50] }]}>
          <Bell size={20} color={palette.brand.orange} />
        </View>
        <View style={styles.texts}>
          <Text style={[styles.name, { color: colors.foreground }]}>Notifications</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]} testID="settings-notifications-status">
            {STATUS_TEXT[status]}
          </Text>
          {granted && (background === 'denied' || background === 'restricted') ? (
            <Text
              style={[styles.description, { color: palette.orange[600] }]}
              testID="settings-notifications-background"
            >
              {Platform.OS === 'ios'
                ? 'Activez « Actualisation en arrière-plan » pour AfriGo afin de les recevoir app fermée.'
                : 'Autorisez AfriGo à fonctionner en arrière-plan afin de les recevoir app fermée.'}
            </Text>
          ) : null}
        </View>
      </View>

      {!granted && status !== 'unsupported' ? (
        <Button
          title={status === 'denied' && !canAskAgain ? 'Ouvrir les réglages' : 'Activer les notifications'}
          variant="brand"
          size="sm"
          fullWidth
          loading={busy}
          disabled={busy}
          onPress={() => void enable()}
          style={{ marginTop: 12 }}
          testID="settings-notifications-enable"
        />
      ) : null}

      {granted && background === 'denied' ? (
        <Button
          title="Ouvrir les réglages"
          variant="outline"
          size="sm"
          fullWidth
          onPress={() => void Linking.openSettings()}
          style={{ marginTop: 12 }}
          testID="settings-notifications-background-settings"
        />
      ) : null}

      {granted ? (
        <Button
          title="Copier le jeton de l’appareil"
          variant="ghost"
          size="sm"
          fullWidth
          disabled={busy}
          leftIcon={<Copy size={14} color={colors.mutedForeground} />}
          textStyle={{ color: colors.mutedForeground, fontSize: 13 }}
          onPress={() => void copyToken()}
          style={{ marginTop: 8 }}
          testID="settings-notifications-copy-token"
        />
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 1, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
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
