/**
 * Cifras calculadas en PostgreSQL (fuente de verdad). La app no suma saldos
 * por su cuenta para mostrar totales reales.
 */
import { fromDb, type Money } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import type { ISODate } from '@/lib/dates';

import { financeFailure } from './errors';

export type FinancialSummary = {
  /** Bancos + billeteras + efectivo. */
  available: Money;
  banks: Money;
  wallets: Money;
  cash: Money;
  /** Inversiones, CDT y fondos (no disponible). */
  invested: Money;
  /** Cuentas personalizadas. */
  other: Money;
  /** Lo que se debe en tarjetas. */
  cardDebt: Money;
  creditLimit: Money;
  creditAvailable: Money;
  /** Todo lo que se tiene − deudas. El cupo de crédito no suma. */
  netWorth: Money;
  accounts: number;
  monthStart: ISODate;
  monthIncome: Money;
  monthExpense: Money;
};

export function parseSummary(raw: Record<string, unknown>): FinancialSummary {
  const n = (key: string) => fromDb((raw[key] as number | string | null | undefined) ?? 0);
  return {
    available: n('available'),
    banks: n('banks'),
    wallets: n('wallets'),
    cash: n('cash'),
    invested: n('invested'),
    other: n('other'),
    cardDebt: n('card_debt'),
    creditLimit: n('credit_limit'),
    creditAvailable: n('credit_available'),
    netWorth: n('net_worth'),
    accounts: Number(raw.accounts ?? 0),
    monthStart: String(raw.month_start ?? ''),
    monthIncome: n('month_income'),
    monthExpense: n('month_expense'),
  };
}

export async function fetchFinancialSummary(): Promise<FinancialSummary> {
  const { data, error } = await supabase.rpc('financial_summary', {});
  if (error) throw financeFailure('finance.summary', error);
  return parseSummary((data ?? {}) as Record<string, unknown>);
}

export type BalancePoint = { date: ISODate; balance: Money };

/** Saldo al cierre de cada día del rango (para el gráfico de la cuenta). */
export async function fetchBalanceHistory(accountId: string, from: ISODate, to: ISODate): Promise<BalancePoint[]> {
  const { data, error } = await supabase.rpc('account_balance_history', { p_account_id: accountId, p_from: from, p_to: to });
  if (error) throw financeFailure('finance.history', error);
  return (data ?? []).map((row) => ({ date: row.day, balance: fromDb(row.balance) }));
}
