/** Periodos del gráfico de evolución del saldo y cómo se resumen sus puntos. */
import { addDays, formatShortDate, MONTHS_SHORT, parseISO, type ISODate } from '@/lib/dates';
import type { Money } from '@/lib/money';

export type HistoryRange = 'week' | 'month' | '3m' | '6m' | 'year';

export const HISTORY_RANGES: { value: HistoryRange; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: 'year', label: 'Año' },
];

const DAYS: Record<HistoryRange, number> = { week: 7, month: 30, '3m': 91, '6m': 182, year: 365 };
/** Cuántos puntos se dibujan como máximo (el gráfico debe leerse en un iPhone). */
const MAX_POINTS: Record<HistoryRange, number> = { week: 7, month: 10, '3m': 13, '6m': 13, year: 12 };

export function rangeDates(range: HistoryRange, today: ISODate): { from: ISODate; to: ISODate } {
  return { from: addDays(today, -(DAYS[range] - 1)), to: today };
}

export type ChartPoint = { date: ISODate; balance: Money; label: string; detail: string };

/**
 * Reduce la serie diaria a pocos puntos repartidos de forma pareja, siempre con
 * el primero y el último (el saldo de hoy). No inventa valores: cada punto es
 * el saldo real al cierre de ese día.
 */
export function sampleHistory(points: { date: ISODate; balance: Money }[], range: HistoryRange): ChartPoint[] {
  if (points.length === 0) return [];
  const max = MAX_POINTS[range];
  const indexes =
    points.length <= max
      ? points.map((_, index) => index)
      : Array.from({ length: max }, (_, step) => Math.round((step * (points.length - 1)) / (max - 1)));
  return [...new Set(indexes)].map((index) => {
    const point = points[index]!;
    const { month, day } = parseISO(point.date);
    const label = range === 'year' ? MONTHS_SHORT[month - 1]! : range === 'week' ? String(day) : `${day}/${month}`;
    return { ...point, label, detail: formatShortDate(point.date) };
  });
}
