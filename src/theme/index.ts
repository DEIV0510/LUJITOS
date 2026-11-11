import { useColorScheme } from 'react-native';

import { colors, radius, spacing, typography, type ColorScheme, type ThemeColors } from './tokens';

export * from './tokens';

export type AppTheme = {
  scheme: ColorScheme;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
};

/** Tema activo según el modo claro/oscuro del iPhone. */
export function useAppTheme(): AppTheme {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: colors[scheme], spacing, radius, typography };
}
