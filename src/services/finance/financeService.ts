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
  /** Lo que se debe en préstamos y otras deudas. */
  loanDebt: Money;
  /** Tarjetas + deudas. */
  totalDebt: Money;
  /** Suma de saldos positivos. */
  assets: Money;
  /** Suma de saldos negativos (tarjetas, deudas, sobregiros). */
  liabilities: Money;
  creditLimit: Money;
  creditAvailable: Money;
  /** Todo lo que se tiene − deudas. El cupo de crédito no suma. */
  netWorth: Money;
  accounts: number;
  debts: number;
  monthStart: ISODate;
  monthIncome: Money;
  monthExpense: Money;
  monthSavings: Money;
  /** % de los ingresos del mes que quedó sin gastar. null sin ingresos. */
  savingsRate: number | null;
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
    loanDebt: n('loan_debt'),
    totalDebt: raw.total_debt === undefined ? n('card_debt') : n('total_debt'),
    assets: n('assets'),
    liabilities: n('liabilities'),
    creditLimit: n('credit_limit'),
    creditAvailable: n('credit_available'),
    netWorth: n('net_worth'),
    accounts: Number(raw.accounts ?? 0),
    debts: Number(raw.debts ?? 0),
    monthStart: String(raw.month_start ?? ''),
    monthIncome: n('month_income'),
    monthExpense: n('month_expense'),
    monthSavings: n('month_income') - n('month_expense'),
    savingsRate: raw.savings_rate === null || raw.savings_rate === undefined ? null : Number(raw.savings_rate),
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
