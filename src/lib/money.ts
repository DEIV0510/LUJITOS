/**
 * Dinero en LUJITOS: siempre enteros en CENTAVOS de peso colombiano.
 * Nunca se suman decimales de JavaScript. En pantalla se muestran pesos sin
 * decimales con el formato colombiano: $ 1.250.000
 */
export type Money = number;

/** Convierte pesos a centavos. */
export function cop(pesos: number): Money {
  return Math.round(pesos * 100);
}

export function toPesos(amount: Money): number {
  return Math.round(amount / 100);
}

export const MINUS = '\u2212';
const HIDDEN = '••••••';
/** Espacio no separable: el signo $ nunca queda solo al final de una línea. */
const NBSP = '\u00A0';

function groupThousands(value: number): string {
  return Math.abs(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export type SignMode = 'auto' | 'always' | 'never';

export function formatMoney(
  amount: Money,
  options: { sign?: SignMode; hidden?: boolean } = {},
): string {
  const { sign = 'auto', hidden = false } = options;
  if (hidden) return `$${NBSP}${HIDDEN}`;
  const pesos = toPesos(amount);
  const body = `$${NBSP}${groupThousands(pesos)}`;
  if (sign === 'never' || pesos === 0) return body;
  if (pesos < 0) return `${MINUS}${body}`;
  return sign === 'always' ? `+${body}` : body;
}

/** Forma corta para ejes de gráficos: 2,5 M · 850 mil. */
export function formatCompact(amount: Money): string {
  const pesos = Math.abs(toPesos(amount));
  const prefix = amount < 0 ? MINUS : '';
  if (pesos >= 1_000_000) {
    const millions = pesos / 1_000_000;
    const text = millions >= 10 ? Math.round(millions).toString() : String(Number(millions.toFixed(2)));
    return `${prefix}${text.replace('.', ',')} M`;
  }
  if (pesos >= 1_000) return `${prefix}${Math.round(pesos / 1_000)} mil`;
  return `${prefix}${pesos}`;
}

/** 6,4 % · con signo opcional. */
export function formatPercent(value: number, options: { digits?: number; sign?: boolean } = {}): string {
  const { digits = 1, sign = false } = options;
  const rounded = Math.abs(value).toFixed(digits).replace('.', ',').replace(/,0+$/, '');
  const symbol = value < 0 ? MINUS : sign && value > 0 ? '+' : '';
  return `${symbol}${rounded}${NBSP}%`;
}

/** Variación relativa en porcentaje; null si no hay base para comparar. */
export function percentChange(current: Money, previous: Money): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Lee lo que escribe el usuario en un campo de monto y devuelve centavos. */
export function parseAmountInput(text: string, maxDigits = 12): Money {
  const digits = text.replace(/\D/g, '').slice(0, maxDigits);
  return digits.length === 0 ? 0 : cop(Number(digits));
}

/** Monto para mostrar dentro de un campo mientras se escribe (sin el signo $). */
export function formatAmountInput(amount: Money): string {
  return amount === 0 ? '' : groupThousands(toPesos(amount));
}
