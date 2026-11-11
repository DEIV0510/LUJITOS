import { mix, withAlpha } from '@/utils/color';

/** Paleta de marca LUJITOS. Ningún componente usa estos valores directamente: usa los semánticos. */
export const palette = {
  forest: '#14251F',
  ivory: '#F4F1E8',
  sage: '#A8C5A0',
  gold: '#C6A66A',
  charcoal: '#202522',
  white: '#FFFFFF',
  gray: '#858B86',
  positive: '#299D68',
  negative: '#D85B5B',
} as const;

export type ColorScheme = 'light' | 'dark';

export type ThemeColors = {
  /** Fondo de pantalla. */
  background: string;
  /** Tarjetas. */
  surface: string;
  /** Hojas, barra inferior y elementos flotantes. */
  surfaceElevated: string;
  /** Campos, controles segmentados, pistas de progreso. */
  surfaceMuted: string;
  border: string;
  borderStrong: string;

  text: string;
  /** Texto de apoyo con contraste AA (>= 4.5:1). */
  textSecondary: string;
  /** Gris de marca: marcadores de posición, ejes y datos menores. */
  textTertiary: string;

  /** Botones principales e indicadores de selección. */
  primary: string;
  onPrimary: string;
  primarySoft: string;

  /** Dorado: detalles de identidad, nunca para información financiera. */
  accent: string;
  accentText: string;
  accentSoft: string;

  /** Superficie de identidad (tarjeta de patrimonio, apertura). */
  brand: string;
  brandRaised: string;
  onBrand: string;
  onBrandSecondary: string;
  brandLine: string;

  /** Solo para información financiera. */
  positive: string;
  positiveGraphic: string;
  positiveSoft: string;
  negative: string;
  negativeGraphic: string;
  negativeSoft: string;
  warning: string;
  warningGraphic: string;

  overlay: string;
  chartGrid: string;
  skeleton: string;
};

const light: ThemeColors = {
  background: palette.ivory,
  surface: palette.white,
  surfaceElevated: palette.white,
  surfaceMuted: '#ECE8DD',
  border: '#E4DFD2',
  borderStrong: '#D2CCBD',

  text: palette.charcoal,
  textSecondary: '#5B615D',
  textTertiary: palette.gray,

  primary: palette.forest,
  onPrimary: palette.ivory,
  primarySoft: withAlpha(palette.forest, 0.07),

  accent: palette.gold,
  accentText: '#86672C',
  accentSoft: withAlpha(palette.gold, 0.16),

  brand: palette.forest,
  brandRaised: '#1E3530',
  onBrand: palette.ivory,
  onBrandSecondary: withAlpha(palette.ivory, 0.68),
  brandLine: withAlpha(palette.ivory, 0.12),

  positive: '#1B7349',
  positiveGraphic: palette.positive,
  positiveSoft: withAlpha(palette.positive, 0.12),
  negative: '#B5413D',
  negativeGraphic: palette.negative,
  negativeSoft: withAlpha(palette.negative, 0.12),
  warning: '#8F6A22',
  warningGraphic: palette.gold,

  overlay: withAlpha(palette.forest, 0.42),
  chartGrid: '#E8E3D7',
  skeleton: '#E9E5DA',
};

const dark: ThemeColors = {
  background: '#0E1512',
  surface: '#161F1B',
  surfaceElevated: '#1C2621',
  surfaceMuted: '#222D28',
  border: '#27332D',
  borderStrong: '#35433C',

  text: palette.ivory,
  textSecondary: '#AEB4AF',
  textTertiary: palette.gray,

  primary: palette.sage,
  onPrimary: palette.forest,
  primarySoft: withAlpha(palette.sage, 0.14),

  accent: palette.gold,
  accentText: '#D6BC86',
  accentSoft: withAlpha(palette.gold, 0.16),

  brand: '#17302A',
  brandRaised: '#203B33',
  onBrand: palette.ivory,
  onBrandSecondary: withAlpha(palette.ivory, 0.66),
  brandLine: withAlpha(palette.ivory, 0.1),

  positive: '#52C28E',
  positiveGraphic: '#3DB27B',
  positiveSoft: withAlpha('#3DB27B', 0.16),
  negative: '#EE8080',
  negativeGraphic: '#E06A6A',
  negativeSoft: withAlpha('#E06A6A', 0.16),
  warning: '#DDBF85',
  warningGraphic: palette.gold,

  overlay: 'rgba(0,0,0,0.6)',
  chartGrid: '#24302A',
  skeleton: '#202A25',
};

export const colors: Record<ColorScheme, ThemeColors> = { light, dark };

/**
 * Tonos apagados para categorías y cuentas. Se derivan en tres usos:
 * fondo suave, trazo/ícono y color de gráfico, ajustados a cada modo.
 */
export const tones = {
  gold: '#C6A66A',
  sage: '#8FB487',
  forest: '#4F7F68',
  teal: '#5F9A8B',
  slate: '#7891A0',
  blue: '#6F88B3',
  lavender: '#988DB8',
  plum: '#A487AE',
  rose: '#C48A8A',
  clay: '#C27E6F',
  peach: '#CDA08A',
  amber: '#B98C55',
  olive: '#8E916A',
  taupe: '#8D7D6E',
  stone: '#8E928B',
} as const;

export type Tone = keyof typeof tones;

export type ToneSet = { base: string; soft: string; ink: string };

export function resolveTone(tone: Tone, scheme: ColorScheme): ToneSet {
  const base = tones[tone];
  return scheme === 'dark'
    ? { base, soft: withAlpha(base, 0.2), ink: mix(base, palette.ivory, 0.18) }
    : { base, soft: withAlpha(base, 0.16), ink: mix(base, palette.charcoal, 0.42) };
}
