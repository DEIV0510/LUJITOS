/**
 * Cálculos puros sobre listas de cuentas y movimientos (sirven igual para
 * datos reales y de demostración). Sin efectos ni consultas.
 */
import { groupOf } from '@/constants/institutions';
import { monthKey, type ISODate } from '@/lib/dates';
import type { Money } from '@/lib/money';
import type { FinancialSummary } from '@/services/finance/financeService';
import type { Account, AccountGroup, Transaction } from '@/types/finance';

const sum = (values: Money[]): Money => values.reduce((total, value) => total + value, 0);

/** Dinero disponible: bancos, billeteras y efectivo (igual que financial_summary). */
const LIQUID: AccountGroup[] = ['banks', 'wallets', 'cash'];

export function isLiquidAccount(account: Account): boolean {
  return LIQUID.includes(groupOf(account.kind));
}

/** Efecto de un movimiento sobre el saldo de una cuenta concreta. */
export function signedAmountFor(transaction: Transaction, accountId?: string): Money {
  if (transaction.type === 'income') return transaction.amount;
  if (transaction.type === 'adjustment') return transaction.amount * (transaction.adjustmentSign ?? 1);
  if (transaction.type === 'expense') return -transaction.amount;
  if (accountId && transaction.toAccountId === accountId) return transaction.amount;
  return -transaction.amount;
}

/** Ingresos y gastos. Transferencias y ajustes NO cuentan como ingreso ni gasto. */
export function totalsOf(transactions: Transaction[]) {
  const income = sum(transactions.filter((t) => t.type === 'income').map((t) => t.amount));
  const expense = sum(transactions.filter((t) => t.type === 'expense').map((t) => t.amount));
  return { income, expense, balance: income - expense };
}

export function groupByDay(transactions: Transaction[]): { date: ISODate; data: Transaction[] }[] {
  const groups = new Map<ISODate, Transaction[]>();
  for (const transaction of transactions) {
    const list = groups.get(transaction.date) ?? [];
    list.push(transaction);
    groups.set(transaction.date, list);
  }
  return [...groups.entries()].map(([date, data]) => ({ date, data }));
}

export function inMonth(transactions: Transaction[], key: string): Transaction[] {
  return transactions.filter((transaction) => monthKey(transaction.date) === key);
}

/**
 * Resumen patrimonial a partir de saldos de cuentas reales.
 * Cada cuenta se cuenta una vez; la deuda de tarjetas es su saldo negativo.
 */
export function accountsOverview(accounts: Account[]) {
  const active = accounts.filter((account) => account.isActive !== false);
  const available = sum(active.filter(isLiquidAccount).map((account) => account.balance));
  const investments = sum(active.filter((account) => groupOf(account.kind) === 'investments').map((account) => account.balance));
  const debts = -sum(
    active.filter((account) => account.kind === 'credit_card' && account.balance < 0).map((account) => account.balance),
  );
  const netWorth = sum(active.map((account) => account.balance));
  return { available, investments, debts, netWorth };
}

/**
 * Resumen financiero de una lista de cuentas con la MISMA lógica que
 * public.financial_summary(). Solo para el modo demostración: con datos reales
 * las cifras vienen siempre del servidor.
 */
export function summaryFromAccounts(accounts: Account[], transactions: Transaction[], monthStartKey: string): FinancialSummary {
  const active = accounts.filter((account) => account.isActive !== false);
  const of = (group: AccountGroup) => sum(active.filter((account) => groupOf(account.kind) === group).map((a) => a.balance));
  const cards = active.filter((account) => account.kind === 'credit_card');
  const banks = of('banks');
  const wallets = of('wallets');
  const cash = of('cash');
  const loans = active.filter((account) => account.kind === 'loan');
  const month = inMonth(
    transactions.filter((t) => !t.voidedAt),
    monthStartKey,
  );
  const { income, expense } = totalsOf(month);
  const cardDebt = sum(cards.map((card) => Math.max(-card.balance, 0)));
  const loanDebt = sum(loans.map((loan) => Math.max(-loan.balance, 0)));
  return {
    available: banks + wallets + cash,
    banks,
    wallets,
    cash,
    invested: of('investments'),
    other: of('other'),
    cardDebt,
    loanDebt,
    totalDebt: cardDebt + loanDebt,
    assets: sum(active.map((account) => Math.max(account.balance, 0))),
    liabilities: sum(active.map((account) => Math.max(-account.balance, 0))),
    creditLimit: sum(cards.map((card) => card.creditLimit ?? 0)),
    creditAvailable: sum(cards.filter((card) => card.creditLimit).map((card) => Math.max((card.creditLimit ?? 0) + card.balance, 0))),
    netWorth: sum(active.map((account) => account.balance)),
    accounts: active.length - loans.length,
    debts: loans.length,
    monthStart: `${monthStartKey}-01`,
    monthIncome: income,
    monthExpense: expense,
    monthSavings: income - expense,
    savingsRate: income > 0 ? Math.round(((income - expense) * 10000) / income) / 100 : null,
  };
}

export function groupAccounts(accounts: Account[]): { group: AccountGroup; accounts: Account[]; total: Money }[] {
  const order: AccountGroup[] = ['banks', 'wallets', 'cash', 'other', 'investments', 'credit'];
  const active = accounts.filter((account) => account.isActive !== false);
  return order
    .map((group) => {
      const list = active.filter((account) => groupOf(account.kind) === group);
      return { group, accounts: list, total: sum(list.map((account) => account.balance)) };
    })
    .filter((entry) => entry.accounts.length > 0);
}
