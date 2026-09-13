import React from 'react';
import { View, Text, StyleSheet, Linking, Alert, Platform } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Headphones, Phone, Mail, MessageCircle, ArrowLeft, ChevronRight } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/theme/ThemeProvider';
import { useAppSettings } from '@/hooks/useAppSettings';
import { palette } from '@/theme/tokens';
import {
  PersistentBottomNav,
  PERSISTENT_NAV_HEIGHT,
} from '@/components/PersistentBottomNav';
import type { RootStackParamList } from '@/navigation/types';
import type { IconComponent } from '@/types/icon';

interface ContactCardProps {
  Icon: IconComponent;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  hint: string;
  onPress: () => void;
}

const ContactCard: React.FC<ContactCardProps> = ({
  Icon,
  iconBg,
  iconColor,
  label,
  value,
  hint,
  onPress,
}) => {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value}`}
      onPress={onPress}
      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
      style={({ pressed }) => [
        styles.cardPressable,
        Platform.OS === 'ios' && pressed && { opacity: 0.7 },
      ]}
    >
      <Card padding={14} style={[styles.card, { borderColor: colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Icon size={22} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>{label}</Text>
          <Text style={[styles.cardValue, { color: colors.foreground }]} numberOfLines={1}>
            {value}
          </Text>
          <Text style={[styles.cardHint, { color: colors.mutedForeground }]} numberOfLines={1}>
            {hint}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.mutedForeground} />
      </Card>
    </Pressable>
  );
};

export const ContactScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const settings = useAppSettings();

  const supportPhone = settings.data?.support_phone ?? '';
  const supportEmail = settings.data?.support_email ?? '';

  const callSupport = async () => {
    const number = supportPhone.replace(/\s/g, '');
    if (!number) {
      Alert.alert('Indisponible', 'Aucun numéro de service client configuré.');
      return;
    }
    const url = `tel:${number}`;
    const ok = await Linking.canOpenURL(url);
    if (ok) Linking.openURL(url);
    else Alert.alert('Erreur', "Impossible d'ouvrir l'application téléphone.");
  };

  const emailSupport = async () => {
    if (!supportEmail) {
      Alert.alert('Indisponible', 'Aucun email de service client configuré.');
      return;
    }
    const url = `mailto:${supportEmail}`;
    const ok = await Linking.canOpenURL(url);
    if (ok) Linking.openURL(url);
    else Alert.alert('Erreur', "Impossible d'ouvrir votre client mail.");
  };

  return (
    <Screen
      scroll
      contentStyle={{ paddingBottom: 24 }}
      bottomBar={<PersistentBottomNav />}
    >
      <Header title="Nous contacter" hideBrand={false} />

      <Pressable
        accessibilityRole="link"
        onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate('ClientTabs', { screen: 'HomeTab' }))}
        style={styles.backRow}
        hitSlop={6}
      >
        <ArrowLeft size={18} color={colors.foreground} />
        <Text style={[styles.backTxt, { color: colors.foreground }]}>Retour</Text>
      </Pressable>

      <View style={styles.heroWrap}>
        <View style={[styles.heroIcon, { backgroundColor: palette.emerald[100] }]}>
          <Headphones size={32} color={palette.emerald[700]} />
        </View>
        <Text style={[styles.heroTitle, { color: colors.foreground }]}>Nous contacter</Text>
        <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
          Notre équipe est disponible pour vous aider
        </Text>
      </View>

      <View style={[styles.betaCard, { backgroundColor: palette.orange[50], borderColor: palette.orange[100] }]}>
        <Text style={[styles.betaTitle, { color: palette.orange[700] }]}>Testeurs bêta</Text>
        <Text style={[styles.betaBody, { color: palette.orange[900] }]}>
          Merci de tester AfriGo ! Signalez un bug via le chat ci-dessous, par email, ou laissez un
          avis privé dans le Play Store (menu de l&apos;app → Aide et commentaires).
        </Text>
      </View>

      <View style={{ gap: 12, marginTop: 8 }}>
        <ContactCard
          Icon={Phone}
          iconBg={palette.emerald[100]}
          iconColor={palette.emerald[700]}
          label="Appelez-nous"
          value={supportPhone || 'Numéro non configuré'}
          hint="Appuyez pour appeler directement"
          onPress={callSupport}
        />
        <ContactCard
          Icon={Mail}
          iconBg={palette.blue[50]}
          iconColor={palette.blue[700]}
          label="Envoyez-nous un email"
          value={supportEmail || 'Email non configuré'}
          hint="Appuyez pour envoyer un email"
          onPress={emailSupport}
        />
        <ContactCard
          Icon={MessageCircle}
          iconBg={palette.orange[100]}
          iconColor={palette.orange[700]}
          label="Message via l'application"
          value="Chat AfriGo"
          hint="Échangez directement avec notre équipe"
          onPress={() => nav.navigate('Messages')}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  backTxt: { fontSize: 14, fontWeight: '600' },
  heroWrap: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 22, fontWeight: '800' },
  heroSubtitle: { fontSize: 14, textAlign: 'center' },

  betaCard: {
    marginTop: 4,
    marginBottom: 4,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  betaTitle: { fontSize: 14, fontWeight: '800', marginBottom: 6 },
  betaBody: { fontSize: 13, lineHeight: 19 },

  cardPressable: {
    borderRadius: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  cardValue: { fontSize: 15, fontWeight: '800', marginBottom: 2 },
  cardHint: { fontSize: 11 },
});
