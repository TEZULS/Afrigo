import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScrollText, ShieldCheck } from 'lucide-react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LegalContent } from '@/components/legal/LegalContent';
import { InternalRegulations, PrivacyPolicy } from '@/api/entities';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { formatDate } from '@/utils/format';
import {
  displayablePrivacyPolicy,
  displayableRegulations,
  type PrivacyPolicyDoc,
  type RegulationsDoc,
} from '@/utils/legalDocuments';
import type { RootStackParamList } from '@/navigation/types';

type Tab = 'regulations' | 'privacy';

/**
 * « Paramètres › Contrat » : règlement intérieur et politique de
 * confidentialité, consultables à tout moment (textes de base44, version et
 * date d'entrée en vigueur).
 */
export const LegalScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('regulations');

  const regulationsQuery = useQuery<RegulationsDoc[]>({
    queryKey: ['legal', 'internalRegulations'],
    staleTime: 5 * 60_000,
    queryFn: async () => ((await InternalRegulations().list?.()) ?? []) as RegulationsDoc[],
  });
  const privacyQuery = useQuery<PrivacyPolicyDoc[]>({
    queryKey: ['legal', 'privacyPolicy'],
    staleTime: 5 * 60_000,
    queryFn: async () => ((await PrivacyPolicy().list?.()) ?? []) as PrivacyPolicyDoc[],
  });

  const regulations = useMemo(
    () => displayableRegulations(regulationsQuery.data ?? []),
    [regulationsQuery.data],
  );
  const policy = useMemo(() => displayablePrivacyPolicy(privacyQuery.data ?? []), [privacyQuery.data]);

  const loading = regulationsQuery.isLoading || privacyQuery.isLoading;
  const doc = tab === 'regulations' ? regulations : policy;

  return (
    <Screen scroll header={<Header onBack={nav.goBack} title="Contrat" />}>
      <View style={[styles.tabs, { backgroundColor: colors.muted }]}>
        {(
          [
            { id: 'regulations' as const, label: 'Règlement intérieur', Icon: ScrollText },
            { id: 'privacy' as const, label: 'Confidentialité', Icon: ShieldCheck },
          ] as const
        ).map((t) => {
          const selected = tab === t.id;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(t.id)}
              testID={`legal-tab-${t.id}`}
              style={[styles.tab, { backgroundColor: selected ? colors.background : 'transparent' }]}
            >
              <t.Icon size={15} color={selected ? palette.brand.orange : colors.mutedForeground} />
              <Text
                style={{
                  color: selected ? colors.foreground : colors.mutedForeground,
                  fontWeight: selected ? '800' : '600',
                  fontSize: 13,
                }}
                numberOfLines={1}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <Loader />
      ) : !doc ? (
        <EmptyState
          title="Document indisponible"
          description="Ce texte n’a pas encore été publié. Réessayez plus tard."
        />
      ) : (
        <Card padding={16} style={{ marginTop: 12 }} testID={`legal-doc-${tab}`}>
          <Text style={[styles.docTitle, { color: colors.foreground }]}>
            {tab === 'regulations'
              ? ((doc as RegulationsDoc).title?.trim() || 'Règlement intérieur')
              : 'Politique de confidentialité'}
          </Text>
          <Text style={[styles.docMeta, { color: colors.mutedForeground }]}>
            {doc.version != null ? `Version ${String(doc.version)}` : ''}
            {tab === 'regulations' && (doc as RegulationsDoc).effective_date
              ? ` · en vigueur le ${formatDate((doc as RegulationsDoc).effective_date!)}`
              : doc.updated_date
                ? ` · mise à jour le ${formatDate(doc.updated_date)}`
                : ''}
            {doc.is_active === false ? ' · dernière version publiée' : ''}
          </Text>
          <View style={[styles.rule, { backgroundColor: colors.border }]} />
          <LegalContent content={doc.content} />
        </Card>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999, marginTop: 8 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 999,
  },
  docTitle: { fontSize: 18, fontWeight: '800' },
  docMeta: { fontSize: 12, marginTop: 4 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
});
