import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  ArrowUpLeft,
  Clock,
  Mic,
  Search,
  ShoppingBasket,
  X,
} from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { CATEGORIES } from '@/components/products/CategoryFilter';
import type { ProductDTO } from '@/components/products/ProductCard';
import { Product } from '@/api/entities';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { useHomeSearch } from '@/stores/homeSearch';
import { useSearchHistory } from '@/stores/searchHistory';
import { useVoiceProductSearch } from '@/hooks/useVoiceProductSearch';
import { VoiceListeningOverlay } from '@/components/search/VoiceListeningOverlay';
import { findMatchIndex } from '@/utils/searchText';
import type { RootStackParamList } from '@/navigation/types';

/** Nombre maximum de suggestions affichées sous le champ. */
const MAX_PRODUCT_SUGGESTIONS = 8;
const MAX_CATEGORY_SUGGESTIONS = 3;

type Suggestion =
  | { kind: 'product'; term: string; product: ProductDTO }
  | { kind: 'term'; term: string }
  | { kind: 'recent'; term: string };

/**
 * Écran de recherche plein écran, ouvert par l'onglet 🔍 de la barre du bas.
 *
 * Comportement calqué sur les grandes marketplaces : champ en haut avec
 * retour arrière, suggestions live issues du catalogue (partie déjà saisie en
 * clair, complétion en gras), flèche ↖ pour recopier une suggestion dans le
 * champ sans lancer la recherche, et historique des recherches quand le champ
 * est vide. Valider une suggestion applique le terme au catalogue de
 * l'accueil (via `useHomeSearch`) et y renvoie l'utilisateur.
 */
export const SearchScreen: React.FC = () => {
  const { colors } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');

  const applyQuery = useHomeSearch((s) => s.applyQuery);
  const history = useSearchHistory((s) => s.terms);
  const hydrateHistory = useSearchHistory((s) => s.hydrate);
  const pushHistory = useSearchHistory((s) => s.push);
  const removeHistory = useSearchHistory((s) => s.remove);
  const clearHistory = useSearchHistory((s) => s.clear);

  useEffect(() => {
    void hydrateHistory();
  }, [hydrateHistory]);

  /* Même `queryKey` que l'accueil : le catalogue déjà chargé est réutilisé. */
  const { data, isLoading } = useQuery<ProductDTO[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const list = (await Product().list?.()) as ProductDTO[] | undefined;
      return list ?? [];
    },
  });

  /** Applique la recherche au catalogue de l'accueil et y retourne. */
  const runSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      pushHistory(trimmed);
      applyQuery(trimmed);
      nav.navigate('ClientTabs', { screen: 'HomeTab' });
    },
    [applyQuery, nav, pushHistory],
  );

  /** Titres du catalogue : aident la dictée à reconnaître les noms de marque. */
  const voiceHints = useMemo(() => (data ?? []).map((p) => p.name ?? ''), [data]);
  /** La phrase dictée reste dans le champ, puis part dans la recherche. */
  const onVoiceDetected = useCallback(
    (text: string) => {
      setQuery(text);
      runSearch(text);
    },
    [runSearch],
  );
  const { listening, transcript, startVoiceSearch, stopVoiceSearch, cancelVoiceSearch } =
    useVoiceProductSearch(onVoiceDetected, voiceHints);

  const suggestions = useMemo((): Suggestion[] => {
    const q = query.trim();
    if (!q) return history.map((term) => ({ kind: 'recent' as const, term }));

    const products = (data ?? [])
      .map((product) => ({ product, idx: findMatchIndex(product.name ?? '', q) }))
      .filter((row) => row.idx >= 0)
      .sort((a, b) =>
        a.idx !== b.idx
          ? a.idx - b.idx
          : (a.product.name ?? '').localeCompare(b.product.name ?? '', 'fr', {
              sensitivity: 'base',
            }),
      )
      .slice(0, MAX_PRODUCT_SUGGESTIONS)
      .map(
        (row): Suggestion => ({
          kind: 'product',
          term: row.product.name ?? '',
          product: row.product,
        }),
      );

    /* Rayons dont le nom correspond, et qui contiennent au moins un produit. */
    const usedCategories = new Set((data ?? []).map((p) => p.category).filter(Boolean));
    const categories = CATEGORIES.filter(
      (c) => c.id !== 'all' && usedCategories.has(c.id) && findMatchIndex(c.label, q) >= 0,
    )
      .slice(0, MAX_CATEGORY_SUGGESTIONS)
      .map((c): Suggestion => ({ kind: 'term', term: c.label }));

    return [...products, ...categories];
  }, [data, history, query]);

  const showingHistory = query.trim().length === 0;

  const renderSuggestionLabel = useCallback(
    (term: string) => {
      const q = query.trim();
      const idx = q ? findMatchIndex(term, q) : -1;
      if (idx < 0) {
        return (
          <Text style={[styles.rowLabel, { color: colors.foreground }]} numberOfLines={1}>
            {term}
          </Text>
        );
      }
      /* Partie déjà saisie en clair, complétion en gras (cf. Amazon). */
      const end = idx + q.length;
      return (
        <Text style={[styles.rowLabel, { color: colors.foreground }]} numberOfLines={1}>
          {term.slice(0, end)}
          <Text style={styles.rowLabelStrong}>{term.slice(end)}</Text>
        </Text>
      );
    },
    [colors.foreground, query],
  );

  const renderRow = useCallback(
    ({ item }: { item: Suggestion }) => {
      const isRecent = item.kind === 'recent';
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            isRecent ? `Relancer la recherche ${item.term}` : `Rechercher ${item.term}`
          }
          onPress={() => runSearch(item.term)}
          android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
          style={[styles.row, { borderBottomColor: colors.border }]}
        >
          <View style={[styles.rowIcon, { backgroundColor: colors.surfaceMuted }]}>
            {item.kind === 'product' && item.product.image_url ? (
              <Image
                source={{ uri: item.product.image_url }}
                style={styles.rowThumb}
                contentFit="contain"
                transition={120}
              />
            ) : item.kind === 'product' ? (
              <ShoppingBasket size={18} color={colors.mutedForeground} />
            ) : isRecent ? (
              <Clock size={18} color={colors.mutedForeground} />
            ) : (
              <Search size={18} color={colors.mutedForeground} />
            )}
          </View>

          <View style={styles.rowTextCol}>{renderSuggestionLabel(item.term)}</View>

          {isRecent ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Retirer ${item.term} de l'historique`}
              onPress={() => removeHistory(item.term)}
              hitSlop={10}
              style={styles.rowAction}
            >
              <X size={18} color={colors.mutedForeground} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Compléter avec ${item.term}`}
              onPress={() => setQuery(item.term)}
              hitSlop={10}
              style={styles.rowAction}
            >
              <ArrowUpLeft size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        </Pressable>
      );
    },
    [colors.border, colors.mutedForeground, colors.surfaceMuted, removeHistory, renderSuggestionLabel, runSearch],
  );

  return (
    <Screen scroll={false} paddingHorizontal={0} bg={colors.background}>
      <View style={[styles.header, { backgroundColor: palette.brand.orange }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer la recherche"
          onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate('ClientTabs', { screen: 'HomeTab' }))}
          hitSlop={10}
          style={styles.backBtn}
        >
          <ArrowLeft size={22} color="#FFF" />
        </Pressable>

        <View style={styles.searchPill}>
          <Search size={18} color={palette.slate[500]} />
          <TextInput
            accessibilityLabel="Rechercher un produit"
            keyboardAppearance="light"
            autoFocus
            placeholder="Rechercher un produit…"
            placeholderTextColor={palette.slate[400]}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runSearch(query)}
            returnKeyType="search"
            autoCorrect={false}
            style={styles.searchInput}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Effacer la recherche"
              onPress={() => setQuery('')}
              hitSlop={10}
              style={styles.pillBtn}
            >
              <X size={18} color={palette.slate[500]} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Rechercher à la voix"
              onPress={() => void startVoiceSearch()}
              hitSlop={10}
              style={styles.pillBtn}
              testID="search-voice"
            >
              <Mic size={18} color={palette.slate[500]} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList<Suggestion>
        data={suggestions}
        keyExtractor={(item, idx) => `${item.kind}:${item.term}:${idx}`}
        renderItem={renderRow}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          showingHistory && history.length > 0 ? (
            <View style={styles.historyHeader}>
              <Text style={[styles.historyTitle, { color: colors.mutedForeground }]}>
                Recherches récentes
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Effacer l'historique de recherche"
                onPress={clearHistory}
                hitSlop={8}
              >
                <Text style={[styles.historyClear, { color: colors.brandOrange }]}>
                  Tout effacer
                </Text>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {isLoading ? (
              <ActivityIndicator color={palette.brand.orange} />
            ) : (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {showingHistory
                  ? 'Tapez le nom d’un produit — vos recherches récentes s’afficheront ici.'
                  : `Aucun produit ne correspond à « ${query.trim()} ».`}
              </Text>
            )}
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
      <VoiceListeningOverlay
        visible={listening}
        transcript={transcript}
        onStop={stopVoiceSearch}
        onCancel={cancelVoiceSearch}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: '#FFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: 44,
    paddingVertical: 0,
    color: palette.slate[900],
  },
  pillBtn: {
    paddingHorizontal: 2,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  historyClear: {
    fontSize: 13,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowThumb: {
    width: '100%',
    height: '100%',
  },
  rowTextCol: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
  },
  rowLabelStrong: {
    fontWeight: '800',
  },
  rowAction: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  empty: {
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
