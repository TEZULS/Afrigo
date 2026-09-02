/**
 * Tokens de design AfriGo (mobile).
 *
 * Source : src/index.css du projet web (HSL → converties en HEX) +
 * couleurs hardcodées identifiées dans les composants (Home, ProductCard,
 * BottomTabBar, Layout). On garde l'identité visuelle 100 % cohérente entre
 * web et mobile : oranges (#F97316/#EA580C), vert AfriGo (#008000), slate.
 */

export const palette = {
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  brand: {
    orange: '#F97316',
    orangeDark: '#EA580C',
    green: '#008000',
    greenLight: '#10B981',
    greenDark: '#065F46',
    rose: '#F43F5E',
    pink: '#EC4899',
  },

  slate: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
    950: '#020617',
  },

  emerald: {
    50: '#ECFDF5',
    100: '#D1FAE5',
    200: '#A7F3D0',
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
    700: '#047857',
    900: '#064E3B',
  },

  orange: {
    50: '#FFF7ED',
    100: '#FFEDD5',
    200: '#FED7AA',
    300: '#FDBA74',
    400: '#FB923C',
    500: '#F97316',
    600: '#EA580C',
    700: '#C2410C',
    900: '#7C2D12',
  },

  rose: {
    50: '#FFF1F2',
    100: '#FFE4E6',
    200: '#FECDD3',
    400: '#FB7185',
    500: '#F43F5E',
    600: '#E11D48',
    700: '#BE123C',
  },

  /** Violet du portefeuille (web : `bg-purple-50` / `text-purple-700`). */
  purple: {
    50: '#FAF5FF',
    100: '#F3E8FF',
    200: '#E9D5FF',
    600: '#9333EA',
    700: '#7E22CE',
  },

  red: {
    100: '#FEE2E2',
    500: '#EF4444',
    600: '#DC2626',
    700: '#B91C1C',
  },

  blue: {
    50: '#EFF6FF',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
  },

  yellow: {
    400: '#FACC15',
    500: '#EAB308',
  },
} as const;

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  brandOrange: string;
  brandOrangeDark: string;
  brandGreen: string;
  success: string;
  warning: string;
  info: string;
  surfaceElevated: string;
  surfaceMuted: string;
}

export const lightTheme: ThemeColors = {
  background: palette.white,
  foreground: palette.slate[900],
  card: palette.white,
  cardForeground: palette.slate[900],
  primary: palette.brand.green,
  primaryForeground: palette.white,
  secondary: palette.slate[100],
  secondaryForeground: palette.slate[900],
  muted: palette.slate[100],
  mutedForeground: palette.slate[500],
  accent: palette.orange[500],
  accentForeground: palette.white,
  destructive: palette.red[500],
  destructiveForeground: palette.white,
  border: palette.slate[200],
  input: palette.slate[200],
  ring: palette.slate[900],
  brandOrange: palette.brand.orange,
  brandOrangeDark: palette.brand.orangeDark,
  brandGreen: palette.brand.green,
  success: palette.emerald[500],
  warning: palette.yellow[500],
  info: palette.blue[500],
  surfaceElevated: palette.white,
  surfaceMuted: palette.slate[50],
};

export const darkTheme: ThemeColors = {
  ...lightTheme,
  background: palette.slate[950],
  foreground: palette.slate[50],
  card: palette.slate[900],
  cardForeground: palette.slate[50],
  primary: palette.brand.green,
  primaryForeground: palette.white,
  secondary: palette.slate[800],
  secondaryForeground: palette.slate[50],
  muted: palette.slate[800],
  mutedForeground: palette.slate[400],
  accent: palette.orange[500],
  accentForeground: palette.white,
  border: palette.slate[800],
  input: palette.slate[800],
  ring: palette.slate[300],
  surfaceElevated: palette.slate[900],
  surfaceMuted: palette.slate[800],
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

export const spacing = {
  px: 1,
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const typography = {
  fontFamily: 'System',
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  lineHeight: {
    tight: 1.15,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.625,
  },
} as const;

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

