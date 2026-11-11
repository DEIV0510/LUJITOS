import type { TextStyle } from 'react-native';

import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';

/** Solo se cargan los cuatro pesos que usa la app. */
export const fontAssets = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
};

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

const numbers: TextStyle = { fontVariant: ['tabular-nums'] };

/**
 * Escala tipográfica. Los valores monetarios usan cifras tabulares para que
 * las columnas de montos queden alineadas.
 */
export const typography = {
  /** Patrimonio en la tarjeta principal. */
  display: { fontFamily: fontFamily.semibold, fontSize: 36, lineHeight: 42, letterSpacing: -1.1, ...numbers },
  amountXL: { fontFamily: fontFamily.semibold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8, ...numbers },
  amountL: { fontFamily: fontFamily.semibold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5, ...numbers },
  amountM: { fontFamily: fontFamily.semibold, fontSize: 19, lineHeight: 24, letterSpacing: -0.3, ...numbers },
  amount: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 21, letterSpacing: -0.2, ...numbers },
  amountS: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 19, letterSpacing: -0.1, ...numbers },

  largeTitle: { fontFamily: fontFamily.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  title: { fontFamily: fontFamily.semibold, fontSize: 21, lineHeight: 27, letterSpacing: -0.4 },
  headline: { fontFamily: fontFamily.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 23, letterSpacing: -0.1 },
  bodyStrong: { fontFamily: fontFamily.medium, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },
  callout: { fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  subhead: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 19, letterSpacing: -0.05 },
  footnote: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 17, letterSpacing: 0.05 },
  caption: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.1 },
  /** Rótulos en mayúsculas dentro de tarjetas (no se usan como etiquetas sobre títulos). */
  overline: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase' },
  button: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 20, letterSpacing: -0.1 },
  tab: { fontFamily: fontFamily.medium, fontSize: 10.5, lineHeight: 13, letterSpacing: 0 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
