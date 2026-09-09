import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Platform,
  Pressable,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { X, Menu, ArrowUp } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/ui/Screen';
import { Loader } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductCard, ProductDTO } from '@/components/products/ProductCard';
import { CategoryFilter } from '@/components/products/CategoryFilter';
import { ShopModeSegment } from '@/components/home/ShopModeSegment';
import { useCart } from '@/stores/cart';
import { useMenuDrawer } from '@/stores/menuDrawer';
import { useHomeSearch } from '@/stores/homeSearch';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/lib/AuthContext';
import { Product } from '@/api/entities';
import { passesShopMode } from '@/utils/productShopMode';
import { isCosmetiqueCategory } from '@/utils/categories';
import {
  remoteDecrementAfterRemove,
  remoteUpsertAfterAdd,
} from '@/lib/cartRemote';
import { palette } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';
import { sellingPrice } from '@/utils/productPricing';

const H_PAD = 16;
const GRID_GAP = 12;
/** Défilement (px) au-delà duquel la flèche « retour en haut » apparaît. */
const SCROLL_TOP_THRESHOLD = 480;

function chunkProductPairs(rows: ProductDTO[]): ProductDTO[][] {
  const out: ProductDTO[][] = [];
  for (let i = 0; i < rows.length; i += 2) {
    out.push(rows.slice(i, i + 2));
  }
  return out;
}

export const HomeScreen: React.FC = () => {
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const listRef = useRef<SectionList<unknown>>(null);

  /** Tap sur le logo « AfriGo » : remonte tout en haut de la liste produits. */
  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToLocation({
      sectionIndex: 0,
      itemIndex: 0,
      animated: true,
      viewPosition: 0,
    });
  }, []);

  /**
   * Flèche flottante « retour en haut » : n'apparaît qu'une fois la liste
   * bien défilée (comme sur le web), pour ne pas gêner le sélecteur de rayon.
   * Le seuil est appliqué dans le handler pour ne re-rendre qu'au changement
   * d'état, pas à chaque événement de scroll.
   */
  const [showScrollTop, setShowScrollTop] = useState(false);
  const onListScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const past = e.nativeEvent.contentOffset.y > SCROLL_TOP_THRESHOLD;
    setShowScrollTop((prev) => (prev === past ? prev : past));
  }, []);

  const userObj = user as Record<string, unknown> | null;
  const firstName =
    (userObj?.first_name as string | undefined) ??
    (userObj?.full_name as string | undefined)?.split(' ')[0] ??
    (userObj?.email as string | undefined)?.split('@')[0] ??
    '';

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [shopMode, setShopMode] = useState<'food' | 'cosmetique'>('food');

  const cart = useCart();
  const openMenu = useMenuDrawer((s) => s.open);
  const appliedQuery = useHomeSearch((s) => s.query);
  const appliedQueryToken = useHomeSearch((s) => s.queryToken);

  /**
   * L'écran de recherche plein écran (onglet 🔍) pousse le terme validé dans
   * `useHomeSearch` : on l'applique au catalogue et on remonte en haut.
   */
  useEffect(() => {
    if (appliedQueryToken === 0) return;
    setSearch(appliedQuery);
    setCategory('all');
    listRef.current?.scrollToLocation({
      sectionIndex: 0,
      itemIndex: 0,
      animated: true,
      viewPosition: 0,
    });
  }, [appliedQuery, appliedQueryToken]);

  useEffect(() => {
    setCategory('all');
  }, [shopMode]);

  const { data, isLoading, refetch, isRefetching } = useQuery<ProductDTO[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const list = (await Product().list?.()) as ProductDTO[] | undefined;
      return list ?? [];
    },
  });

  /**
   * Catalogue réellement visible par ce client — mêmes règles que le web
   * déployé : produit désactivé masqué, et `allowed_tiers` doit contenir le
   * niveau de fidélité du client (les produits sans liste sont ouverts à
   * tous).
   */
  const customerTier = (userObj?.customer_tier as string | undefined) ?? 'normal';
  const catalogue = useMemo(
    () =>
      (data ?? []).filter((p) => {
        if (p.is_active === false) return false;
        const tiers = p.allowed_tiers;
        return !Array.isArray(tiers) || tiers.length === 0 || tiers.includes(customerTier);
      }),
    [data, customerTier],
  );

  /**
   * Y a-t-il au moins un cosmétique au catalogue visible ? Sinon le sélecteur
   * Alimentation/Cosmétiques n'a aucun intérêt : on le masque complètement
   * (le catalogue est alors 100 % alimentaire).
   *
   * Le stock n'entre pas en compte : un produit épuisé reste listé (avec sa
   * pastille « Épuisé »), masquer son rayon le rendrait inatteignable.
   */
  const hasCosmetiques = useMemo(
    () => catalogue.some((p) => isCosmetiqueCategory(p.category)),
    [catalogue],
  );

  /* Le rayon cosmétiques se vide alors qu'il est affiché → retour sur food. */
  useEffect(() => {
    if (!hasCosmetiques && shopMode === 'cosmetique') setShopMode('food');
  }, [hasCosmetiques, shopMode]);

  const modeFiltered = useMemo(
    () => catalogue.filter((p) => passesShopMode(p, shopMode)),
    [catalogue, shopMode],
  );

  const filtered = useMemo(() => {
    let arr = modeFiltered;
    if (category !== 'all') arr = arr.filter((p) => p.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((p) => p.name.toLowerCase().includes(q));
    }
    return [...arr].sort((a, b) =>
      (a.name ?? '').localeCompare(b.name ?? '', 'fr', {
        sensitivity: 'base',
        numeric: true,
      }),
    );
  }, [modeFiltered, category, search]);

  /**
   * Sépare le catalogue en deux groupes affichés dans des sections distinctes :
   * - « 🏷️ Promotions » d'abord (produits avec is_promotion + promotion_price)
   * - « Nos produits » ensuite (le reste du catalogue trié alphabétiquement)
   */
  const promoProducts = useMemo(
    () => filtered.filter((p) => p.is_promotion && p.promotion_price != null),
    [filtered],
  );
  const regularProducts = useMemo(
    () => filtered.filter((p) => !(p.is_promotion && p.promotion_price != null)),
    [filtered],
  );

  const availableCategories = useMemo(
    () => Array.from(new Set(modeFiltered.map((p) => p.category).filter(Boolean) as string[])),
    [modeFiltered],
  );

  const cartQty = useCallback(
    (id: string) => cart.lines.find((l) => l.productId === id)?.quantity ?? 0,
    [cart.lines],
  );

  const customerEmail = user?.email;

  const listInnerPad = GRID_GAP / 2;
  const horizontalPad = listInnerPad + H_PAD / 2;

  const promoPairs = useMemo(() => chunkProductPairs(promoProducts), [promoProducts]);
  const regularPairs = useMemo(() => chunkProductPairs(regularProducts), [regularProducts]);

  /**
   * Le premier item de la section est un sentinel `__categories__`. Les
   * promotions sont placées en premier (sans titre), suivies du reste du
   * catalogue. Une seule SectionList est utilisée pour bénéficier du sticky
   * `renderSectionHeader` (search + ShopMode).
   */
  type Row = { kind: 'categories' } | { kind: 'pair'; pair: ProductDTO[] };
  const sections = useMemo((): { title: string; data: Row[] }[] => {
    const data: Row[] = [{ kind: 'categories' as const }];
    promoPairs.forEach((pair) => data.push({ kind: 'pair' as const, pair }));
    regularPairs.forEach((pair) => data.push({ kind: 'pair' as const, pair }));
    return [{ title: '', data }];
  }, [promoPairs, regularPairs]);

  const listEmptyDescription =
    shopMode === 'cosmetique'
      ? 'Aucun article dans le rayon Cosmétiques pour le moment. Les nouveautés arrivent bientôt.'
      : 'Modifiez vos filtres ou votre recherche.';

  /**
   * En-tête de section : segment Alimentation/Cosmétiques (fond blanc,
   * uniquement s'il existe au moins un cosmétique disponible), puis — le cas
   * échéant — le rappel du terme recherché.
   *
   * La barre de recherche a été retirée de l'accueil : la recherche se fait
   * désormais uniquement depuis l'onglet 🔍 (qui embarque aussi la recherche
   * par photo). Quand cet écran pousse un terme ici, on affiche une puce
   * « Recherche : … ✕ » pour que le filtre reste visible et annulable.
   */
  const renderSectionHeader = useCallback(
    () => (
      <View>
        {/* ShopMode (Alimentation/Cosmétiques) sur fond blanc — masqué tant
            qu'aucun produit cosmétique n'existe au catalogue. */}
        {hasCosmetiques ? (
          <View style={[styles.stickyShopMode, { backgroundColor: colors.background }]}>
            <ShopModeSegment mode={shopMode} onChange={setShopMode} />
          </View>
        ) : null}
        {search.trim() ? (
          <View style={[styles.searchChipRow, { backgroundColor: colors.background }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Effacer la recherche « ${search} »`}
              onPress={() => setSearch('')}
              style={[
                styles.searchChip,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
            >
              <Text style={[styles.searchChipText, { color: colors.foreground }]} numberOfLines={1}>
                Recherche : {search.trim()}
              </Text>
              <X size={16} color={palette.brand.orange} strokeWidth={2.5} />
            </Pressable>
          </View>
        ) : null}
      </View>
    ),
    [shopMode, hasCosmetiques, search, colors.background, colors.surfaceMuted, colors.border, colors.foreground],
  );

  /**
   * Filtres circulaires (Tous / Fruits…) — rendu comme PREMIER item de la
   * section data : défile naturellement avec les produits.
   */
  const renderCategoryRow = useCallback(() => {
    /*
      Aucun produit dans le rayon courant (typiquement « Cosmétiques » encore
      vide) → pas de pastille de catégorie du tout, donc pas de barre ni de
      séparateur à afficher.
    */
    if (availableCategories.length === 0) return null;
    return (
      <View style={[styles.scrollCategoryBar, { backgroundColor: colors.background }]}>
        <CategoryFilter
          selected={category}
          onSelect={setCategory}
          availableCategories={availableCategories}
          shopMode={shopMode}
          horizontalInset={H_PAD}
        />
      </View>
    );
  }, [category, availableCategories, shopMode, colors.background]);

  const renderRow = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === 'categories') {
        return renderCategoryRow();
      }
      const pair = item.pair;
      return (
        <View
          style={[
            styles.productRow,
            { marginBottom: GRID_GAP, paddingHorizontal: horizontalPad },
          ]}
        >
          {pair.map((product) => (
            <View
              key={product.id}
              style={[styles.gridCell, { paddingHorizontal: listInnerPad }]}
            >
              <ProductCard
                product={product}
                cartQuantity={cartQty(product.id)}
                onAddToCart={(p) => {
                  const line = {
                    productId: p.id,
                    name: p.name,
                    imageUrl: p.image_url,
                    unitPrice: sellingPrice(p),
                    category: p.category,
                    unit: p.unit,
                  };
                  cart.add(line);
                  if (customerEmail) void remoteUpsertAfterAdd(customerEmail, { ...line, quantity: 1 });
                }}
                onRemoveFromCart={(p) => {
                  cart.remove(p.id);
                  if (customerEmail) void remoteDecrementAfterRemove(customerEmail, p.id);
                }}
              />
            </View>
          ))}
          {pair.length === 1 ? (
            <View style={[styles.gridCell, { paddingHorizontal: listInnerPad }]} />
          ) : null}
        </View>
      );
    },
    [cart, cartQty, customerEmail, renderCategoryRow, listInnerPad, horizontalPad],
  );

  const renderProductsList = () => (
    <SectionList<Row>
      ref={listRef as unknown as React.Ref<SectionList<Row>>}
      style={styles.list}
      sections={sections}
      /* Sticky natif désactivé : le sélecteur de rayon défile avec la liste. */
      stickySectionHeadersEnabled={false}
      keyExtractor={(item, idx) =>
        item.kind === 'categories' ? 'cats' : item.pair.map((p) => p.id).join('-') + ':' + idx
      }
      renderSectionHeader={renderSectionHeader}
      renderItem={renderRow}
      contentContainerStyle={[
        styles.listContent,
        { paddingBottom: 100 },
      ]}
      refreshing={isRefetching}
      onRefresh={refetch}
      onScroll={onListScroll}
      scrollEventThrottle={100}
      showsVerticalScrollIndicator={false}
      initialNumToRender={8}
      windowSize={5}
      removeClippedSubviews={Platform.OS === 'android'}
      ListFooterComponent={<View style={{ height: 8 }} />}
      ListEmptyComponent={
        isLoading ? (
          <View style={[styles.listState, { minHeight: 280, paddingHorizontal: horizontalPad }]}>
            <Loader />
          </View>
        ) : (
          <View style={[styles.emptyWithHeaderPad, { paddingHorizontal: horizontalPad }]}>
            <EmptyState
              title={shopMode === 'cosmetique' ? 'Pas encore de cosmétiques' : 'Aucun produit'}
              description={listEmptyDescription}
            />
          </View>
        )
      }
    />
  );

  return (
    <Screen scroll={false} paddingHorizontal={0} bg={colors.surfaceMuted}>
      <View style={styles.shell}>
        <View style={[styles.header, { backgroundColor: colors.surfaceMuted }]}>
          <View style={styles.brandRow}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="AfriGo — retour en haut"
              onPress={scrollToTop}
              hitSlop={6}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
              style={styles.brandBtn}
            >
              <Text style={[styles.brand, { color: colors.brandOrange }]}>AfriGo</Text>
            </Pressable>
            {/*
              Bloc de droite : salutation (ou bouton de connexion) suivi du
              bouton ☰ — le menu a quitté la barre du bas pour venir ici, à
              côté du « Bonjour ».
            */}
            <View style={styles.headerActions}>
              {isAuthenticated && firstName ? (
                /* Simple libellé : le profil s'ouvre depuis le menu ☰. */
                <View style={styles.greeting}>
                  <Text
                    style={[styles.greetingText, { color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    Bonjour, {firstName}
                  </Text>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Se connecter ou s'inscrire"
                  onPress={() => nav.navigate('Login', { initialMode: 'login' })}
                  android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
                  style={[styles.connectBtn, { backgroundColor: palette.brand.orange }]}
                >
                  <Text style={styles.connectBtnText}>S&apos;inscrire/Se connecter</Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ouvrir le menu"
                onPress={() => openMenu('HomeTab')}
                hitSlop={8}
                android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true, radius: 22 }}
                style={[styles.menuBtn, { borderColor: colors.border }]}
              >
                <Menu size={20} color={colors.foreground} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.listArea, { backgroundColor: colors.background }]}>
          {/*
            La SectionList rend :
            - SectionHeader : ShopMode (si cosmétiques) + puce de recherche
            - 1er item de la section : filtres catégories (scroll)
            - items suivants : paires de produits
          */}
          {renderProductsList()}
          {showScrollTop ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retour en haut de la page"
              onPress={scrollToTop}
              hitSlop={8}
              android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true, radius: 26 }}
              style={[styles.scrollTopBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <ArrowUp size={22} color={colors.foreground} strokeWidth={2.5} />
            </Pressable>
          ) : null}
        </View>
      </View>

    </Screen>
  );
};

const styles = StyleSheet.create({
  shell: { flex: 1 },
  header: {
    paddingHorizontal: H_PAD,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 4,
    gap: 8,
  },
  brand: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    flexShrink: 0,
  },
  brandBtn: {
    paddingVertical: 4,
    paddingRight: 4,
    flexShrink: 0,
  },
  /** Puce « Recherche : … ✕ » affichée quand l'onglet 🔍 a poussé un terme. */
  searchChipRow: {
    paddingHorizontal: H_PAD,
    paddingTop: 10,
  },
  searchChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '100%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  searchChipText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  greeting: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexShrink: 1,
  },
  greetingText: {
    fontSize: 16,
    fontWeight: '700',
  },
  connectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexShrink: 1,
  },
  connectBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  listArea: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    /** `overflow: 'hidden'` casse les en-têtes sticky de SectionList sur la plupart des builds. */
    overflow: 'visible',
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        }
      : { elevation: 2 }),
  },
  list: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  listContent: {
    flexGrow: 1,
    paddingTop: 0,
    paddingBottom: 24,
  },
  /** ShopMode (Alimentation/Cosmétiques) — fixé au-dessus de la SectionList. */
  stickyShopMode: {
    paddingHorizontal: H_PAD,
    paddingTop: GRID_GAP,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15,23,42,0.06)',
  },
  /** Catégories (Tous / Fruits & Légumes / …) — défile avec le catalogue. */
  scrollCategoryBar: {
    paddingTop: 8,
    paddingBottom: 4,
    /** Trait et ombre très légers (pas « cadre » brut ni forte élévation Android). */
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15,23,42,0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.045,
        shadowRadius: 2,
      },
      android: { elevation: 0 },
      default: {},
    }),
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  gridCell: {
    width: '50%',
  },
  /** Flèche flottante « retour en haut » — en haut à gauche, comme sur le web. */
  scrollTopBtn: {
    position: 'absolute',
    top: 12,
    left: H_PAD,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  listState: { flex: 1, justifyContent: 'center', minHeight: 200 },
  emptyWithHeaderPad: { paddingTop: 8, paddingBottom: 24 },
});
