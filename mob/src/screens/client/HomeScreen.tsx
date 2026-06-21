import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Platform,
  Pressable,
  Alert,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Search, Camera, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '@/components/ui/Screen';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductCard, ProductDTO } from '@/components/products/ProductCard';
import { CategoryFilter } from '@/components/products/CategoryFilter';
import { ShopModeSegment } from '@/components/home/ShopModeSegment';
import { useCart } from '@/stores/cart';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/lib/AuthContext';
import { Product, UploadFile, InvokeLLM } from '@/api/entities';
import { useToast } from '@/hooks/useToast';
import { passesShopMode } from '@/utils/productShopMode';
import {
  remoteDecrementAfterRemove,
  remoteUpsertAfterAdd,
} from '@/lib/cartRemote';
import { palette } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

const H_PAD = 16;
const GRID_GAP = 12;

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

  const userObj = user as Record<string, unknown> | null;
  const firstName =
    (userObj?.first_name as string | undefined) ??
    (userObj?.full_name as string | undefined)?.split(' ')[0] ??
    (userObj?.email as string | undefined)?.split('@')[0] ??
    '';

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [shopMode, setShopMode] = useState<'food' | 'cosmetique'>('food');
  const [scanningImage, setScanningImage] = useState(false);

  const toast = useToast();
  const cart = useCart();

  /**
   * Recherche par image : upload la photo vers Base44 puis demande à l'IA
   * Vision d'identifier le(s) produit(s) visible(s). Le résultat (ex.
   * « Nestlé Pure Life ») est injecté dans la barre de recherche, ce qui
   * filtre automatiquement le catalogue côté client via `search`.
   */
  const analyzeProductImage = useCallback(
    async (uri: string) => {
      setScanningImage(true);
      toast.info('Analyse en cours…', 'Identification du produit sur la photo');
      try {
        const file = { uri, name: 'product.jpg', type: 'image/jpeg' } as unknown as File;
        const upload = (await UploadFile({ file })) as { file_url?: string; url?: string };
        const fileUrl = upload.file_url ?? upload.url;
        if (!fileUrl) {
          throw new Error('Upload sans URL retournée.');
        }

        const llm = (await InvokeLLM({
          prompt:
            "Analyse cette image et identifie le produit alimentaire ou cosmétique principal visible (marque + nom de produit). " +
            "Retourne UNIQUEMENT le ou les mots-clés à chercher dans un catalogue, séparés par des espaces. " +
            "Sois bref (1 à 4 mots), précis. Exemples: \"Nestlé Pure Life\", \"tomate\", \"Nutella\", \"savon karité\". " +
            "Si rien n'est identifiable, retourne une chaîne vide.",
          file_urls: [fileUrl],
          response_json_schema: {
            type: 'object',
            properties: {
              products: {
                type: 'string',
                description: 'Noms du/des produits détectés, séparés par des espaces',
              },
            },
          },
        } as Parameters<typeof InvokeLLM>[0])) as { products?: string } | string | undefined;

        const detected =
          (typeof llm === 'string' ? llm : llm?.products ?? '').trim();

        if (!detected) {
          toast.error('Aucun produit identifié', "Réessayez avec une photo plus nette.");
          return;
        }

        setSearch(detected);
        toast.success('Produit identifié', detected);
        listRef.current?.scrollToLocation({
          sectionIndex: 0,
          itemIndex: 0,
          animated: true,
          viewPosition: 0,
        });
      } catch (e) {
        toast.error('Recherche par image impossible', (e as Error).message);
      } finally {
        setScanningImage(false);
      }
    },
    [toast],
  );

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

  const modeFiltered = useMemo(
    () => (data ?? []).filter((p) => passesShopMode(p, shopMode)),
    [data, shopMode],
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
      ? 'Aucun article avec la catégorie « cosmetique » pour le moment. Les nouveautés arrivent bientôt.'
      : 'Modifiez vos filtres ou votre recherche.';

  /**
   * Bloc orange « Bienvenue sur AfriGo » + sous-titre — rendu comme
   * `ListHeaderComponent` de la SectionList → défile et disparaît quand on
   * scrolle vers le bas.
   */
  const renderWelcomeIntro = useCallback(
    () => (
      <View style={[styles.welcomeIntro, { backgroundColor: palette.brand.orange }]}>
        <Text style={styles.welcomeTitle}>Bienvenue sur AfriGo</Text>
        <Text style={styles.welcomeSubtitle}>
          Profitez de nos produits de qualité et nos bonus au quotidien
        </Text>
      </View>
    ),
    [],
  );

  /**
   * Section header sticky : barre de recherche (sur fond orange) + segment
   * Alimentation/Cosmétiques (sur fond blanc). Reste collé en haut quand
   * on scrolle.
   */
  const renderStickyHeader = useCallback(
    () => (
      <View>
        {/* Search row sur fond orange */}
        <View style={[styles.stickySearchBar, { backgroundColor: palette.brand.orange }]}>
          <View style={styles.searchRow}>
            <View style={[styles.searchPill, { backgroundColor: '#FFF' }]}>
              <Search size={18} color={colors.mutedForeground} />
              <TextInput
                accessibilityLabel="Rechercher un produit"
                placeholder="Rechercher un produit…"
                placeholderTextColor={colors.mutedForeground}
                value={search}
                onChangeText={setSearch}
                style={[styles.searchInput, { color: colors.foreground }]}
                returnKeyType="search"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Rechercher avec une photo"
                disabled={scanningImage}
                onPress={() => {
                  if (scanningImage) return;
                  Alert.alert(
                    'Recherche par image',
                    'Comment souhaitez-vous fournir la photo ?',
                    [
                      {
                        text: 'Prendre une photo',
                        onPress: async () => {
                          const perms = await ImagePicker.requestCameraPermissionsAsync();
                          if (!perms.granted) {
                            Alert.alert(
                              'Caméra refusée',
                              "L'accès à l'appareil photo est requis pour la recherche par image.",
                            );
                            return;
                          }
                          const r = await ImagePicker.launchCameraAsync({
                            mediaTypes: ['images'],
                            quality: 0.7,
                          });
                          if (!r.canceled && r.assets[0]?.uri) {
                            await analyzeProductImage(r.assets[0].uri);
                          }
                        },
                      },
                      {
                        text: 'Choisir dans la galerie',
                        onPress: async () => {
                          const perms = await ImagePicker.requestMediaLibraryPermissionsAsync();
                          if (!perms.granted) {
                            Alert.alert(
                              'Galerie refusée',
                              "L'accès à la galerie est requis pour la recherche par image.",
                            );
                            return;
                          }
                          const r = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ['images'],
                            quality: 0.7,
                          });
                          if (!r.canceled && r.assets[0]?.uri) {
                            await analyzeProductImage(r.assets[0].uri);
                          }
                        },
                      },
                      { text: 'Annuler', style: 'cancel' },
                    ],
                  );
                }}
                hitSlop={8}
                style={styles.cameraBtn}
              >
                {scanningImage ? (
                  <ActivityIndicator size="small" color={palette.brand.orange} />
                ) : (
                  <Camera size={20} color={colors.mutedForeground} />
                )}
              </Pressable>
            </View>
            {/*
              Quand l'utilisateur a saisi du texte, le bouton 🔎 devient un
              ❌ qui efface tout le contenu de la barre de recherche. Le tap
              vide `search` et lance un scroll en haut de liste pour
              rafraîchir l'affichage.
            */}
            {search.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Effacer la recherche"
                onPress={() => {
                  setSearch('');
                  listRef.current?.scrollToLocation({
                    sectionIndex: 0,
                    itemIndex: 0,
                    animated: true,
                    viewPosition: 0,
                  });
                }}
                style={[styles.searchBtn, { backgroundColor: '#FFF' }]}
                android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true, radius: 22 }}
              >
                <X size={20} color={palette.brand.orange} strokeWidth={2.5} />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Lancer la recherche"
                onPress={() => {
                  listRef.current?.scrollToLocation({
                    sectionIndex: 0,
                    itemIndex: 0,
                    animated: true,
                    viewPosition: 0,
                  });
                }}
                style={[styles.searchBtn, { backgroundColor: '#FFF' }]}
                android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true, radius: 22 }}
              >
                <Search size={20} color={palette.brand.orange} />
              </Pressable>
            )}
          </View>
        </View>
        {/* ShopMode (Alimentation/Cosmétiques) sur fond blanc */}
        <View style={[styles.stickyShopMode, { backgroundColor: colors.background }]}>
          <ShopModeSegment mode={shopMode} onChange={setShopMode} />
        </View>
      </View>
    ),
    [
      search,
      shopMode,
      scanningImage,
      analyzeProductImage,
      colors.mutedForeground,
      colors.foreground,
      colors.background,
    ],
  );

  /**
   * Filtres circulaires (Tous / Fruits…) — rendu comme PREMIER item de la
   * section data : défile naturellement avec les produits.
   */
  const renderCategoryRow = useCallback(
    () => (
      <View style={[styles.scrollCategoryBar, { backgroundColor: colors.background }]}>
        <CategoryFilter
          selected={category}
          onSelect={setCategory}
          availableCategories={availableCategories}
          shopMode={shopMode}
          horizontalInset={H_PAD}
        />
      </View>
    ),
    [category, availableCategories, shopMode, colors.background],
  );

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
                    unitPrice:
                      p.is_promotion && p.promotion_price != null ? p.promotion_price : p.price,
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
      stickySectionHeadersEnabled
      keyExtractor={(item, idx) =>
        item.kind === 'categories' ? 'cats' : item.pair.map((p) => p.id).join('-') + ':' + idx
      }
      ListHeaderComponent={renderWelcomeIntro}
      renderSectionHeader={renderStickyHeader}
      renderItem={renderRow}
      contentContainerStyle={[
        styles.listContent,
        { paddingBottom: 100 },
      ]}
      refreshing={isRefetching}
      onRefresh={refetch}
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
            {isAuthenticated && firstName ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Bonjour, ${firstName}`}
                onPress={() => nav.navigate('ClientTabs', { screen: 'ProfileTab' })}
                hitSlop={6}
                style={styles.greetingBtn}
              >
                <Text style={[styles.greetingText, { color: colors.foreground }]} numberOfLines={1}>
                  Bonjour, {firstName}
                </Text>
              </Pressable>
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
          </View>
        </View>

        <View style={[styles.listArea, { backgroundColor: colors.background }]}>
          {/*
            La SectionList rend :
            - ListHeader : titre + sous-titre orange (scrollent et disparaissent)
            - SectionHeader sticky : barre de recherche orange + ShopMode blanc
            - 1er item de la section : filtres catégories (scroll)
            - items suivants : paires de produits
          */}
          {renderProductsList()}
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
  welcomeBanner: {
    paddingHorizontal: H_PAD,
    paddingTop: 18,
    paddingBottom: 18,
    marginBottom: 8,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    alignItems: 'center',
  },
  welcomeIntro: {
    paddingHorizontal: H_PAD,
    paddingTop: 20,
    paddingBottom: 16,
    alignItems: 'center',
  },
  stickySearchBar: {
    paddingHorizontal: H_PAD,
    paddingTop: 8,
    paddingBottom: 14,
  },
  welcomeTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.95,
    marginBottom: 16,
    lineHeight: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
    height: 48,
  },
  cameraBtn: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  searchBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
    }),
  },
  greetingBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
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
  listState: { flex: 1, justifyContent: 'center', minHeight: 200 },
  emptyWithHeaderPad: { paddingTop: 8, paddingBottom: 24 },
});
