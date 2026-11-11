import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { colors, type ColorScheme, type ThemeColors } from './colors';
import { radius } from './radius';
import { getShadows, type Shadows } from './shadows';
import { spacing } from './spacing';
import { typography } from './typography';

export type ThemeMode = 'system' | 'light' | 'dark';

export type AppTheme = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  scheme: ColorScheme;
  colors: ThemeColors;
  shadows: Shadows;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
};

const STORAGE_KEY = 'lujitos.theme-mode';

const ThemeContext = createContext<AppTheme | null>(null);

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Aplica la preferencia también a lo nativo (teclado, alertas, selectores). */
function applyToNative(mode: ThemeMode) {
  Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && isThemeMode(stored)) {
          setModeState(stored);
          applyToNative(stored);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    applyToNative(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const scheme: ColorScheme =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors[scheme].background).catch(() => undefined);
  }, [scheme]);

  const value = useMemo<AppTheme>(
    () => ({
      mode,
      setMode,
      scheme,
      colors: colors[scheme],
      shadows: getShadows(scheme),
      typography,
      spacing,
      radius,
    }),
    [mode, setMode, scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useAppTheme debe usarse dentro de <ThemeProvider>.');
  }
  return theme;
}
