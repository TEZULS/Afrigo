import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Share, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Gift, Copy, Check, Users, AlertCircle, Share2, ThumbsUp } from 'lucide-react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/theme/ThemeProvider';
import { useToast } from '@/hooks/useToast';
import { palette } from '@/theme/tokens';
import {
  PromoCode,
  ReferralSettings,
  WalletTransaction,
  entities,
} from '@/api/entities';
import { getBase44 } from '@/api/base44Client';

interface ReferralSettingsData {
  referrer_bonus?: number;
  referred_bonus?: number;
  max_referrals_per_user?: number;
  is_active?: boolean;
}

interface UserLite {
  id?: string;
  email?: string;
  referral_code?: string;
  referred_by?: string | null;
  wallet_balance?: number;
}

interface PromoCodeRow {
  id: string;
  code?: string;
  owner_email?: string;
  usage_count?: number;
  referral_bonus_credited?: boolean;
}

const DEFAULT_SETTINGS: Required<ReferralSettingsData> = {
  referrer_bonus: 5,
  referred_bonus: 0,
  max_referrals_per_user: 3,
  is_active: true,
};

export interface ReferralSectionProps {
  user: UserLite | null | undefined;
}

export const ReferralSection: React.FC<ReferralSectionProps> = ({ user }) => {
  const { colors } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [copied, setCopied] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { data: settingsData } = useQuery({
    queryKey: ['referral-settings'],
    queryFn: async () => {
      try {
        const list = (await ReferralSettings().list?.()) as ReferralSettingsData[] | undefined;
        return list?.[0] ?? null;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const settings = { ...DEFAULT_SETTINGS, ...(settingsData ?? {}) };

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users-referral'],
    queryFn: async () => {
      try {
        const list = (await entities().User?.list?.()) as UserLite[] | undefined;
        return list ?? [];
      } catch {
        return [] as UserLite[];
      }
    },
    enabled: !!user?.email,
    staleTime: 60 * 1000,
  });

  const myReferralsCount = allUsers.filter((u) => u.referred_by === user?.email).length;
  const remainingReferrals = (settings.max_referrals_per_user || 3) - myReferralsCount;

  const applyReferralMutation = useMutation({
    mutationFn: async (rawCode: string) => {
      if (!settings.is_active) {
        throw new Error('Le programme de parrainage est temporairement indisponible');
      }
      const code = rawCode.trim().toUpperCase();
      if (!code) throw new Error('Code invalide');

      const promoCodes = (await PromoCode().filter?.({ code })) as PromoCodeRow[] | undefined;
      const promoCode = promoCodes?.[0];
      if (!promoCode) throw new Error('Code invalide');

      if (!user?.email) throw new Error('Connectez-vous pour utiliser un code');
      if (promoCode.owner_email === user.email) {
        throw new Error('Vous ne pouvez pas utiliser votre propre code');
      }

      const referredByReferrer = allUsers.filter((u) => u.referred_by === promoCode.owner_email);
      if (referredByReferrer.length >= settings.max_referrals_per_user) {
        throw new Error("Ce code a atteint sa limite d'utilisations");
      }

      await getBase44().auth.updateMe({
        referred_by: promoCode.owner_email,
        wallet_balance: (user.wallet_balance || 0) + settings.referred_bonus,
      } as Record<string, unknown>);

      const referrerList = (await entities().User?.filter?.({
        email: promoCode.owner_email,
      })) as UserLite[] | undefined;
      const referrer = referrerList?.[0];
      if (referrer && typeof referrer.id === 'string') {
        await (entities().User?.update?.(referrer.id, {
          wallet_balance: (referrer.wallet_balance || 0) + settings.referrer_bonus,
        }) as Promise<unknown>);

        await WalletTransaction().create?.({
          customer_email: user.email,
          amount: settings.referred_bonus,
          type: 'credit',
          reason: 'Bonus de bienvenue (parrainage)',
          admin_email: 'system',
        });

        await WalletTransaction().create?.({
          customer_email: promoCode.owner_email,
          amount: settings.referrer_bonus,
          type: 'credit',
          reason: `Bonus parrainage - ${user.email}`,
          admin_email: 'system',
        });
      }

      await PromoCode().update?.(promoCode.id, {
        usage_count: (promoCode.usage_count || 0) + 1,
        referral_bonus_credited: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['all-users-referral'] });
      setShowSuccess(true);
      toast.success(
        'Code appliqué',
        `${settings.referred_bonus}€ ajoutés à votre portefeuille`,
      );
      setTimeout(() => {
        setShowSuccess(false);
        setReferralInput('');
      }, 3000);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || 'Le code est invalide');
      toast.error('Code invalide', error.message);
      setTimeout(() => setErrorMessage(''), 4000);
    },
  });

  const handleCopy = useCallback(async () => {
    if (!user?.referral_code) return;
    await Clipboard.setStringAsync(user.referral_code);
    setCopied(true);
    toast.success('Code copié');
    setTimeout(() => setCopied(false), 2000);
  }, [user?.referral_code, toast]);

  const handleShare = useCallback(async () => {
    if (!user?.referral_code) return;
    const shareText = `Rejoins-moi sur AfriGo et reçois ${settings.referred_bonus}€ de bonus ! Utilise mon code: ${user.referral_code}`;
    try {
      await Share.share({
        message: shareText,
        title: 'AfriGo - Code de parrainage',
      });
    } catch {
      await Clipboard.setStringAsync(shareText);
      toast.success('Lien de partage copié');
    }
  }, [user?.referral_code, settings.referred_bonus, toast]);

  const handleApplyCode = useCallback(() => {
    const code = referralInput.trim();
    if (!code) return;
    setErrorMessage('');
    applyReferralMutation.mutate(code);
  }, [referralInput, applyReferralMutation]);

  if (!user) return null;
  if (settings.is_active === false) return null;

  const referralCode = user.referral_code || '';
  const limitReached = remainingReferrals <= 0;
  const alreadyReferred = !!user.referred_by && user.referred_by !== 'skipped';

  return (
    <Card padding={0} style={[styles.card, { borderColor: colors.border }]}>
      <View style={styles.header}>
        <Gift size={20} color={palette.emerald[500]} />
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Parrainage</Text>
      </View>

      <View style={[styles.codeBlock, { backgroundColor: palette.emerald[50] }]}>
        <View style={styles.codeHeader}>
          <View style={styles.codeHeaderLeft}>
            <Users size={18} color={palette.emerald[600]} />
            <Text style={[styles.codeTitle, { color: colors.foreground }]}>
              Mon code de parrainage
            </Text>
          </View>
          <Badge
            label={`${myReferralsCount}/${settings.max_referrals_per_user}`}
            variant="success"
          />
        </View>

        <Text style={[styles.codeDescription, { color: colors.mutedForeground }]}>
          Partagez votre code et gagnez{' '}
          <Text style={styles.bold}>{settings.referrer_bonus}€</Text> pour chaque ami inscrit.
          Votre ami reçoit <Text style={styles.bold}>{settings.referred_bonus}€</Text> !
        </Text>

        <View style={[styles.maxBox, { borderColor: '#FCD34D', backgroundColor: '#FEF3C7' }]}>
          <AlertCircle size={12} color="#92400E" />
          <Text style={[styles.maxText, { color: '#92400E' }]}>
            Vous pouvez parrainer jusqu&apos;à{' '}
            <Text style={styles.bold}>{settings.max_referrals_per_user} personnes</Text> maximum
          </Text>
        </View>

        <Text style={[styles.note, { color: colors.mutedForeground }]}>
          💰 Les bonus sont crédités sur votre portefeuille et utilisables uniquement pour vos
          achats
        </Text>

        <View style={styles.codeRow}>
          <View
            style={[
              styles.codeField,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text
              style={[styles.codeFieldText, { color: colors.foreground }]}
              accessibilityLabel="Code de parrainage"
            >
              {referralCode || 'REFXXXXXX'}
            </Text>
          </View>
          <Pressable
            onPress={handleCopy}
            disabled={limitReached || !referralCode}
            accessibilityLabel="Copier le code"
            style={({ pressed }) => [
              styles.copyBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: limitReached || !referralCode ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {copied ? (
              <Check size={18} color={palette.emerald[600]} />
            ) : (
              <Copy size={18} color={colors.foreground} />
            )}
          </Pressable>
        </View>

        <Button
          title="Partager avec mes amis"
          variant="primary"
          fullWidth
          size="md"
          leftIcon={<Share2 size={16} color="#FFF" />}
          onPress={handleShare}
          disabled={limitReached || !referralCode}
          style={{ marginTop: 10 }}
        />

        {limitReached ? (
          <Text style={[styles.limitText, { color: palette.rose[600] }]}>
            Limite de parrainages atteinte
          </Text>
        ) : null}
      </View>

      {!alreadyReferred ? (
        <View style={[styles.applyBlock, { borderTopColor: colors.border }]}>
          {showSuccess ? (
            <View style={[styles.successBox, { borderColor: palette.emerald[500] }]}>
              <View
                style={[styles.successIcon, { backgroundColor: palette.emerald[500] }]}
              >
                <ThumbsUp size={28} color="#FFF" />
              </View>
              <Text style={[styles.successTitle, { color: palette.emerald[700] }]}>
                Code validé !
              </Text>
              <Text style={[styles.successSubtitle, { color: palette.emerald[600] }]}>
                {settings.referred_bonus}€ ajoutés à votre portefeuille
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.applyLabel, { color: colors.foreground }]}>
                Vous avez un code de parrainage ?
              </Text>
              <Text style={[styles.applyHint, { color: colors.mutedForeground }]}>
                Entrez le code d&apos;un ami et recevez{' '}
                <Text style={styles.bold}>{settings.referred_bonus}€</Text> sur votre
                portefeuille (utilisable uniquement pour vos achats)
              </Text>
              <View style={styles.applyRow}>
                <View style={{ flex: 1 }}>
                  <Input
                    value={referralInput}
                    onChangeText={(v) => setReferralInput(v.toUpperCase())}
                    placeholder="REFXXXXXX"
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </View>
                <Button
                  title="Appliquer"
                  variant="primary"
                  size="md"
                  loading={applyReferralMutation.isPending}
                  disabled={!referralInput.trim() || applyReferralMutation.isPending}
                  onPress={handleApplyCode}
                />
              </View>
              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : (
        <View style={[styles.alreadyBox, { borderTopColor: colors.border }]}>
          <Check size={24} color={palette.blue[600]} />
          <Text style={[styles.alreadyText, { color: palette.blue[700] }]}>
            Vous avez été parrainé par un ami
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 17, fontWeight: '800' },

  codeBlock: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
  },
  codeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  codeHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeTitle: { fontSize: 15, fontWeight: '700' },
  codeDescription: { fontSize: 13, lineHeight: 18, marginBottom: 10 },

  maxBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  maxText: { fontSize: 12, flex: 1 },

  note: { fontSize: 12, lineHeight: 16, marginBottom: 12 },

  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeField: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  codeFieldText: { fontSize: 18, fontWeight: '800', letterSpacing: 1.5 },

  copyBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  limitText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },

  applyBlock: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  applyLabel: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  applyHint: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  applyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },

  errorBox: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  errorText: {
    color: '#E11D48',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },

  successBox: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: { fontSize: 16, fontWeight: '800' },
  successSubtitle: { fontSize: 13 },

  alreadyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  alreadyText: { fontSize: 13, fontWeight: '700' },

  bold: { fontWeight: '800' },
});
