import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Check, ShieldCheck, ScrollText } from 'lucide-react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { useAuth } from '@/lib/AuthContext';
import { getBase44 } from '@/api/base44Client';
import { InternalRegulations, PrivacyPolicy } from '@/api/entities';
import { hydrateKvFromDisk, kv } from '@/services/storage';
import { useToast } from '@/hooks/useToast';
import { userErrorMessage } from '@/lib/userErrors';
import {
  displayablePrivacyPolicy,
  displayableRegulations,
  privacyAccepted,
  privacyAcceptanceKey,
  regulationsAccepted,
  regulationsAcceptanceKey,
  type PrivacyAcceptance,
  type PrivacyPolicyDoc,
  type RegulationsAcceptance,
  type RegulationsDoc,
} from '@/utils/legalDocuments';
import { LegalContent } from './LegalContent';

/**
 * Porte d'entrée légale : au lancement, **avant toute utilisation ou connexion**
 * et pour tout le monde (invité comme client), le règlement intérieur puis la
 * politique de confidentialité doivent être acceptés. Tant qu'un texte n'est
 * pas accepté, la fenêtre reste affichée (impossible à fermer autrement).
 *
 * Nouvelle version publiée par l'admin → nouvelle demande d'accord.
 */
export const LegalConsentGate: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user, isLoadingAuth, isLoadingPublicSettings, refreshUser, logout } = useAuth();
  const email = user?.email;

  const [hydrated, setHydrated] = useState(false);
  /** Incrémenté après chaque acceptation locale pour relire le stockage. */
  const [localVersion, setLocalVersion] = useState(0);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void hydrateKvFromDisk().finally(() => setHydrated(true));
  }, []);

  const ready = hydrated && !isLoadingAuth && !isLoadingPublicSettings;

  const regulationsQuery = useQuery<RegulationsDoc[]>({
    queryKey: ['legal', 'internalRegulations'],
    enabled: ready,
    staleTime: 5 * 60_000,
    queryFn: async () => ((await InternalRegulations().list?.()) ?? []) as RegulationsDoc[],
  });
  const privacyQuery = useQuery<PrivacyPolicyDoc[]>({
    queryKey: ['legal', 'privacyPolicy'],
    enabled: ready,
    staleTime: 5 * 60_000,
    queryFn: async () => ((await PrivacyPolicy().list?.()) ?? []) as PrivacyPolicyDoc[],
  });

  /*
    Actif en priorité, sinon le texte le plus récent : tout le monde (invité
    comme client connecté) doit donner son accord au lancement, même quand
    l'admin a laissé le document sur `is_active: false`.
  */
  const regulations = useMemo(
    () => displayableRegulations(regulationsQuery.data ?? []),
    [regulationsQuery.data],
  );
  const policy = useMemo(
    () => displayablePrivacyPolicy(privacyQuery.data ?? []),
    [privacyQuery.data],
  );

  const regulationsPending = useMemo(() => {
    if (!ready || !regulations) return false;
    const acc = kv.get<RegulationsAcceptance>(regulationsAcceptanceKey(email));
    return !regulationsAccepted(regulations, acc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, regulations, email, localVersion]);

  const privacyPending = useMemo(() => {
    if (!ready || !policy) return false;
    const local = kv.get<PrivacyAcceptance>(privacyAcceptanceKey(email));
    const profileVersion = user?.privacy_policy_accepted_version as number | string | null | undefined;
    return !privacyAccepted(policy, profileVersion, local);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, policy, email, user?.privacy_policy_accepted_version, localVersion]);

  const step: 'regulations' | 'privacy' | null = regulationsPending
    ? 'regulations'
    : privacyPending
      ? 'privacy'
      : null;

  // Nouvelle étape → case décochée.
  useEffect(() => {
    setChecked(false);
  }, [step, regulations?.id, policy?.id]);

  const accept = useCallback(async () => {
    if (!step || !checked) return;
    setSaving(true);
    try {
      const acceptedAt = new Date().toISOString();
      if (step === 'regulations' && regulations) {
        kv.set(regulationsAcceptanceKey(email), {
          regulationId: regulations.id,
          regulationVersion: regulations.version ?? '',
          acceptedAt,
        } satisfies RegulationsAcceptance);
      } else if (step === 'privacy' && policy) {
        kv.set(privacyAcceptanceKey(email), {
          version: policy.version ?? '',
          acceptedAt,
        } satisfies PrivacyAcceptance);
        if (email) {
          // Comme le site : la version acceptée est portée par le profil.
          await getBase44().auth.updateMe({
            privacy_policy_accepted_version: policy.version,
            privacy_policy_accepted_at: acceptedAt,
          } as Record<string, unknown>);
          void refreshUser();
        }
      }
      setLocalVersion((v) => v + 1);
    } catch (e) {
      toast.error(
        'Enregistrement impossible',
        userErrorMessage(e, 'Votre accord n’a pas pu être enregistré. Réessayez dans un instant.'),
      );
    } finally {
      setSaving(false);
    }
  }, [step, checked, regulations, policy, email, refreshUser, toast]);

  const refuse = useCallback(() => {
    const docLabel = step === 'privacy' ? 'la politique de confidentialité' : 'le règlement intérieur';
    if (email) {
      Alert.alert(
        'Refuser ?',
        `Sans accepter ${docLabel}, vous ne pouvez pas utiliser AfriGo. Vous serez déconnecté.`,
        [
          { text: 'Revenir', style: 'cancel' },
          { text: 'Me déconnecter', style: 'destructive', onPress: () => void logout() },
        ],
      );
    } else {
      Alert.alert(
        'Accord nécessaire',
        `Pour utiliser AfriGo, vous devez accepter ${docLabel}. Vous pouvez fermer l’application si vous ne le souhaitez pas.`,
      );
    }
  }, [email, logout, step]);

  if (!step) return null;

  const doc = step === 'regulations' ? regulations : policy;
  const title =
    step === 'regulations'
      ? (regulations?.title?.trim() || 'Règlement intérieur')
      : 'Politique de confidentialité';
  const HeadIcon = step === 'regulations' ? ScrollText : ShieldCheck;
  const consentLabel =
    step === 'regulations'
      ? "J'accepte les conditions du règlement intérieur et je comprends que je dois les respecter pour utiliser cette plateforme."
      : "J'accepte la politique de confidentialité et consens au traitement de mes données personnelles.";

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              marginTop: Math.max(insets.top, 12) + 12,
              marginBottom: Math.max(insets.bottom, 12) + 12,
            },
          ]}
          testID={`legal-gate-${step}`}
        >
          <View style={[styles.head, { borderBottomColor: colors.border }]}>
            <View style={[styles.headIcon, { backgroundColor: palette.emerald[50] }]}>
              <HeadIcon size={20} color={palette.emerald[600]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
              {doc?.version != null ? (
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  Version {String(doc.version)}
                  {'effective_date' in (doc ?? {}) && (doc as RegulationsDoc).effective_date
                    ? ` · en vigueur le ${(doc as RegulationsDoc).effective_date}`
                    : ''}
                </Text>
              ) : null}
            </View>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <LegalContent content={doc?.content} />
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={consentLabel}
              testID="legal-gate-consent"
              onPress={() => setChecked((c) => !c)}
              style={styles.consentRow}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: checked ? palette.brand.green : 'transparent',
                    borderColor: checked ? palette.brand.green : colors.border,
                  },
                ]}
              >
                {checked ? <Check size={14} color="#FFF" /> : null}
              </View>
              <Text style={[styles.consentText, { color: colors.mutedForeground }]}>{consentLabel}</Text>
            </Pressable>
            <View style={styles.actions}>
              <Button
                title="Refuser"
                variant="outline"
                fullWidth
                onPress={refuse}
                textStyle={{ color: colors.destructive }}
                style={{ flex: 1, borderColor: colors.destructive }}
                testID="legal-gate-refuse"
              />
              <Button
                title={saving ? 'Enregistrement…' : "J'accepte"}
                variant="primary"
                fullWidth
                disabled={!checked || saving}
                loading={saving}
                onPress={() => void accept()}
                style={{ flex: 1, backgroundColor: checked ? palette.brand.green : palette.slate[400] }}
                testID="legal-gate-accept"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  sheet: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 12 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  consentText: { flex: 1, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10 },
});
