import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ScrollView,
  Linking,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import { ChefHat, Search, ArrowLeft, PlayCircle, ImageOff } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Recipe } from '@/api/entities';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import {
  PersistentBottomNav,
  PERSISTENT_NAV_HEIGHT,
} from '@/components/PersistentBottomNav';
import type { RootStackParamList } from '@/navigation/types';

/** Ligne `Recipe` telle que stockée dans Base44 (cf. entités déployées). */
interface RecipeRow {
  id: string;
  title?: string;
  description?: string;
  country_code?: string;
  country_name?: string;
  country_flag?: string;
  images?: string[];
  videos?: string[];
  is_active?: boolean;
  created_date?: string;
}

interface CountryRow {
  code: string;
  name: string;
  flag: string;
  count: number;
}

const countryKey = (r: RecipeRow) => r.country_code || r.country_name || 'AUTRE';

/**
 * Lecteur vidéo minimal : le projet n'embarque pas `expo-video`, on passe donc
 * par la WebView (déjà utilisée côté admin) avec une balise <video> native.
 */
const VideoPlayer: React.FC<{ uri: string }> = ({ uri }) => {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><style>html,body{margin:0;padding:0;background:#000;height:100%}video{width:100%;height:100%;object-fit:contain;background:#000}</style></head><body><video src="${uri}" controls playsinline preload="metadata"></video></body></html>`;
  return (
    <View style={styles.videoBox}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.video}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
      />
    </View>
  );
};

export const RecipesScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Recipes'>>();
  const { colors } = useTheme();
  const [search, setSearch] = useState('');

  const selectedCountry = route.params?.country;
  const selectedRecipeId = route.params?.recipeId;

  const query = useQuery<RecipeRow[]>({
    queryKey: ['recipes'],
    queryFn: async () => ((await Recipe().list?.('-created_date')) ?? []) as RecipeRow[],
  });

  const recipes = useMemo(
    () => (query.data ?? []).filter((r) => r.is_active !== false),
    [query.data],
  );

  const countries = useMemo<CountryRow[]>(() => {
    const map = new Map<string, CountryRow>();
    recipes.forEach((r) => {
      const code = countryKey(r);
      const existing = map.get(code);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(code, {
          code,
          name: r.country_name || r.country_code || 'Autre',
          flag: r.country_flag || '',
          count: 1,
        });
      }
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [recipes]);

  const goBack = () =>
    nav.canGoBack() ? nav.goBack() : nav.navigate('ClientTabs', { screen: 'HomeTab' });

  if (query.isLoading) {
    return (
      <Screen scroll={false} bottomBar={<PersistentBottomNav />}>
        <Header title="Recettes" onBack={goBack} />
        <Loader fullscreen />
      </Screen>
    );
  }

  // ---------- Détail d'une recette ----------
  const recipe = selectedRecipeId ? recipes.find((r) => r.id === selectedRecipeId) : undefined;

  if (selectedRecipeId) {
    return (
      <Screen scroll={false} bottomBar={<PersistentBottomNav />}>
        <Header title={recipe?.title ?? 'Recette'} onBack={goBack} />
        {!recipe ? (
          <EmptyState
            title="Recette introuvable"
            description="Elle a peut-être été retirée."
            icon={<ChefHat size={40} color={palette.slate[300]} />}
          />
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: PERSISTENT_NAV_HEIGHT + 24,
            }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.detailCountry, { color: colors.mutedForeground }]}>
              {recipe.country_flag} {recipe.country_name}
            </Text>
            <Text style={[styles.detailTitle, { color: colors.foreground }]}>
              {recipe.title}
            </Text>

            {recipe.images?.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={styles.detailImage}
                contentFit="cover"
                transition={150}
              />
            ))}

            {recipe.videos?.map((uri) => (
              <View key={uri}>
                <VideoPlayer uri={uri} />
                <Pressable
                  accessibilityRole="link"
                  onPress={() => Linking.openURL(uri)}
                  hitSlop={6}
                  style={styles.videoLink}
                >
                  <Text style={[styles.videoLinkTxt, { color: palette.orange[600] }]}>
                    Ouvrir la vidéo dans le lecteur
                  </Text>
                </Pressable>
              </View>
            ))}

            {!!recipe.description && (
              <Card style={styles.descCard} padding={16}>
                <Text style={[styles.descTxt, { color: colors.foreground }]}>
                  {recipe.description}
                </Text>
              </Card>
            )}
          </ScrollView>
        )}
      </Screen>
    );
  }

  // ---------- Recettes d'un pays ----------
  if (selectedCountry) {
    const country = countries.find((c) => c.code === selectedCountry);
    const countryRecipes = recipes.filter((r) => countryKey(r) === selectedCountry);
    const filtered = countryRecipes.filter(
      (r) => !search || r.title?.toLowerCase().includes(search.toLowerCase()),
    );

    return (
      <Screen scroll={false} bottomBar={<PersistentBottomNav />}>
        <Header title={country?.name ?? 'Recettes'} onBack={goBack} />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: PERSISTENT_NAV_HEIGHT + 24,
          }}
          ListHeaderComponent={
            <View>
              <View style={styles.heroRow}>
                <Text style={styles.heroFlag}>{country?.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroTitle, { color: colors.foreground }]}>
                    Les recettes de {country?.name ?? selectedCountry}
                  </Text>
                  <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
                    {countryRecipes.length} recette(s)
                  </Text>
                </View>
              </View>
              <Input
                placeholder="Rechercher une recette..."
                value={search}
                onChangeText={setSearch}
                leftIcon={<Search size={18} color={colors.mutedForeground} />}
                showClear
                containerStyle={{ marginBottom: 8 }}
              />
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title="Aucune recette trouvée"
              description="Essayez un autre mot-clé."
              icon={<ChefHat size={40} color={palette.slate[300]} />}
            />
          }
          renderItem={({ item }) => {
            const cover = item.images?.[0];
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => nav.push('Recipes', { recipeId: item.id })}
                style={styles.recipeRow}
              >
                <Card style={styles.recipeCard} elevated>
                  <View style={[styles.thumb, { backgroundColor: palette.slate[100] }]}>
                    {cover ? (
                      <Image source={{ uri: cover }} style={styles.thumbImg} contentFit="cover" />
                    ) : item.videos?.length ? (
                      <PlayCircle size={28} color={palette.slate[400]} />
                    ) : (
                      <ImageOff size={24} color={palette.slate[300]} />
                    )}
                  </View>
                  <View style={styles.recipeTxtBox}>
                    <Text
                      style={[styles.recipeTitle, { color: colors.foreground }]}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>
                    {!!item.description && (
                      <Text
                        style={[styles.recipeDesc, { color: colors.mutedForeground }]}
                        numberOfLines={2}
                      >
                        {item.description}
                      </Text>
                    )}
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      </Screen>
    );
  }

  // ---------- Liste des pays ----------
  const filteredCountries = countries.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Screen scroll={false} bottomBar={<PersistentBottomNav />}>
      <Header title="Mes recettes" onBack={goBack} />
      <FlatList
        data={filteredCountries}
        keyExtractor={(item) => item.code}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: PERSISTENT_NAV_HEIGHT + 24,
        }}
        ListHeaderComponent={
          <View>
            <View style={styles.heroRow}>
              <View style={[styles.heroIcon, { backgroundColor: palette.orange[100] }]}>
                <ChefHat size={24} color={palette.orange[600]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.heroTitle, { color: colors.foreground }]}>
                  Recettes d&apos;Afrique
                </Text>
                <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
                  Découvrez les saveurs du continent
                </Text>
              </View>
            </View>
            <Input
              placeholder="Rechercher un pays..."
              value={search}
              onChangeText={setSearch}
              leftIcon={<Search size={18} color={colors.mutedForeground} />}
              showClear
              containerStyle={{ marginBottom: 8 }}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="Aucune recette disponible"
            description="Revenez bientôt, de nouvelles recettes arrivent."
            icon={<ChefHat size={40} color={palette.slate[300]} />}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSearch('');
              nav.push('Recipes', { country: item.code });
            }}
            style={styles.countryRow}
          >
            <Card style={styles.countryCard} elevated padding={20}>
              <Text style={styles.countryFlag}>{item.flag}</Text>
              <Text style={[styles.countryName, { color: colors.foreground }]}>
                Les recettes de {item.name}
              </Text>
              <Text style={[styles.countryCount, { color: colors.mutedForeground }]}>
                {item.count} recette(s)
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 16,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFlag: { fontSize: 32 },
  heroTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  heroSubtitle: { fontSize: 14, marginTop: 2 },

  countryRow: { marginBottom: 12 },
  countryCard: { borderRadius: 18 },
  countryFlag: { fontSize: 34, marginBottom: 10 },
  countryName: { fontSize: 16, fontWeight: '700' },
  countryCount: { fontSize: 13, marginTop: 4 },

  recipeRow: { marginBottom: 12 },
  recipeCard: {
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    padding: 10,
    gap: 12,
  },
  thumb: {
    width: 84,
    height: 84,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  recipeTxtBox: { flex: 1, paddingRight: 4 },
  recipeTitle: { fontSize: 16, fontWeight: '700' },
  recipeDesc: { fontSize: 13, marginTop: 4, lineHeight: 18 },

  detailCountry: { fontSize: 13, marginTop: 16 },
  detailTitle: { fontSize: 24, fontWeight: '800', marginTop: 4, marginBottom: 16 },
  detailImage: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    marginBottom: 12,
    backgroundColor: palette.slate[100],
  },
  videoBox: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 8,
  },
  video: { flex: 1, backgroundColor: '#000' },
  videoLink: { paddingVertical: 6, marginBottom: 8 },
  videoLinkTxt: { fontSize: 13, fontWeight: '600' },
  descCard: { marginTop: 4 },
  descTxt: { fontSize: 15, lineHeight: 22 },
});
