/**
 * Fechas en LUJITOS. Las fechas de calendario se manejan como texto ISO
 * 'AAAA-MM-DD' y se interpretan en America/Bogota (UTC−5, sin horario de verano).
 */
export type ISODate = string;

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

export const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

export const MONTHS_SHORT = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
] as const;

export const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;
export const WEEKDAYS_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] as const;

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function parseISO(iso: ISODate): { year: number; month: number; day: number } {
  const [year = 1970, month = 1, day = 1] = iso.split('-').map(Number);
  return { year, month, day };
}

export function toISO(year: number, month: number, day: number): ISODate {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function toUTCDate(iso: ISODate): Date {
  const { year, month, day } = parseISO(iso);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function addDays(iso: ISODate, days: number): ISODate {
  const date = toUTCDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toISO(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function diffInDays(from: ISODate, to: ISODate): number {
  return Math.round((toUTCDate(to).getTime() - toUTCDate(from).getTime()) / 86_400_000);
}

export function weekdayIndex(iso: ISODate): number {
  return toUTCDate(iso).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Fecha y hora actuales en Bogotá. */
export function nowInBogota(): { date: ISODate; hour: number } {
  const shifted = new Date(Date.now() + BOGOTA_OFFSET_MS);
  return {
    date: toISO(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate()),
    hour: shifted.getUTCHours(),
  };
}

export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** 8 nov */
export function formatShortDate(iso: ISODate): string {
  const { month, day } = parseISO(iso);
  return `${day} ${MONTHS_SHORT[month - 1]}`;
}

/** 8 de noviembre de 2026 */
export function formatLongDate(iso: ISODate, withYear = true): string {
  const { year, month, day } = parseISO(iso);
  return `${day} de ${MONTHS[month - 1]}${withYear ? ` de ${year}` : ''}`;
}

/** Sábado, 8 de noviembre */
export function formatWeekdayDate(iso: ISODate): string {
  return `${capitalize(WEEKDAYS[weekdayIndex(iso)] ?? '')}, ${formatLongDate(iso, false)}`;
}

/** Encabezado de grupo: Hoy · Ayer · Sábado, 8 de noviembre */
export function formatDayHeading(iso: ISODate, today: ISODate): string {
  const diff = diffInDays(iso, today);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return formatWeekdayDate(iso);
}

/** Noviembre 2026 */
export function formatMonthYear(year: number, month: number): string {
  return `${capitalize(MONTHS[month - 1] ?? '')} ${year}`;
}

export function monthKey(iso: ISODate): string {
  return iso.slice(0, 7);
}
