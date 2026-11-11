/**
 * Consultas sobre los datos de demostración. Las pantallas solo leen datos
 * desde aquí; en la Fase 3 estas funciones pasan a consultar Supabase.
 */
import { CATEGORIES, getCategory } from '@/constants/categories';
import { groupOf, INSTITUTIONS } from '@/constants/institutions';
import {
  addDays,
  diffInDays,
  formatShortDate,
  MONTHS_SHORT,
  monthKey,
  parseISO,
  toISO,
  WEEKDAYS,
  type ISODate,
} from '@/lib/dates';
import type { Money } from '@/lib/money';
import type {
  Account,
  AccountGroup,
  Category,
  Institution,
  SavingsGoal,
  Transaction,
  TransactionType,
} from '@/types/finance';

import {
  DEMO_ACCOUNTS,
  DEMO_BUDGET,
  DEMO_DEBTS,
  DEMO_EXPENSE_WEIGHTS,
  DEMO_MONTHLY,
  DEMO_TODAY,
  DEMO_TRANSACTIONS,
} from './data';

const sum = (values: Money[]): Money => values.reduce((total, value) => total + value, 0);

// ---------- Cuentas ----------

const accountsById = new Map(DEMO_ACCOUNTS.map((account) => [account.id, account]));

export function getAccounts(): Account[] {
  return DEMO_ACCOUNTS;
}

export function getAccount(id: string | undefined): Account | undefined {
  return id ? accountsById.get(id) : undefined;
}

export function getInstitution(account: Account): Institution {
  return INSTITUTIONS[account.institutionId];
}

const LIQUID_GROUPS: AccountGroup[] = ['banks', 'wallets', 'cash', 'other'];

export function isLiquid(account: Account): boolean {
  return LIQUID_GROUPS.includes(groupOf(account.kind));
}

export function getHomeAccounts(): Account[] {
  return ['acc-bancolombia', 'acc-nequi', 'acc-davivienda', 'acc-cash']
    .map((id) => accountsById.get(id))
    .filter((account): account is Account => Boolean(account));
}

export function getAccountGroups(): { group: AccountGroup; accounts: Account[]; total: Money }[] {
  const order: AccountGroup[] = ['banks', 'wallets', 'cash', 'other', 'investments', 'credit'];
  return order
    .map((group) => {
      const accounts = DEMO_ACCOUNTS.filter((account) => groupOf(account.kind) === group);
      return { group, accounts, total: sum(accounts.map((account) => account.balance)) };
    })
    .filter((entry) => entry.accounts.length > 0);
}

// ---------- Patrimonio ----------

export function getBalanceOverview() {
  const available = sum(DEMO_ACCOUNTS.filter(isLiquid).map((account) => account.balance));
  const investments = sum(
    DEMO_ACCOUNTS.filter((account) => account.kind === 'investment').map((account) => account.balance),
  );
  const debts = sum(DEMO_DEBTS.map((debt) => debt.balance));
  const netWorth = available + investments - debts;
  const current = DEMO_MONTHLY[DEMO_MONTHLY.length - 1];
  const monthSavings = current ? current.income - current.expense : 0;
  return {
    available,
    investments,
    debts,
    netWorth,
    previousNetWorth: netWorth - monthSavings,
    netWorthChange: monthSavings,
  };
}

/** Patrimonio al cierre de cada mes, reconstruido hacia atrás desde hoy. */
function netWorthByMonth(): Money[] {
  const values: Money[] = new Array(DEMO_MONTHLY.length).fill(0);
  let running = getBalanceOverview().netWorth;
  for (let index = DEMO_MONTHLY.length - 1; index >= 0; index -= 1) {
    values[index] = running;
    const month = DEMO_MONTHLY[index];
    if (month) running -= month.income - month.expense;
  }
  return values;
}

// ---------- Movimientos ----------

const sortedTransactions = [...DEMO_TRANSACTIONS].sort((a, b) =>
  a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date),
);

export function getTransaction(id: string | undefined): Transaction | undefined {
  return sortedTransactions.find((transaction) => transaction.id === id);
}

export function getRecentTransactions(limit: number): Transaction[] {
  return sortedTransactions.slice(0, limit);
}

export type TransactionFilter = {
  month?: string;
  type?: TransactionType | 'all';
  accountId?: string | null;
  categoryId?: string | null;
};

export function filterTransactions(filter: TransactionFilter): Transaction[] {
  return sortedTransactions.filter((transaction) => {
    if (filter.month && monthKey(transaction.date) !== filter.month) return false;
    if (filter.type && filter.type !== 'all' && transaction.type !== filter.type) return false;
    if (
      filter.accountId &&
      transaction.accountId !== filter.accountId &&
      transaction.toAccountId !== filter.accountId
    ) {
      return false;
    }
    if (filter.categoryId && transaction.categoryId !== filter.categoryId) return false;
    return true;
  });
}

export function getTransactionsForAccount(accountId: string): Transaction[] {
  return filterTransactions({ accountId });
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

/** Efecto de un movimiento sobre el saldo de una cuenta. */
export function signedAmountFor(transaction: Transaction, accountId?: string): Money {
  if (transaction.type === 'income') return transaction.amount;
  if (transaction.type === 'expense') return -transaction.amount;
  if (accountId && transaction.toAccountId === accountId) return transaction.amount;
  return -transaction.amount;
}

export function totalsOf(transactions: Transaction[]) {
  const income = sum(transactions.filter((t) => t.type === 'income').map((t) => t.amount));
  const expense = sum(transactions.filter((t) => t.type === 'expense').map((t) => t.amount));
  return { income, expense, balance: income - expense };
}

export function getAvailableMonths(): string[] {
  return [...new Set(sortedTransactions.map((transaction) => monthKey(transaction.date)))];
}

// ---------- Resumen del mes ----------

/** Compara el mes en curso con el mismo tramo del mes anterior (del día 1 al día de hoy). */
export function getMonthSummary() {
  const { year, month, day } = parseISO(DEMO_TODAY);
  const currentKey = DEMO_TODAY.slice(0, 7);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const previousStart = toISO(previousYear, previousMonth, 1);
  const previousEnd = toISO(previousYear, previousMonth, day);

  const current = totalsOf(filterTransactions({ month: currentKey }));
  const previous = totalsOf(
    sortedTransactions.filter((t) => t.date >= previousStart && t.date <= previousEnd),
  );
  return {
    income: current.income,
    expense: current.expense,
    savings: current.income - current.expense,
    previousIncome: previous.income,
    previousExpense: previous.expense,
    comparisonLabel: `en ${MONTHS_SHORT[previousMonth - 1]} (1–${day})`,
  };
}

// ---------- Presupuesto ----------

export function getBudgetOverview() {
  const monthTransactions = filterTransactions({ month: DEMO_TODAY.slice(0, 7), type: 'expense' });
  const lines = DEMO_BUDGET.map((line) => {
    const spent = sum(
      monthTransactions.filter((t) => t.categoryId === line.categoryId).map((t) => t.amount),
    );
    return { ...line, category: getCategory(line.categoryId), spent, ratio: spent / line.limit };
  }).sort((a, b) => b.ratio - a.ratio);
  const limit = sum(lines.map((line) => line.limit));
  const spent = sum(lines.map((line) => line.spent));
  const { year, month, day } = parseISO(DEMO_TODAY);
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { lines, limit, spent, remaining: limit - spent, ratio: spent / limit, daysLeft: totalDays - day };
}

// ---------- Metas ----------

export function getGoalPlan(goal: SavingsGoal) {
  const remaining = Math.max(goal.target - goal.saved, 0);
  const days = Math.max(diffInDays(DEMO_TODAY, goal.deadline), 1);
  const months = Math.max(Math.ceil(days / 30.4), 1);
  const weeks = Math.max(Math.ceil(days / 7), 1);
  return {
    remaining,
    ratio: goal.saved / goal.target,
    perMonth: Math.ceil(remaining / months / 100) * 100,
    perWeek: Math.ceil(remaining / weeks / 100) * 100,
    monthsLeft: months,
  };
}

// ---------- Estadísticas ----------

export type StatsPeriod = 'week' | 'month' | '3m' | '6m' | 'year';

export type SeriesPoint = {
  label: string;
  detail: string;
  income: Money;
  expense: Money;
  savings: Money;
  netWorth: Money;
};

function bucketByDays(start: ISODate, days: number, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const from = addDays(start, index * days);
    const to = addDays(from, days - 1);
    const totals = totalsOf(sortedTransactions.filter((t) => t.date >= from && t.date <= to));
    return { from, to, ...totals };
  });
}

function withNetWorth(points: Omit<SeriesPoint, 'netWorth'>[], endValue: Money): SeriesPoint[] {
  const result: SeriesPoint[] = [];
  let running = endValue;
  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (!point) continue;
    result.unshift({ ...point, netWorth: running });
    running -= point.savings;
  }
  return result;
}

export function getStats(period: StatsPeriod) {
  const netWorthNow = getBalanceOverview().netWorth;
  let points: SeriesPoint[];
  let categoryTotals: Map<string, Money>;

  if (period === 'week' || period === 'month') {
    const isWeek = period === 'week';
    const start = addDays(DEMO_TODAY, isWeek ? -6 : -27);
    const buckets = bucketByDays(start, isWeek ? 1 : 7, isWeek ? 7 : 4);
    points = withNetWorth(
      buckets.map((bucket) => {
        const weekday = WEEKDAYS[new Date(`${bucket.from}T12:00:00Z`).getUTCDay()] ?? '';
        return {
          label: isWeek ? weekday.slice(0, 3) : formatShortDate(bucket.from),
          detail: isWeek
            ? `${weekday} ${parseISO(bucket.from).day}`
            : `${formatShortDate(bucket.from)} – ${formatShortDate(bucket.to)}`,
          income: bucket.income,
          expense: bucket.expense,
          savings: bucket.income - bucket.expense,
        };
      }),
      netWorthNow,
    );
    categoryTotals = new Map();
    for (const t of sortedTransactions) {
      if (t.type !== 'expense' || t.date < start || t.date > DEMO_TODAY || !t.categoryId) continue;
      categoryTotals.set(t.categoryId, (categoryTotals.get(t.categoryId) ?? 0) + t.amount);
    }
  } else {
    const count = period === '3m' ? 3 : period === '6m' ? 6 : 12;
    const months = DEMO_MONTHLY.slice(-count);
    const allNetWorth = netWorthByMonth().slice(-count);
    points = months.map((entry, index) => {
      const { year, month } = parseISO(`${entry.month}-01`);
      return {
        label: MONTHS_SHORT[month - 1] ?? '',
        detail: `${MONTHS_SHORT[month - 1]} ${year}`,
        income: entry.income,
        expense: entry.expense,
        savings: entry.income - entry.expense,
        netWorth: allNetWorth[index] ?? 0,
      };
    });
    categoryTotals = new Map();
    const currentKey = DEMO_TODAY.slice(0, 7);
    for (const entry of months) {
      if (entry.month === currentKey) {
        for (const t of filterTransactions({ month: currentKey, type: 'expense' })) {
          if (!t.categoryId) continue;
          categoryTotals.set(t.categoryId, (categoryTotals.get(t.categoryId) ?? 0) + t.amount);
        }
      } else {
        for (const [categoryId, weight] of Object.entries(DEMO_EXPENSE_WEIGHTS)) {
          const value = Math.round((entry.expense * weight) / 100) * 100;
          categoryTotals.set(categoryId, (categoryTotals.get(categoryId) ?? 0) + value);
        }
      }
    }
  }

  const income = sum(points.map((p) => p.income));
  const expense = sum(points.map((p) => p.expense));
  const categories: { category: Category; amount: Money }[] = [...categoryTotals.entries()]
    .map(([id, amount]) => ({ category: getCategory(id), amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    points,
    income,
    expense,
    savings: income - expense,
    savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0,
    categories,
  };
}

/** Distribución del dinero por tipo de cuenta (sin deudas). */
export function getDistribution() {
  return getAccountGroups()
    .filter((entry) => entry.group !== 'credit')
    .map((entry) => ({ group: entry.group, total: entry.total }));
}

/** Evolución del saldo de una cuenta, reconstruida hacia atrás desde hoy. */
export function getAccountBalanceSeries(accountId: string): { label: string; value: Money }[] {
  const account = getAccount(accountId);
  if (!account) return [];
  const transactions = getTransactionsForAccount(accountId);
  const start = addDays(DEMO_TODAY, -27);
  const points: { label: string; value: Money }[] = [];
  let running = account.balance;
  for (let index = 0; index < 8; index += 1) {
    const date = addDays(DEMO_TODAY, -index * 4);
    const nextDate = addDays(date, 4);
    if (index > 0) {
      running -= sum(
        transactions
          .filter((t) => t.date > date && t.date <= nextDate)
          .map((t) => signedAmountFor(t, accountId)),
      );
    }
    points.unshift({ label: formatShortDate(date), value: running });
    if (date < start) break;
  }
  return points;
}

export function getCategoriesWithSpending() {
  return CATEGORIES;
}
