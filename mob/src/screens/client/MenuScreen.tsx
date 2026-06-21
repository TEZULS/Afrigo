import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Image as RNImage } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Home,
  User,
  ShoppingBag,
  CreditCard,
  RotateCcw,
  Banknote,
  Star,
  Phone,
  ShieldCheck,
  ChevronRight,
  Truck,
  X,
} from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { useAppSettings } from '@/hooks/useAppSettings';
import * as Linking from 'expo-linking';
import type { RootStackParamList } from '@/navigation/types';
import type { IconComponent } from '@/types/icon';
import { palette } from '@/theme/tokens';
import { AFRIGO_APP_ICON } from '@/constants/branding';

interface MenuItem {
  label: string;
  Icon: IconComponent;
  onPress: () => void;
  active?: boolean;
}

export const MenuScreen: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const settings = useAppSettings();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  const scrollFooterPad =
    route.name === 'MenuTab' ? Math.max(insets.bottom, 8) + 96 : Math.max(insets.bottom, 8) + 24;

  const requireAuth = (go: () => void) => {
    if (!isAuthenticated) nav.navigate('Login', { initialMode: 'login' });
    else go();
  };

  /**
   * Items du side menu qui correspondent au screenshot:
   * Accueil / Mon profil / Mes commandes / Paiement / Mes retours /
   * Mes remboursements / Avis clients / Nous contacter
   */
  const items: MenuItem[] = [
    {
      label: 'Accueil',
      Icon: Home,
      onPress: () => nav.navigate('ClientTabs', { screen: 'HomeTab' }),
    },
    {
      label: 'Mon profil',
      Icon: User,
      onPress: () => requireAuth(() => nav.navigate('ClientTabs', { screen: 'ProfileTab' })),
      active: true,
    },
    {
      label: 'Mes commandes',
      Icon: ShoppingBag,
      onPress: () => requireAuth(() => nav.navigate('Orders')),
    },
    {
      label: 'Paiement',
      Icon: CreditCard,
      onPress: () => requireAuth(() => nav.navigate('Payment', { orderId: '', amount: 0 })),
    },
    {
      label: 'Mes retours',
      Icon: RotateCcw,
      onPress: () => requireAuth(() => nav.navigate('MyReturns')),
    },
    {
      label: 'Mes remboursements',
      Icon: Banknote,
      onPress: () => requireAuth(() => nav.navigate('MyRefunds')),
    },
    {
      label: 'Avis clients',
      Icon: Star,
      onPress: () => requireAuth(() => nav.navigate('AllReviews', { productId: '' })),
    },
    {
      label: 'Nous contacter',
      Icon: Phone,
      onPress: () => requireAuth(() => nav.navigate('Messages')),
    },
  ];

  const supportItems: MenuItem[] = [
    {
      label: 'Service client',
      Icon: Phone,
      onPress: () =>
        settings.data?.support_phone && Linking.openURL(`tel:${settings.data.support_phone}`),
    },
  ];

  return (
    <Screen scroll contentStyle={{ paddingBottom: scrollFooterPad }}>
      <View style={styles.header}>
        <RNImage
          source={AFRIGO_APP_ICON}
          style={styles.brandLogo}
          resizeMode="contain"
          accessibilityLabel="AfriGo"
        />
        <Pressable
          accessibilityLabel="Fermer le menu"
          onPress={() => {
            if (nav.canGoBack()) nav.goBack();
            else nav.navigate('ClientTabs', { screen: 'HomeTab' });
          }}
          style={styles.closeBtn}
          hitSlop={10}
        >
          <X size={20} color={palette.blue[500]} />
        </Pressable>
      </View>

      <Card padding={6} style={[styles.menuCard, { borderColor: colors.border }]}>
        {items.map((it, i) => (
          <MenuRow
            key={it.label}
            item={it}
            dividerColor={colors.border}
            isLast={i === items.length - 1}
          />
        ))}
      </Card>

      <Text style={[styles.section, { color: colors.mutedForeground }]}>Support</Text>
      <Card padding={6} style={{ marginTop: 8, borderColor: colors.border }}>
        {supportItems.map((it, i) => (
          <MenuRow
            key={it.label}
            item={it}
            dividerColor={colors.border}
            isLast={i === supportItems.length - 1}
          />
        ))}
      </Card>

      <View style={[styles.roleRow, { marginTop: 16 }]}>
        <View style={styles.roleCell}>
          <Button
            title="Espace livreur"
            variant="outline"
            fullWidth
            leftIcon={<Truck size={16} color={colors.foreground} />}
            onPress={() => nav.navigate('DelivererStack', { screen: 'DelivererLogin' })}
          />
        </View>
        <View style={styles.roleCell}>
          <Button
            title="Espace admin"
            variant="outline"
            fullWidth
            leftIcon={<ShieldCheck size={16} color={colors.foreground} />}
            onPress={() => nav.navigate('AdminLogin')}
          />
        </View>
      </View>
    </Screen>
  );
};

const MenuRow: React.FC<{
  item: MenuItem;
  isLast?: boolean;
  dividerColor: string;
}> = ({ item, isLast = false, dividerColor }) => {
  const { colors } = useTheme();
  const RowIcon = item.Icon;
  const activeBg = palette.slate[100];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      onPress={item.onPress}
      android_ripple={{ color: 'rgba(0,0,0,0.12)' }}
      style={({ pressed }) => [
        styles.rowOuter,
        item.active && { backgroundColor: activeBg, borderRadius: 12 },
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: dividerColor,
        },
        Platform.OS === 'ios' && pressed && { opacity: 0.65 },
      ]}
    >
      <View style={styles.rowInner}>
        <View style={styles.iconSlot}>
          <RowIcon size={20} strokeWidth={2} color={colors.foreground} />
        </View>
        <Text style={[styles.label, { color: colors.foreground }]} numberOfLines={1}>
          {item.label}
        </Text>
        <ChevronRight size={18} strokeWidth={2} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 12,
  },
  brandLogo: { width: 92, height: 28 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCard: { marginTop: 4, borderWidth: 1 },
  section: { fontSize: 13, fontWeight: '700', marginTop: 18, letterSpacing: 0.2 },
  rowOuter: { overflow: 'hidden' },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  iconSlot: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  label: { flex: 1, fontSize: 15, fontWeight: '600' },
  roleRow: { flexDirection: 'row', alignItems: 'stretch' },
  roleCell: { flex: 1, marginHorizontal: 4 },
});
