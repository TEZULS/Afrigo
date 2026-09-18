import React from 'react';
import { ScrollView, SectionList } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { renderWithProviders, fireEvent, screen, waitFor, act } from '@/__tests__/test-utils';
import { useMenuDrawer } from '@/stores/menuDrawer';
import { useHomeSearch } from '@/stores/homeSearch';
import type { ProductDTO } from '@/components/products/ProductCard';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), canGoBack: () => false }),
    useRoute: () => ({ name: 'HomeTab', key: 'home', params: {} }),
  };
});

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'salma@x.fr', full_name: 'Salma Timo' },
    isAuthenticated: true,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const FOOD_PRODUCTS: ProductDTO[] = [
  {
    id: 'p1',
    name: 'ABOLO (Poudre) 500g',
    price: 4.99,
    category: 'sec',
    unit: 'unité',
  } as ProductDTO,
  {
    id: 'p2',
    name: 'Adja',
    price: 4.25,
    category: 'epices',
    unit: 'pièce',
  } as ProductDTO,
];

const COSMETIC_PRODUCT = {
  id: 'p3',
  name: 'Beurre de karité',
  price: 9.9,
  category: 'cosmetique',
  unit: 'pot',
} as ProductDTO;

/** Catalogue renvoyé par le mock — ajustable test par test. */
let mockProducts: ProductDTO[] = FOOD_PRODUCTS;

jest.mock('@/api/entities', () => ({
  Product: () => ({ list: jest.fn(async () => mockProducts) }),
  InvokeLLM: jest.fn(),
}));

import { HomeScreen } from '../HomeScreen';

const wrap = (ui: React.ReactElement) => <NavigationContainer>{ui}</NavigationContainer>;

describe('HomeScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockProducts = FOOD_PRODUCTS;
    useMenuDrawer.setState({ isOpen: false, activeRoute: null });
    useHomeSearch.setState({ query: '', queryToken: 0 });
  });

  it('masque le segment Alimentation/Cosmétiques quand le rayon cosmétiques est vide', async () => {
    renderWithProviders(wrap(<HomeScreen />));
    await waitFor(() => expect(screen.getByText('Adja')).toBeTruthy());

    expect(screen.queryByLabelText('Cosmétiques')).toBeNull();
    expect(screen.queryByLabelText('Alimentation')).toBeNull();
  });

  it("affiche le segment dès qu'un produit cosmétique existe", async () => {
    mockProducts = [...FOOD_PRODUCTS, COSMETIC_PRODUCT];
    renderWithProviders(wrap(<HomeScreen />));

    await waitFor(() => expect(screen.getByLabelText('Cosmétiques')).toBeTruthy());
    expect(screen.getByLabelText('Alimentation')).toBeTruthy();
  });

  /*
    Régression : en production la catégorie du produit est     (l'admin base44 propose 7 sous-catégories cosmétiques). L'app n'en
    connaissait qu'une — le sélecteur restait masqué et le produit atterrissait
    dans le rayon Alimentation.
  */
  it("reconnaît les sous-catégories cosmétiques de base44", async () => {
    mockProducts = [
      ...FOOD_PRODUCTS,
      { ...COSMETIC_PRODUCT, category: 'cosmetique_soins_corps' } as ProductDTO,
    ];
    renderWithProviders(wrap(<HomeScreen />));

    await waitFor(() => expect(screen.getByLabelText('Cosmétiques')).toBeTruthy());
    // Le cosmétique ne doit PAS apparaître dans le rayon Alimentation.
    expect(screen.queryByText('Beurre de karité')).toBeNull();
  });

  it("affiche le bouton menu à côté du bonjour et ouvre le drawer", async () => {
    renderWithProviders(wrap(<HomeScreen />));
    await waitFor(() => expect(screen.getByText('Bonjour, Salma')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Ouvrir le menu'));
    expect(useMenuDrawer.getState().isOpen).toBe(true);
  });

  it("n'affiche plus de barre de recherche : la recherche passe par l'onglet 🔍", async () => {
    renderWithProviders(wrap(<HomeScreen />));
    await waitFor(() => expect(screen.getByText('Adja')).toBeTruthy());

    expect(screen.queryByLabelText('Rechercher un produit')).toBeNull();
    expect(screen.queryByLabelText('Rechercher un produit (barre épinglée)')).toBeNull();
    expect(screen.queryByLabelText('Rechercher avec une photo')).toBeNull();
    // Les catégories, elles, restent en tête de liste.
    expect(screen.getByText('Tous')).toBeTruthy();
  });

  it("applique le terme poussé par l'écran de recherche et permet de l'effacer", async () => {
    renderWithProviders(wrap(<HomeScreen />));
    await waitFor(() => expect(screen.getByText('Adja')).toBeTruthy());

    act(() => {
      useHomeSearch.getState().applyQuery('abolo');
    });

    await waitFor(() => expect(screen.queryByText('Adja')).toBeNull());
    expect(screen.getByText('ABOLO (Poudre) 500g')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Effacer la recherche « abolo »'));
    await waitFor(() => expect(screen.getByText('Adja')).toBeTruthy());
  });
});

describe('HomeScreen — flèche « retour en haut »', () => {
  const scrollEvent = (y: number) => ({
    nativeEvent: {
      contentOffset: { x: 0, y },
      contentSize: { height: 3000, width: 360 },
      layoutMeasurement: { height: 700, width: 360 },
    },
  });

  beforeEach(() => {
    mockProducts = FOOD_PRODUCTS;
    useMenuDrawer.setState({ isOpen: false, activeRoute: null });
    useHomeSearch.setState({ query: '', queryToken: 0 });
  });

  /** Le ScrollView réel expose `getScrollResponder()` → lui-même (avec `scrollTo`). */
  const mockScrollResponder = () => {
    const scrollTo = jest.fn();
    jest
      .spyOn(ScrollView.prototype, 'getScrollResponder')
      .mockImplementation((() => ({ scrollTo })) as never);
    return scrollTo;
  };

  afterEach(() => jest.restoreAllMocks());

  it('apparaît après un long défilement et remonte la liste via le ScrollView', async () => {
    const scrollTo = mockScrollResponder();
    renderWithProviders(wrap(<HomeScreen />));
    await waitFor(() => expect(screen.getByText('Adja')).toBeTruthy());

    // En haut de page : pas de flèche.
    expect(screen.queryByTestId('home-scroll-top')).toBeNull();

    const list = screen.UNSAFE_getByType(SectionList);
    fireEvent.scroll(list, scrollEvent(120));
    expect(screen.queryByTestId('home-scroll-top')).toBeNull();

    fireEvent.scroll(list, scrollEvent(900));
    await waitFor(() => expect(screen.getByTestId('home-scroll-top')).toBeTruthy());

    fireEvent.press(screen.getByTestId('home-scroll-top'));
    // Le ScrollView sous-jacent est piloté directement (pas les métriques de
    // cellules), et la flèche disparaît dès l'appui.
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 0, animated: true });
    await waitFor(() => expect(screen.queryByTestId('home-scroll-top')).toBeNull());

    // Toujours loin du haut au prochain événement de scroll → elle revient.
    fireEvent.scroll(list, scrollEvent(900));
    await waitFor(() => expect(screen.getByTestId('home-scroll-top')).toBeTruthy());
  });

  it('le logo AfriGo remonte aussi en haut de la liste', async () => {
    const scrollTo = mockScrollResponder();
    renderWithProviders(wrap(<HomeScreen />));
    await waitFor(() => expect(screen.getByText('Adja')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('AfriGo — retour en haut'));
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 0, animated: true });
  });
});

describe('HomeScreen — sections Promotions / Nouveaux produits', () => {
  const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 36e5).toISOString().replace('Z', '000');
  const promo = (id: string, name: string): ProductDTO =>
    ({ id, name, price: 10, promotion_price: 8, is_promotion: true, category: 'sec', unit: 'pièce' }) as ProductDTO;
  const fresh = (id: string, name: string, days: number): ProductDTO =>
    ({ id, name, price: 5, category: 'epices', unit: 'pièce', created_date: daysAgo(days) }) as ProductDTO;

  beforeEach(() => {
    mockNavigate.mockClear();
    useMenuDrawer.setState({ isOpen: false, activeRoute: null });
    useHomeSearch.setState({ query: '', queryToken: 0 });
  });

  it('affiche 2 promotions max avec « Voir + » vers la page Promotions', async () => {
    mockProducts = [promo('pr1', 'Promo un'), promo('pr2', 'Promo deux'), promo('pr3', 'Promo trois'), ...FOOD_PRODUCTS];
    renderWithProviders(wrap(<HomeScreen />));
    await waitFor(() => expect(screen.getByText('🏷️ Promotions')).toBeTruthy());
    // Deux promos en tête (ordre alphabétique du catalogue) ; la troisième n'apparaît qu'en « Voir + ».
    expect(screen.getAllByText('Promo deux').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Promo trois').length).toBeGreaterThan(0);
    expect(screen.queryByText('Promo un')).toBeNull();
    fireEvent.press(screen.getByTestId('home-see-more-Promotions'));
    expect(mockNavigate).toHaveBeenCalledWith('Promotions');
    expect(screen.getByText('Nos produits')).toBeTruthy();
  });

  it('affiche les nouveautés des 7 derniers jours (2 max, « Voir + » vers Nouveaux produits)', async () => {
    mockProducts = [fresh('n1', 'Nouveau un', 1), fresh('n2', 'Nouveau deux', 3), fresh('n3', 'Nouveau trois', 6), fresh('old', 'Ancien', 20)];
    renderWithProviders(wrap(<HomeScreen />));
    await waitFor(() => expect(screen.getByText('✨ Nouveaux produits')).toBeTruthy());
    expect(screen.queryByText('🏷️ Promotions')).toBeNull();
    fireEvent.press(screen.getByTestId('home-see-more-Nouveaux produits'));
    expect(mockNavigate).toHaveBeenCalledWith('NewProducts');
  });

  it('sans promotion ni nouveauté : pas de section, catalogue directement', async () => {
    mockProducts = FOOD_PRODUCTS;
    renderWithProviders(wrap(<HomeScreen />));
    await waitFor(() => expect(screen.getByText('ABOLO (Poudre) 500g')).toBeTruthy());
    expect(screen.queryByText('🏷️ Promotions')).toBeNull();
    expect(screen.queryByText('✨ Nouveaux produits')).toBeNull();
    expect(screen.queryByText('Nos produits')).toBeNull();
  });
});

describe('HomeScreen — en-tête épinglé et réduit au défilement', () => {
  const scrollEvent = (y: number) => ({
    nativeEvent: {
      contentOffset: { x: 0, y },
      contentSize: { height: 3000, width: 360 },
      layoutMeasurement: { height: 700, width: 360 },
    },
  });
  beforeEach(() => {
    mockProducts = [...FOOD_PRODUCTS, COSMETIC_PRODUCT];
    useMenuDrawer.setState({ isOpen: false, activeRoute: null });
    useHomeSearch.setState({ query: '', queryToken: 0 });
  });

  it('rayon et catégories vivent dans l’en-tête de section (épinglé), et tout se réduit en défilant', async () => {
    renderWithProviders(wrap(<HomeScreen />));
    await waitFor(() => expect(screen.getByLabelText('Cosmétiques')).toBeTruthy());
    const list = screen.UNSAFE_getByType(SectionList);
    expect(list.props.stickySectionHeadersEnabled).toBe(true);
    const brand = () => screen.getByText('AfriGo');
    const flat = (style: unknown) => Object.assign({}, ...([] as object[]).concat(style as object[]).flat(Infinity));
    expect(flat(brand().props.style).fontSize).toBeGreaterThan(20);

    fireEvent.scroll(list, scrollEvent(120));
    await waitFor(() => expect(flat(brand().props.style).fontSize).toBe(20));
    // Rayon et catégories toujours là, en version réduite.
    expect(screen.getByLabelText('Cosmétiques')).toBeTruthy();
    expect(screen.getByText('Tous')).toBeTruthy();

    fireEvent.scroll(list, scrollEvent(0));
    await waitFor(() => expect(flat(brand().props.style).fontSize).toBeGreaterThan(20));
  });
});
