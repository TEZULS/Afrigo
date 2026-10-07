import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  Animated,
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
import { X, Menu, ArrowUp, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/ui/Screen';
import { Loader } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductCard, ProductDTO } from '@/components/products/ProductCard';
import { CategoryFilter } from '@/components/products/CategoryFilter';
import { ShopModeSegment } from '@/components/home/ShopModeSegment';
import { WelcomeMessageDialog } from '@/components/home/WelcomeMessageDialog';
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
import { selectNewProducts } from '@/utils/newProducts';
import { nextHeaderCollapse } from '@/utils/headerCollapse';

const H_PAD = 16;
const GRID_GAP = 12;
/** Nombre de produits montrés dans les sections « Promotions » / « Nouveaux produits ». */
const HOME_TEASER_SIZE = 2;
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

  /**
   * Flèche flottante « retour en haut » : n'apparaît qu'une fois la liste
   * bien défilée (comme sur le web), pour ne pas gêner le sélecteur de rayon.
   * Le seuil est appliqué dans le handler pour ne re-rendre qu'au changement
   * d'état, pas à chaque événement de scroll.
   */
  const [showScrollTop, setShowScrollTop] = useState(false);
  /**
   * En-tête réduit : le bandeau AfriGo / Bonjour, le sélecteur de rayon et les
   * catégories restent épinglés en haut pendant le défilement, mais rétrécissent
   * **progressivement** — chaque taille suit le défilement au pixel près au lieu
   * de basculer d'un coup au franchissement d'un seuil.
   */
  const headerProgress = useRef(new Animated.Value(0)).current;
  const hdr = useMemo(() => {
    const to = (from: number, toValue: number) =>
      headerProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [from, toValue],
        extrapolate: 'clamp',
      });
    return {
      paddingTop: to(4, 0),
      paddingBottom: to(12, 6),
      brand: to(28, 20),
      greeting: to(16, 13.5),
      greetingPadV: to(6, 2),
      menuSize: to(40, 34),
      menuRadius: to(12, 10),
      shopModeTop: to(GRID_GAP, 6),
      shopModeBottom: to(6, 2),
      categoryTop: to(8, 4),
      categoryBottom: to(4, 2),
    };
  }, [headerProgress]);
  /** Dernière valeur de repli appliquée (voir `nextHeaderCollapse`). */
  const lastCollapse = useRef(0);
  const onListScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const past = y > SCROLL_TOP_THRESHOLD;
      setShowScrollTop((prev) => (prev === past ? prev : past));
      const next = nextHeaderCollapse(lastCollapse.current, y);
      if (next !== null) {
        lastCollapse.current = next;
        headerProgress.setValue(next);
      }
    },
    [headerProgress],
  );

  /**
   * Remonte tout en haut de la liste produits (logo « AfriGo » et flèche
   * flottante).
   *
   * On pilote directement le ScrollView sous-jacent (`scrollTo`) : contrairement
   * à `scrollToLocation`, il ne dépend pas des métriques des cellules
   * virtualisées (cellules du haut démontées après un long défilement). La
   * flèche est masquée dès l'appui — retour visuel immédiat — et `onScroll` la
   * réaffiche de lui-même si la liste est toujours loin du haut.
   *
   * NB : la panne « la flèche ne fait rien » venait de NativeWind, qui perdait
   * la `ref` interne du ScrollView (cf. `babel.config.js`) ; sans elle,
   * `scrollTo` comme `scrollToLocation` étaient des no-op sur l'appareil.
   */
  const scrollToTop = useCallback(() => {
    setShowScrollTop(false);
    const list = listRef.current;
    if (!list) return;
    const scrollView = list.getScrollResponder?.() as
      | { scrollTo?: (opts: { x?: number; y: number; animated?: boolean }) => void }
      | null
      | undefined;
    if (scrollView?.scrollTo) {
      scrollView.scrollTo({ x: 0, y: 0, animated: true });
      return;
    }
    list.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: true, viewPosition: 0 });
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
  /** Nouveautés : mêmes règles que le site (créés depuis 7 jours, plus récents d'abord). */
  const newProducts = useMemo(() => selectNewProducts(filtered), [filtered]);
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

  const regularPairs = useMemo(() => chunkProductPairs(regularProducts), [regularProducts]);

  /**
   * Le premier item de la section est un sentinel `__categories__`. Viennent
   * ensuite, quand il y en a : « Promotions » (2 produits max + « Voir + »
   * vers la page Promotions), « Nouveaux produits » (2 max + « Voir + »), puis
   * tout le catalogue sous « Nos produits ». Une seule SectionList est utilisée
   * pour bénéficier du sticky `renderSectionHeader` (search + ShopMode).
   */
  type Row =
    | { kind: 'heading'; title: string; emoji?: string; more?: () => void }
    | { kind: 'pair'; pair: ProductDTO[] };
  const sections = useMemo((): { title: string; data: Row[] }[] => {
    const data: Row[] = [];
    if (promoProducts.length > 0) {
      data.push({
        kind: 'heading',
        title: 'Promotions',
        emoji: '🏷️',
        more:
          promoProducts.length > HOME_TEASER_SIZE
            ? () => nav.navigate('ClientTabs', { screen: 'PromotionsTab' })
            : undefined,
      });
      data.push({ kind: 'pair', pair: promoProducts.slice(0, HOME_TEASER_SIZE) });
    }
    if (newProducts.length > 0) {
      data.push({
        kind: 'heading',
        title: 'Nouveaux produits',
        emoji: '✨',
        more:
          newProducts.length > HOME_TEASER_SIZE
            ? () => nav.navigate('ClientTabs', { screen: 'NewProductsTab' })
            : undefined,
      });
      data.push({ kind: 'pair', pair: newProducts.slice(0, HOME_TEASER_SIZE) });
    }
    if (regularPairs.length > 0 && (promoProducts.length > 0 || newProducts.length > 0)) {
      data.push({ kind: 'heading', title: 'Nos produits' });
    }
    regularPairs.forEach((pair) => data.push({ kind: 'pair' as const, pair }));
    return [{ title: '', data }];
  }, [promoProducts, newProducts, regularPairs, nav]);

  const listEmptyDescription =
    shopMode === 'cosmetique'
      ? 'Aucun article dans le rayon Cosmétiques pour le moment. Les nouveautés arrivent bientôt.'
      : 'Modifiez vos filtres ou votre recherche.';

  /**
   * Hauteurs de l'en-tête épinglé **replié** (le seul état où la flèche est
   * visible : elle n'apparaît qu'après un long défilement) : rayon ≈ 38 px,
   * barre de catégories ≈ 88 px. La flèche se pose juste en dessous.
   */
  const scrollTopOffset = useMemo(
    () => (hasCosmetiques ? 38 : 0) + (availableCategories.length > 1 ? 88 : 0) + 10,
    [hasCosmetiques, availableCategories.length],
  );

  /**
   * Filtres circulaires (Tous / Fruits…) — dans l'en-tête épinglé de la
   * section, sous le sélecteur de rayon : restent visibles en défilant
   * (version réduite dès que la liste bouge).
   */
  const renderCategoryRow = useCallback(() => {
    /*
      Aucun produit dans le rayon courant (typiquement « Cosmétiques » encore
      vide) → pas de pastille de catégorie du tout, donc pas de barre ni de
      séparateur à afficher.
    */
    if (availableCategories.length === 0) return null;
    return (
      <Animated.View
        style={[
          styles.scrollCategoryBar,
          {
            paddingTop: hdr.categoryTop,
            paddingBottom: hdr.categoryBottom,
            backgroundColor: colors.background,
          },
        ]}
      >
        <CategoryFilter
          selected={category}
          onSelect={setCategory}
          availableCategories={availableCategories}
          shopMode={shopMode}
          horizontalInset={H_PAD}
          progress={headerProgress}
        />
      </Animated.View>
    );
  }, [category, availableCategories, shopMode, hdr, headerProgress, colors.background]);

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
      <View style={{ backgroundColor: colors.background }}>
        {/* ShopMode (Alimentation/Cosmétiques) sur fond blanc — masqué tant
            qu'aucun produit cosmétique n'existe au catalogue. */}
        {hasCosmetiques ? (
          <Animated.View
            style={[
              styles.stickyShopMode,
              {
                paddingTop: hdr.shopModeTop,
                paddingBottom: hdr.shopModeBottom,
                backgroundColor: colors.background,
              },
            ]}
          >
            <ShopModeSegment mode={shopMode} onChange={setShopMode} progress={headerProgress} />
          </Animated.View>
        ) : null}
        {renderCategoryRow()}
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
    [
      shopMode,
      hasCosmetiques,
      search,
      hdr,
      headerProgress,
      renderCategoryRow,
      colors.background,
      colors.surfaceMuted,
      colors.border,
      colors.foreground,
    ],
  );


  const renderRow = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === 'heading') {
        return (
          <View style={[styles.sectionHeading, { paddingHorizontal: H_PAD }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]} numberOfLines={1}>
              {item.emoji ? `${item.emoji} ` : ''}
              {item.title}
            </Text>
            {item.more ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Voir tous les ${item.title.toLowerCase()}`}
                onPress={item.more}
                hitSlop={8}
                style={styles.seeMore}
                testID={`home-see-more-${item.title}`}
              >
                <Text style={[styles.seeMoreText, { color: palette.brand.orange }]}>Voir plus</Text>
                <ChevronRight size={16} color={palette.brand.orange} />
              </Pressable>
            ) : null}
          </View>
        );
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
                    vatRate: p.vat_rate ?? null,
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
    [cart, cartQty, customerEmail, listInnerPad, horizontalPad, colors.foreground],
  );

  const renderProductsList = () => (
    <SectionList<Row>
      ref={listRef as unknown as React.Ref<SectionList<Row>>}
      style={styles.list}
      sections={sections}
      /* En-tête de section épinglé : rayon + catégories restent en haut en défilant. */
      stickySectionHeadersEnabled
      keyExtractor={(item, idx) =>
        item.kind === 'heading'
          ? `heading:${item.title}`
          : item.pair.map((p) => p.id).join('-') + ':' + idx
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
      /* 16 ms : l'en-tête suit le doigt image par image (repli progressif). */
      scrollEventThrottle={16}
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
        <Animated.View
          style={[
            styles.header,
            {
              paddingTop: hdr.paddingTop,
              paddingBottom: hdr.paddingBottom,
              backgroundColor: colors.surfaceMuted,
            },
          ]}
        >
          <View style={styles.brandRow}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="AfriGo — retour en haut"
              onPress={scrollToTop}
              hitSlop={6}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
              style={styles.brandBtn}
            >
              <Animated.Text
                style={[styles.brand, { fontSize: hdr.brand, color: colors.brandOrange }]}
              >
                AfriGo
              </Animated.Text>
            </Pressable>
            {/*
              Bloc de droite : salutation (ou bouton de connexion) suivi du
              bouton ☰ — le menu a quitté la barre du bas pour venir ici, à
              côté du « Bonjour ».
            */}
            <View style={styles.headerActions}>
              {isAuthenticated && firstName ? (
                /* Simple libellé : le profil s'ouvre depuis le menu ☰. */
                <Animated.View style={[styles.greeting, { paddingVertical: hdr.greetingPadV }]}>
                  <Animated.Text
                    style={[styles.greetingText, { fontSize: hdr.greeting, color: colors.foreground }]}
                    numberOfLines={1}
                  >
                    Bonjour, {firstName}
                  </Animated.Text>
                </Animated.View>
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
                style={styles.menuBtnHit}
              >
                <Animated.View
                  style={[
                    styles.menuBtn,
                    {
                      width: hdr.menuSize,
                      height: hdr.menuSize,
                      borderRadius: hdr.menuRadius,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Menu size={20} color={colors.foreground} />
                </Animated.View>
              </Pressable>
            </View>
          </View>
        </Animated.View>

        <View style={[styles.listArea, { backgroundColor: colors.background }]}>
          {/*
            La SectionList rend :
            - SectionHeader : ShopMode (si cosmétiques) + puce de recherche
            - 1er item de la section : filtres catégories (scroll)
            - items suivants : paires de produits
          */}
          {renderProductsList()}
          {/*
            Calque flottant au-dessus de la liste (dernier enfant → au-dessus
            dans l'ordre de rendu ET de hit-test, sur les deux plateformes).
            `box-none` : le calque lui-même laisse passer les touches vers la
            liste ; seule la flèche les capte.
          */}
          {showScrollTop ? (
            <View style={styles.scrollTopLayer} pointerEvents="box-none">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retour en haut de la page"
                testID="home-scroll-top"
                onPress={scrollToTop}
                hitSlop={12}
                android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true, radius: 22 }}
                style={[
                  styles.scrollTopBtn,
                  { top: scrollTopOffset, backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <ArrowUp size={18} color={colors.foreground} strokeWidth={2.5} />
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      {/* Message de bienvenue configuré par l'admin (WelcomeMessage), comme sur le site. */}
      <WelcomeMessageDialog />
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
  menuBtnHit: { flexShrink: 0 },
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
  /** Catégories (Tous / Fruits & Légumes / …) — épinglées sous le rayon. */
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
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  seeMore: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 4, paddingLeft: 8 },
  seeMoreText: { fontSize: 13, fontWeight: '700' },
  productRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  gridCell: {
    width: '50%',
  },
  /** Calque plein écran (transparent aux touches) qui porte la flèche flottante. */
  scrollTopLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    ...Platform.select({ android: { elevation: 6 }, default: {} }),
  },
  /**
   * Flèche flottante « retour en haut » — à gauche comme sur le web, mais posée
   * sous l'en-tête épinglé (`top` calculé dans l'écran) pour ne pas recouvrir le
   * sélecteur de rayon ni les pastilles de catégories.
   */
  scrollTopBtn: {
    position: 'absolute',
    left: H_PAD,
    width: 40,
    height: 40,
    borderRadius: 20,
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
