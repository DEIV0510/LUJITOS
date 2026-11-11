/** Escala de espaciado en puntos (base 4). */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

/** Margen lateral de todas las pantallas. */
export const screenPadding = spacing.xl;

/** Área táctil mínima recomendada por Apple. */
export const minTouchTarget = 44;
