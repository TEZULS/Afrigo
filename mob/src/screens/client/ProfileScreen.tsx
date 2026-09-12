import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  User,
  Wallet,
  Gift,
  Star,
  ArrowRightLeft,
  ArrowLeft,
  LogOut,
  Trash2,
  Edit2,
  Save,
  Phone,
  Mail,
} from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TierBadge } from '@/components/profile/TierBadge';
import { ReferralSection } from '@/components/profile/ReferralSection';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { useToast } from '@/hooks/useToast';
import {
  LoyaltyPoints,
  LoyaltySettings,
  TierBenefit,
  WalletTransaction,
  invokeFunction,
} from '@/api/entities';
import { getBase44 } from '@/api/base44Client';
import type { RootStackParamList } from '@/navigation/types';
import { palette } from '@/theme/tokens';
import { AFRIGO_APP_ICON } from '@/constants/branding';
import { userErrorMessage } from '@/lib/userErrors';

type Civility = 'M.' | 'Mme' | 'Autre' | '';
type EditField = null | 'civility' | 'names' | 'phone' | 'address';

interface LoyaltySettingsData {
  is_active?: boolean;
  points_to_euro_rate?: number;
  min_purchase_amount?: number;
  points_per_euro?: number;
  auto_calculate_points?: boolean;
}

interface LoyaltyPointRow {
  points?: number;
}

interface TierBenefitRow {
  tier?: string;
}

export const ProfileScreen: React.FC = () => {
  const { user, isAuthenticated, logout, refreshUser } = useAuth();
  const { colors } = useTheme();
  const toast = useToast();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const userObj = user as Record<string, unknown> | null;
  const userEmail = (userObj?.email as string | undefined) ?? undefined;
  const userFirstName =
    (userObj?.first_name as string | undefined) ??
    (userObj?.full_name as string | undefined)?.split(' ')[0] ??
    '';
  const userLastName =
    (userObj?.last_name as string | undefined) ??
    (userObj?.full_name as string | undefined)?.split(' ').slice(1).join(' ') ??
    '';
  const userPhone = (userObj?.phone as string | undefined) ?? '';
  const userCivility = ((userObj?.civility as Civility | undefined) ?? '') as Civility;
  const userAddress = (userObj?.address as string | undefined) ?? '';
  const userPostalCode = (userObj?.postal_code as string | undefined) ?? '';
  const userCity = (userObj?.city as string | undefined) ?? '';

  const [editField, setEditField] = useState<EditField>(null);
  const [civilityDraft, setCivilityDraft] = useState<Civility>(userCivility);
  const [firstNameDraft, setFirstNameDraft] = useState(userFirstName);
  const [lastNameDraft, setLastNameDraft] = useState(userLastName);
  const [phoneDraft, setPhoneDraft] = useState(userPhone);
  const [addressDraft, setAddressDraft] = useState(userAddress);
  const [postalCodeDraft, setPostalCodeDraft] = useState(userPostalCode);
  const [cityDraft, setCityDraft] = useState(userCity);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: loyaltySettings } = useQuery<LoyaltySettingsData | null>({
    queryKey: ['loyaltySettings'],
    queryFn: async () => {
      try {
        const list = (await LoyaltySettings().list?.()) as LoyaltySettingsData[] | undefined;
        return list?.[0] ?? null;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: loyaltyPoints = [] } = useQuery<LoyaltyPointRow[]>({
    queryKey: ['loyaltyPoints', userEmail],
    queryFn: async () => {
      try {
        const list = (await LoyaltyPoints().filter?.({ customer_email: userEmail })) as
          | LoyaltyPointRow[]
          | undefined;
        return list ?? [];
      } catch {
        return [] as LoyaltyPointRow[];
      }
    },
    enabled: !!userEmail,
    /** Pas de cache prolongé : les points doivent refléter immédiatement
     *  les ajouts (cloud function `addLoyaltyPointsOnDelivery`) et la
     *  conversion (`handleConvertPoints`). */
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: tierBenefits = [] } = useQuery<TierBenefitRow[]>({
    queryKey: ['tierBenefits'],
    queryFn: async () => {
      try {
        const list = (await TierBenefit().list?.()) as TierBenefitRow[] | undefined;
        return list ?? [];
      } catch {
        return [];
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  const totalPoints = useMemo(
    () => Math.max(0, loyaltyPoints.reduce((sum, p) => sum + (p.points || 0), 0)),
    [loyaltyPoints],
  );
  /**
   * Règle confirmée par le client : 1€ dépensé = 1 point gagné après livraison.
   * `points_to_euro_rate` reste paramétrable côté admin si besoin (taux de
   * conversion vers le portefeuille). Par défaut on garde 1pt = 1€.
   */
  const conversionRate = loyaltySettings?.points_to_euro_rate ?? 1;
  const convertibleAmount = Math.floor(totalPoints / conversionRate);
  const minPurchase = loyaltySettings?.min_purchase_amount ?? 10;
  const isLoyaltyActive = loyaltySettings?.is_active !== false;
  const userTier =
    (userObj?.customer_tier as string | undefined) ??
    (userObj?.tier as string | undefined) ??
    'normal';
  void tierBenefits;

  const scrollFooterPad =
    route.name === 'ProfileTab'
      ? Math.max(insets.bottom, 8) + 96
      : Math.max(insets.bottom, 8) + 40;

  const saveField = useCallback(
    async (field: 'civility' | 'phone', value: string) => {
      setSaving(true);
      try {
        await getBase44().auth.updateMe({ [field]: value } as Record<string, unknown>);
        await refreshUser();
        setEditField(null);
        toast.success('Modification enregistrée');
        queryClient.invalidateQueries({ queryKey: ['user'] });
      } catch (e) {
        toast.error(
          "Impossible d'enregistrer",
          userErrorMessage(e, 'La modification n’a pas pu être enregistrée. Réessayez dans un instant.'),
        );
      } finally {
        setSaving(false);
      }
    },
    [refreshUser, toast, queryClient],
  );

  const saveNames = useCallback(async () => {
    setSaving(true);
    try {
      const fn = firstNameDraft.trim();
      const ln = lastNameDraft.trim();
      await getBase44().auth.updateMe({
        first_name: fn,
        last_name: ln,
        full_name: `${fn} ${ln}`.trim(),
      } as Record<string, unknown>);
      await refreshUser();
      setEditField(null);
      toast.success('Nom et prénom modifiés');
    } catch (e) {
      toast.error(
        "Impossible d'enregistrer",
        userErrorMessage(e, 'La modification n’a pas pu être enregistrée. Réessayez dans un instant.'),
      );
    } finally {
      setSaving(false);
    }
  }, [firstNameDraft, lastNameDraft, refreshUser, toast]);

  const saveAddress = useCallback(async () => {
    setSaving(true);
    try {
      await getBase44().auth.updateMe({
        address: addressDraft.trim(),
        postal_code: postalCodeDraft.trim(),
        city: cityDraft.trim(),
      } as Record<string, unknown>);
      await refreshUser();
      setEditField(null);
      toast.success('Adresse modifiée');
    } catch (e) {
      toast.error(
        "Impossible d'enregistrer",
        userErrorMessage(e, 'La modification n’a pas pu être enregistrée. Réessayez dans un instant.'),
      );
    } finally {
      setSaving(false);
    }
  }, [addressDraft, postalCodeDraft, cityDraft, refreshUser, toast]);

  const handleConvertPoints = useCallback(async () => {
    if (!userEmail) return;
    if (totalPoints < conversionRate) {
      toast.error(
        'Pas assez de points',
        `Vous devez avoir au moins ${conversionRate} points pour convertir`,
      );
      return;
    }
    setConverting(true);
    try {
      const euroAmount = Math.floor(totalPoints / conversionRate);
      const pointsToConvert = euroAmount * conversionRate;
      const remainingPoints = totalPoints - pointsToConvert;

      /**
       * Conversion : on enregistre une transaction de points négative
       * (transaction_type: 'converted') ainsi qu'un crédit de portefeuille.
       * Le total des points est recalculé à partir de TOUTES les lignes
       * `LoyaltyPoints` du client → après conversion totale le solde tombe
       * à 0 automatiquement.
       */
      await LoyaltyPoints().create?.({
        customer_email: userEmail,
        points: -pointsToConvert,
        transaction_type: 'converted',
        converted_amount: euroAmount,
      });
      await WalletTransaction().create?.({
        customer_email: userEmail,
        amount: euroAmount,
        type: 'credit',
        reason: `Conversion de ${pointsToConvert} points de fidélité`,
      });
      const newBalance =
        ((userObj?.wallet_balance as number | undefined) ?? 0) + euroAmount;
      await getBase44().auth.updateMe({ wallet_balance: newBalance } as Record<string, unknown>);

      // Refetch immédiat du solde de points + rechargement silencieux du user
      // (wallet_balance) — sans démonter la navigation.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['loyaltyPoints', userEmail] }),
        queryClient.refetchQueries({ queryKey: ['loyaltyPoints', userEmail] }),
        refreshUser(),
      ]);

      toast.success(
        `${pointsToConvert} points convertis en ${euroAmount}€`,
        remainingPoints > 0 ? `${remainingPoints} points restants` : 'Solde remis à 0',
      );
    } catch (e) {
      toast.error(
        'Conversion impossible',
        userErrorMessage(e, 'Vos points n’ont pas pu être convertis. Réessayez dans un instant.'),
      );
    } finally {
      setConverting(false);
    }
  }, [userEmail, totalPoints, conversionRate, userObj, refreshUser, queryClient, toast]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est irréversible. Toutes vos données seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await invokeFunction('handleCustomAuth', { action: 'delete_account' });
              await logout();
              nav.navigate('ClientTabs', { screen: 'HomeTab' });
            } catch (e) {
              toast.error(
                'Suppression impossible',
                userErrorMessage(e, 'Votre compte n’a pas pu être supprimé. Contactez le service client.'),
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [logout, nav, toast]);

  if (!isAuthenticated) {
    const fg = colors.foreground;
    const muted = colors.mutedForeground;
    const border = colors.border;
    return (
      <Screen scroll={false} paddingHorizontal={0} bg={colors.background}>
        <ScrollView
          contentContainerStyle={[
            styles.guestPage,
            {
              paddingTop: Math.max(insets.top, 8),
              paddingBottom: Math.max(insets.bottom, 24),
              paddingHorizontal: 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.guestToolbar, { borderBottomColor: border }]}>
            <Pressable
              accessibilityRole="link"
              onPress={() => nav.navigate('ClientTabs', { screen: 'HomeTab' })}
              hitSlop={12}
            >
              <Text style={[styles.guestTbTxt, { color: muted }]}>Accueil</Text>
            </Pressable>
          </View>

          <Image
            accessibilityLabel="AfriGo"
            source={AFRIGO_APP_ICON}
            style={styles.guestLogo}
            contentFit="contain"
          />

          <View style={styles.guestIconWrap}>
            <View style={[styles.guestIconCircle, { backgroundColor: palette.emerald[100] }]}>
              <User size={36} color={palette.emerald[700]} />
            </View>
          </View>

          <Text style={[styles.guestTitle, { color: fg }]}>Bienvenue sur AfriGo</Text>
          <Text style={[styles.guestSubtitle, { color: muted }]}>
            Connectez-vous ou créez un compte pour commencer
          </Text>

          <Card padding={16} style={[styles.guestCard, { borderColor: border }]}>
            <Button
              title="Se connecter"
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => nav.navigate('Login', { initialMode: 'login' })}
              style={{ borderRadius: 12 }}
            />
            <Button
              title="S'inscrire"
              variant="outline"
              size="lg"
              fullWidth
              onPress={() => nav.navigate('Login', { initialMode: 'register' })}
              style={{ borderRadius: 12, marginTop: 12 }}
            />
          </Card>

          <Pressable
            accessibilityRole="link"
            onPress={() => nav.navigate('ClientTabs', { screen: 'HomeTab' })}
            style={{ marginTop: 24 }}
          >
            <View style={styles.guestBackRow}>
              <ArrowLeft size={16} color={muted} />
              <Text style={[styles.guestFootLink, { color: muted }]}>Retour à l&apos;accueil</Text>
            </View>
          </Pressable>
        </ScrollView>
      </Screen>
    );
  }

  const customerId = (userObj?.customer_id as string | undefined) ?? '...';
  const walletBalance = (userObj?.wallet_balance as number | undefined) ?? 0;
  const fullName =
    `${firstNameDraft || userFirstName} ${lastNameDraft || userLastName}`.trim() ||
    (userObj?.full_name as string | undefined) ||
    'Mon profil';

  return (
    <Screen scroll contentStyle={{ paddingBottom: scrollFooterPad }} keyboardBehavior="padding">
      {nav.canGoBack() ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => nav.goBack()}
          style={styles.backRow}
        >
          <ArrowLeft size={18} color={colors.foreground} />
          <Text style={[styles.backTxt, { color: colors.foreground }]}>Retour</Text>
        </Pressable>
      ) : null}

      <View style={styles.identityHero}>
        <View style={[styles.identityCircle, { backgroundColor: palette.emerald[100] }]}>
          <Avatar size={56} name={fullName} />
        </View>
        <Text style={[styles.identityName, { color: colors.foreground }]} numberOfLines={1}>
          {fullName}
        </Text>
        {/*
          L'email n'est plus affiché sous le nom : il reste consultable dans
          la carte « Mes informations » plus bas (champ « Email * »).
        */}
        <View style={{ marginTop: 10 }}>
          <TierBadge tier={userTier} />
        </View>
      </View>

      <View style={styles.statRow}>
        <Card padding={14} style={[styles.statCard, { borderColor: colors.border }]}>
          <View style={styles.statRowInner}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Identifiant client
              </Text>
              <Text
                style={[styles.statValueId, { color: colors.foreground }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {customerId}
              </Text>
            </View>
            <View style={[styles.statIcon, { backgroundColor: colors.muted }]}>
              <User size={18} color={colors.foreground} />
            </View>
          </View>
        </Card>

        <Card padding={14} style={[styles.statCard, { borderColor: colors.border }]}>
          <View style={styles.statRowInner}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Solde du portefeuille
              </Text>
              <Text style={[styles.statValue, { color: '#9333EA' }]}>
                {walletBalance.toFixed(2)}€
              </Text>
            </View>
            <View style={[styles.statIcon, { backgroundColor: '#F3E8FF' }]}>
              <Wallet size={18} color="#9333EA" />
            </View>
          </View>
        </Card>
      </View>

      {isLoyaltyActive ? (
        <Card padding={14} style={[styles.fullCard, { borderColor: colors.border }]}>
          <View style={styles.statRowInner}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Achat minimum
              </Text>
              <Text style={[styles.statValue, { color: palette.emerald[600] }]}>
                {minPurchase}€
              </Text>
              <Text style={[styles.statHint, { color: colors.mutedForeground }]}>
                Pour gagner des points
              </Text>
            </View>
            <View style={[styles.statIcon, { backgroundColor: palette.emerald[50] }]}>
              <Gift size={18} color={palette.emerald[600]} />
            </View>
          </View>
        </Card>
      ) : null}

      {isLoyaltyActive ? (
        <LinearGradient
          colors={['#FEF3C7', '#FFEDD5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.loyaltyCard, { borderColor: colors.border }]}
        >
          <View style={styles.loyaltyHeader}>
            <Star size={18} color="#D97706" />
            <Text style={[styles.loyaltyTitle, { color: colors.foreground }]}>
              Mes points de fidélité
            </Text>
          </View>

          <View style={styles.loyaltyStats}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.loyaltyMutedLabel, { color: colors.mutedForeground }]}>
                Points disponibles
              </Text>
              <Text style={[styles.loyaltyValueAmber, { color: '#D97706' }]}>
                {totalPoints} pts
              </Text>
            </View>
            <View style={styles.loyaltyDivider}>
              <ArrowRightLeft size={20} color={colors.mutedForeground} />
              <Text style={[styles.loyaltyHint, { color: colors.mutedForeground }]}>
                {conversionRate} pts = 1€
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={[styles.loyaltyMutedLabel, { color: colors.mutedForeground }]}>
                Montant convertible
              </Text>
              <Text style={[styles.loyaltyValuePurple, { color: '#9333EA' }]}>
                {convertibleAmount}€
              </Text>
            </View>
          </View>

          <Button
            title={converting ? 'Conversion en cours…' : 'Convertir en portefeuille'}
            variant="brand"
            size="lg"
            fullWidth
            loading={converting}
            disabled={converting || totalPoints < conversionRate}
            leftIcon={<Wallet size={16} color="#FFF" />}
            onPress={handleConvertPoints}
            style={{ marginTop: 12, borderRadius: 12 }}
          />
          {totalPoints < conversionRate ? (
            <Text style={[styles.loyaltyFooterHint, { color: colors.mutedForeground }]}>
              Vous devez avoir au moins {conversionRate} points pour convertir
            </Text>
          ) : null}
        </LinearGradient>
      ) : null}

      <Card padding={0} style={[styles.fullCard, { borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Mes informations</Text>
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.fieldHeader}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>État civil *</Text>
            {editField !== 'civility' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setCivilityDraft(userCivility);
                  setEditField('civility');
                }}
                style={styles.editBtn}
              >
                <Edit2 size={14} color={palette.emerald[600]} />
                <Text style={[styles.editTxt, { color: palette.emerald[600] }]}>Modifier</Text>
              </Pressable>
            ) : null}
          </View>
          {editField === 'civility' ? (
            <View>
              <View style={styles.civilityRow}>
                {(['M.', 'Mme', 'Autre'] as const).map((opt) => {
                  const selected = civilityDraft === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => setCivilityDraft(opt)}
                      style={[
                        styles.civilityChip,
                        {
                          borderColor: selected ? palette.emerald[500] : colors.border,
                          backgroundColor: selected ? palette.emerald[50] : 'transparent',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: selected ? palette.emerald[700] : colors.mutedForeground,
                          fontWeight: '700',
                        }}
                      >
                        {opt}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.editActions}>
                <Button
                  title="Enregistrer"
                  variant="primary"
                  size="md"
                  loading={saving}
                  disabled={saving || !civilityDraft}
                  leftIcon={<Save size={14} color="#FFF" />}
                  onPress={() => saveField('civility', civilityDraft)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Annuler"
                  variant="outline"
                  size="md"
                  onPress={() => setEditField(null)}
                />
              </View>
            </View>
          ) : (
            <View style={[styles.readOnly, { backgroundColor: colors.muted }]}>
              <Text style={{ color: colors.foreground }}>{userCivility || 'Non défini'}</Text>
            </View>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Email *</Text>
          <View style={[styles.readOnly, { backgroundColor: colors.muted }]}>
            <Mail size={14} color={colors.mutedForeground} />
            <Text style={{ color: colors.foreground, marginLeft: 8 }} numberOfLines={1}>
              {userEmail ?? ''}
            </Text>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.fieldHeader}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Prénom et Nom *</Text>
            {editField !== 'names' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setFirstNameDraft(userFirstName);
                  setLastNameDraft(userLastName);
                  setEditField('names');
                }}
                style={styles.editBtn}
              >
                <Edit2 size={14} color={palette.emerald[600]} />
                <Text style={[styles.editTxt, { color: palette.emerald[600] }]}>Modifier</Text>
              </Pressable>
            ) : null}
          </View>
          {editField === 'names' ? (
            <View>
              <View style={styles.namesRow}>
                <View style={{ flex: 1 }}>
                  <Input
                    value={firstNameDraft}
                    onChangeText={setFirstNameDraft}
                    placeholder="Prénom"
                    autoCapitalize="words"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    value={lastNameDraft}
                    onChangeText={setLastNameDraft}
                    placeholder="Nom"
                    autoCapitalize="words"
                  />
                </View>
              </View>
              <View style={styles.editActions}>
                <Button
                  title="Enregistrer"
                  variant="primary"
                  size="md"
                  loading={saving}
                  disabled={saving || !firstNameDraft.trim() || !lastNameDraft.trim()}
                  leftIcon={<Save size={14} color="#FFF" />}
                  onPress={saveNames}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Annuler"
                  variant="outline"
                  size="md"
                  onPress={() => setEditField(null)}
                />
              </View>
            </View>
          ) : (
            <View style={[styles.readOnly, { backgroundColor: colors.muted }]}>
              <Text style={{ color: colors.foreground }} numberOfLines={1}>
                {(userFirstName || userLastName) ? `${userFirstName} ${userLastName}`.trim() : ''}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.fieldHeader}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Téléphone *</Text>
            {editField !== 'phone' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setPhoneDraft(userPhone);
                  setEditField('phone');
                }}
                style={styles.editBtn}
              >
                <Edit2 size={14} color={palette.emerald[600]} />
                <Text style={[styles.editTxt, { color: palette.emerald[600] }]}>Modifier</Text>
              </Pressable>
            ) : null}
          </View>
          {editField === 'phone' ? (
            <View>
              <Input
                value={phoneDraft}
                onChangeText={setPhoneDraft}
                placeholder="06 12 34 56 78"
                keyboardType="phone-pad"
                leftIcon={<Phone size={16} color={colors.mutedForeground} />}
              />
              <View style={styles.editActions}>
                <Button
                  title="Enregistrer"
                  variant="primary"
                  size="md"
                  loading={saving}
                  disabled={saving || !phoneDraft.trim()}
                  leftIcon={<Save size={14} color="#FFF" />}
                  onPress={() => saveField('phone', phoneDraft.trim())}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Annuler"
                  variant="outline"
                  size="md"
                  onPress={() => setEditField(null)}
                />
              </View>
            </View>
          ) : (
            <View style={[styles.readOnly, { backgroundColor: colors.muted }]}>
              <Phone size={14} color={colors.mutedForeground} />
              <Text style={{ color: colors.foreground, marginLeft: 8 }} numberOfLines={1}>
                {userPhone || ''}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <View style={styles.fieldHeader}>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
              Adresse de livraison *
            </Text>
            {editField !== 'address' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setAddressDraft(userAddress);
                  setPostalCodeDraft(userPostalCode);
                  setCityDraft(userCity);
                  setEditField('address');
                }}
                style={styles.editBtn}
              >
                <Edit2 size={14} color={palette.emerald[600]} />
                <Text style={[styles.editTxt, { color: palette.emerald[600] }]}>Modifier</Text>
              </Pressable>
            ) : null}
          </View>
          {editField === 'address' ? (
            <View>
              <Input
                value={addressDraft}
                onChangeText={setAddressDraft}
                placeholder="12 rue de la République"
                autoCapitalize="words"
              />
              <View style={styles.namesRow}>
                <View style={{ flex: 1 }}>
                  <Input
                    value={postalCodeDraft}
                    onChangeText={setPostalCodeDraft}
                    placeholder="Code postal"
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1.4 }}>
                  <Input
                    value={cityDraft}
                    onChangeText={setCityDraft}
                    placeholder="Ville"
                    autoCapitalize="words"
                  />
                </View>
              </View>
              <View style={styles.editActions}>
                <Button
                  title="Enregistrer"
                  variant="primary"
                  size="md"
                  loading={saving}
                  disabled={
                    saving ||
                    !addressDraft.trim() ||
                    !postalCodeDraft.trim() ||
                    !cityDraft.trim()
                  }
                  leftIcon={<Save size={14} color="#FFF" />}
                  onPress={saveAddress}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Annuler"
                  variant="outline"
                  size="md"
                  onPress={() => setEditField(null)}
                />
              </View>
            </View>
          ) : (
            <View
              style={[
                styles.readOnly,
                styles.addressReadOnly,
                { backgroundColor: colors.muted },
              ]}
            >
              {userAddress || userPostalCode || userCity ? (
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontWeight: '600' }}>
                    {userAddress || '—'}
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 2 }}>
                    {[userPostalCode, userCity].filter(Boolean).join(' ')}
                  </Text>
                </View>
              ) : (
                <Text style={{ color: colors.mutedForeground }}>Non renseignée</Text>
              )}
            </View>
          )}
        </View>

        <View style={{ height: 12 }} />
      </Card>

      <View style={{ marginTop: 16 }}>
        <ReferralSection
          user={{
            id: userObj?.id as string | undefined,
            email: userEmail,
            referral_code: userObj?.referral_code as string | undefined,
            referred_by: userObj?.referred_by as string | undefined,
            wallet_balance: walletBalance,
          }}
        />
      </View>

      <View style={{ marginTop: 16, gap: 10 }}>
        <Button
          title="Se déconnecter"
          variant="outline"
          fullWidth
          leftIcon={<LogOut size={16} color={palette.rose[600]} />}
          textStyle={{ color: palette.rose[600] }}
          onPress={logout}
          style={{ borderColor: '#FECDD3' }}
        />
        <Button
          title={deleting ? 'Suppression…' : 'Supprimer mon compte'}
          variant="ghost"
          fullWidth
          loading={deleting}
          leftIcon={<Trash2 size={16} color={colors.mutedForeground} />}
          textStyle={{ color: colors.mutedForeground }}
          onPress={handleDeleteAccount}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  guestPage: { flexGrow: 1, width: '100%' },
  guestToolbar: {
    alignItems: 'flex-end',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  guestTbTxt: { fontSize: 15, fontWeight: '600' },
  guestLogo: { width: 152, height: 36, alignSelf: 'flex-start', marginTop: 24 },
  guestIconWrap: { alignItems: 'center', marginTop: 32 },
  guestIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestTitle: {
    marginTop: 16,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  guestSubtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  guestCard: { marginTop: 28, borderWidth: 1 },
  guestBackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  guestFootLink: { fontSize: 14, fontWeight: '600' },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  backTxt: { fontSize: 14, fontWeight: '600' },

  identityHero: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  identityCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  identityName: { fontSize: 22, fontWeight: '800' },

  statRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statCard: { flex: 1, borderWidth: 1 },
  statRowInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statValueId: { fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  statHint: { fontSize: 11, marginTop: 2 },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fullCard: { marginTop: 12, borderWidth: 1 },
  cardHeader: { padding: 16, paddingBottom: 4 },
  cardTitle: { fontSize: 17, fontWeight: '800' },

  loyaltyCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  loyaltyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  loyaltyTitle: { fontSize: 16, fontWeight: '800' },
  loyaltyStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loyaltyDivider: { alignItems: 'center', justifyContent: 'center' },
  loyaltyMutedLabel: { fontSize: 12 },
  loyaltyValueAmber: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  loyaltyValuePurple: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  loyaltyHint: { fontSize: 11, marginTop: 4 },
  loyaltyFooterHint: { fontSize: 11, textAlign: 'center', marginTop: 8 },

  fieldGroup: { paddingHorizontal: 16, paddingBottom: 14 },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  editTxt: { fontSize: 13, fontWeight: '700' },
  readOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  addressReadOnly: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  civilityRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  civilityChip: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  namesRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
