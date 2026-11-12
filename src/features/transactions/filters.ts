/** Filtros, búsqueda y agrupación del historial de movimientos (funciones puras). */
import { monthKey, type ISODate } from '@/lib/dates';
import type { Money } from '@/lib/money';
import type { StoredTransactionType, Transaction } from '@/types/finance';

export type TypeFilter = StoredTransactionType | 'all';

export type TransactionFilters = {
  type: TypeFilter;
  accountId: string | null;
  categoryId: string | null;
  from: ISODate | null;
  to: ISODate | null;
  min: Money | null;
  max: Money | null;
  search: string;
  includeVoided: boolean;
};

export const EMPTY_FILTERS: TransactionFilters = {
  type: 'all',
  accountId: null,
  categoryId: null,
  from: null,
  to: null,
  min: null,
  max: null,
  search: '',
  includeVoided: false,
};

/** Minúsculas y sin tildes: «Alimentación» se encuentra escribiendo «alimentacion». */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function matchesFilters(transaction: Transaction, filters: TransactionFilters): boolean {
  if (!filters.includeVoided && transaction.voidedAt) return false;
  if (filters.type !== 'all' && transaction.type !== filters.type) return false;
  if (filters.accountId && transaction.accountId !== filters.accountId && transaction.toAccountId !== filters.accountId) return false;
  if (filters.categoryId && transaction.categoryId !== filters.categoryId) return false;
  if (filters.from && transaction.date < filters.from) return false;
  if (filters.to && transaction.date > filters.to) return false;
  if (filters.min !== null && transaction.amount < filters.min) return false;
  if (filters.max !== null && transaction.amount > filters.max) return false;
  const query = normalizeText(filters.search);
  if (query) {
    const haystack = normalizeText(`${transaction.description} ${transaction.counterparty ?? ''}`);
    if (!query.split(/\s+/).every((word) => haystack.includes(word))) return false;
  }
  return true;
}

export function applyFilters(transactions: Transaction[], filters: TransactionFilters): Transaction[] {
  return transactions.filter((transaction) => matchesFilters(transaction, filters));
}

export function activeFilterCount(filters: TransactionFilters): number {
  return [
    filters.type !== 'all',
    filters.accountId,
    filters.categoryId,
    filters.from || filters.to,
    filters.min !== null || filters.max !== null,
    filters.search.trim(),
    filters.includeVoided,
  ].filter(Boolean).length;
}

export type DayGroup = { date: ISODate; data: Transaction[] };
export type MonthGroup = { month: string; days: DayGroup[] };

/** Agrupa por mes y, dentro de cada mes, por día (en el orden recibido: el más reciente primero). */
export function groupByMonthAndDay(transactions: Transaction[]): MonthGroup[] {
  const months: MonthGroup[] = [];
  for (const transaction of transactions) {
    const key = monthKey(transaction.date);
    let month = months[months.length - 1];
    if (!month || month.month !== key) {
      month = { month: key, days: [] };
      months.push(month);
    }
    let day = month.days[month.days.length - 1];
    if (!day || day.date !== transaction.date) {
      day = { date: transaction.date, data: [] };
      month.days.push(day);
    }
    day.data.push(transaction);
  }
  return months;
}
