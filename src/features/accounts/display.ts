/**
 * Cómo se muestra una cuenta: entidad (de la lista o escrita a mano), color e
 * ícono elegidos, y las cifras de una tarjeta de crédito.
 */
import { INSTITUTIONS } from '@/constants/institutions';
import { daysInMonth, parseISO, toISO, type ISODate } from '@/lib/dates';
import type { Money } from '@/lib/money';
import { isTone } from '@/services/finance/mappers';
import type { Account, IconName, Institution } from '@/types/finance';

function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !/^(de|del|la|el|y)$/i.test(word));
  const letters = words.length >= 2 ? `${words[0]![0]}${words[1]![0]}` : (words[0] ?? 'OT').slice(0, 2);
  return letters.toUpperCase();
}

/** Identificador visual de la cuenta (respeta el color y el ícono elegidos). */
export function institutionOf(account: Pick<Account, 'institutionId' | 'institutionName' | 'color' | 'icon'>): Institution {
  const base = INSTITUTIONS[account.institutionId] ?? INSTITUTIONS.custom;
  const customName = account.institutionId === 'custom' ? account.institutionName?.trim() : undefined;
  const name = customName || base.name;
  const icon = (account.icon as IconName | null | undefined) ?? (customName ? undefined : base.icon);
  return {
    id: base.id,
    name,
    initials: customName ? initialsOf(customName) : base.initials,
    tone: isTone(account.color) ? account.color : base.tone,
    icon,
  };
}

export function isCreditCard(account: Pick<Account, 'kind'>): boolean {
  return account.kind === 'credit_card';
}

/** Deuda de una tarjeta (su saldo negativo). 0 si no debe nada. */
export function cardDebt(account: Pick<Account, 'balance'>): Money {
  return Math.max(-account.balance, 0);
}

export type CardMetrics = {
  limit: Money;
  debt: Money;
  available: Money;
  /** 0–1 (puede pasar de 1 si se excedió el cupo). */
  utilization: number;
};

/** Mismo cálculo que public.financial_summary(): disponible = cupo − deuda. */
export function cardMetrics(account: Pick<Account, 'balance' | 'creditLimit'>): CardMetrics | null {
  if (!account.creditLimit) return null;
  const debt = cardDebt(account);
  return {
    limit: account.creditLimit,
    debt,
    available: Math.max(account.creditLimit + account.balance, 0),
    utilization: account.creditLimit > 0 ? debt / account.creditLimit : 0,
  };
}

/** Próxima fecha (hoy o después) con ese día del mes (corte o pago de tarjeta). En meses cortos usa el último día. */
export function nextDayOfMonth(day: number, today: ISODate): ISODate {
  const { year, month, day: todayDay } = parseISO(today);
  const inMonth = (y: number, m: number) => toISO(y, m, Math.min(day, daysInMonth(y, m)));
  if (todayDay <= Math.min(day, daysInMonth(year, month))) return inMonth(year, month);
  return month === 12 ? inMonth(year + 1, 1) : inMonth(year, month + 1);
}
