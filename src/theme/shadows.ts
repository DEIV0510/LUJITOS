import type { ViewStyle } from 'react-native';

import { palette, type ColorScheme } from './colors';

export type Shadows = {
  none: ViewStyle;
  card: ViewStyle;
  raised: ViewStyle;
  floating: ViewStyle;
};

/** En modo oscuro las sombras casi no se ven: la separación la dan los bordes y las superficies. */
export function getShadows(scheme: ColorScheme): Shadows {
  const color = scheme === 'dark' ? '#000000' : palette.forest;
  const k = scheme === 'dark' ? 2.2 : 1;
  return {
    none: {},
    card: {
      shadowColor: color,
      shadowOpacity: 0.05 * k,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
    },
    raised: {
      shadowColor: color,
      shadowOpacity: 0.1 * k,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
    floating: {
      shadowColor: color,
      shadowOpacity: 0.22 * Math.min(k, 1.6),
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
    },
  };
}
