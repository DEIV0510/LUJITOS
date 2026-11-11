import type { TextStyle } from 'react-native';

/**
 * Tokens PROVISIONALES (Fase 1).
 * La identidad visual definitiva se define en la Fase 2. Cuando llegue, solo
 * cambia este archivo: las pantallas usan nombres semánticos, nunca colores sueltos.
 */
export const colors = {
  light: {
    background: '#F4F4F1',
    surface: '#FFFFFF',
    text: '#111210',
    textMuted: '#5C5F57',
    border: '#E1E1DA',
    accent: '#0E7556',
    accentTrack: '#DDEEE6',
  },
  dark: {
    background: '#0A0B0A',
    surface: '#151614',
    text: '#F2F2EE',
    textMuted: '#9C9F96',
    border: '#272924',
    accent: '#3DC493',
    accentTrack: '#18382C',
  },
} as const;

export type ColorScheme = keyof typeof colors;
export type ThemeColors = { readonly [K in keyof (typeof colors)['light']]: string };

/** Escala de espaciado en puntos (múltiplos de 4). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
} as const;

/** Tamaños basados en la escala de iOS; ningún texto baja de 13 pt. */
export const typography = {
  wordmark: { fontSize: 15, lineHeight: 20, fontWeight: '800', letterSpacing: 4 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  callout: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.6 },
} satisfies Record<string, TextStyle>;
