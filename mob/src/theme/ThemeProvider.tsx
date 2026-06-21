import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { lightTheme, darkTheme, radius, spacing, typography, shadow, type ThemeColors } from './tokens';

type Mode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  mode: Mode;
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  radius: typeof radius;
  spacing: typeof spacing;
  typography: typeof typography;
  shadow: typeof shadow;
  setMode: (mode: Mode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const resolveScheme = (mode: Mode, system: ColorSchemeName): 'light' | 'dark' => {
  if (mode === 'system') return system === 'dark' ? 'dark' : 'light';
  return mode;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode; defaultMode?: Mode }> = ({
  children,
  defaultMode = 'light',
}) => {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [system, setSystem] = useState<ColorSchemeName>(Appearance.getColorScheme() ?? 'light');

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme));
    return () => sub.remove();
  }, []);

  const scheme = resolveScheme(mode, system);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      scheme,
      colors: scheme === 'dark' ? darkTheme : lightTheme,
      radius,
      spacing,
      typography,
      shadow,
      setMode,
    }),
    [mode, scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
