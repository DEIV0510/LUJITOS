/** Filas de la base (Fase 5) → modelo de la app. */
import { fromDb } from '@/lib/money';
import type {
  BudgetAlertRow,
  BudgetRow,
  BudgetStatusRow,
  DebtOverviewRow,
  DebtRow,
  SavingsGoalMovementRow,
  SavingsGoalProgressRow,
  SavingsGoalRow,
} from '@/types/database';
import type { Account } from '@/types/finance';
import type {
  Budget,
  BudgetAlert,
  BudgetPeriod,
  BudgetState,
  DebtRecord,
  DebtState,
  Goal,
  GoalKind,
  GoalMovement,
  GoalState,
  InterestPeriod,
  LoanKind,
  PaymentFrequency,
  PlanningBasis,
  PlanningSnapshot,
} from '@/types/planning';

function oneOf<T extends string>(value: string | null | undefined, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

const money = (value: number | string | null | undefined) => fromDb(value ?? 0);
const moneyOrNull = (value: number | string | null | undefined) => (value === null || value === undefined ? null : fromDb(value));

export const BUDGET_PERIODS = ['weekly', 'monthly', 'yearly', 'custom'] as const;
const BUDGET_STATES = ['active', 'exceeded', 'scheduled', 'ended', 'archived'] as const;
export const GOAL_KINDS = ['emergency', 'travel', 'home', 'vehicle', 'education', 'retirement', 'purchase', 'other'] as const;
const GOAL_STATES = ['active', 'completed', 'overdue', 'archived'] as const;
export const LOAN_KINDS = ['bank_loan', 'personal', 'mortgage', 'vehicle', 'education', 'other'] as const;
export const PAYMENT_FREQUENCIES = ['none', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const;
const DEBT_STATES = ['active', 'paid', 'overdue', 'archived'] as const;

export function mapBudget(row: BudgetRow, status: BudgetStatusRow | undefined): Budget {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    limit: money(row.limit_amount),
    period: oneOf<BudgetPeriod>(row.period, BUDGET_PERIODS, 'monthly'),
    startDate: row.start_date,
    endDate: row.end_date,
    thresholds: [...row.alert_thresholds].sort((a, b) => a - b),
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    periodStart: status?.period_start ?? row.start_date,
    periodEnd: status?.period_end ?? row.end_date ?? row.start_date,
    spent: money(status?.spent),
    available: status ? money(status.available) : money(row.limit_amount),
    percentUsed: Number(status?.percent_used ?? 0),
    state: oneOf<BudgetState>(status?.status, BUDGET_STATES, row.archived_at ? 'archived' : 'active'),
    daysLeft: Number(status?.days_left ?? 0),
    previousPeriodStart: status?.previous_period_start ?? null,
    previousSpent: moneyOrNull(status?.previous_spent),
  };
}

export function mapBudgetAlert(row: BudgetAlertRow): BudgetAlert {
  return {
    id: row.id,
    budgetId: row.budget_id,
    periodStart: row.period_start,
    kind: row.kind === 'exceeded' ? 'exceeded' : 'threshold',
    threshold: row.threshold,
    spent: money(row.spent),
    limit: money(row.limit_amount),
    createdAt: row.created_at,
    seenAt: row.seen_at,
  };
}

export function mapGoal(row: SavingsGoalRow, progress: SavingsGoalProgressRow | undefined): Goal {
  const target = money(row.target_amount);
  const saved = progress ? money(progress.saved) : money(row.initial_saved);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    kind: oneOf<GoalKind>(row.kind, GOAL_KINDS, 'other'),
    target,
    initialSaved: money(row.initial_saved),
    startDate: row.start_date,
    targetDate: row.target_date,
    accountId: row.account_id,
    color: row.color,
    icon: row.icon,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    saved,
    contributed: money(progress?.contributed),
    withdrawn: money(progress?.withdrawn),
    remaining: progress ? money(progress.remaining) : Math.max(target - saved, 0),
    percent: Number(progress?.percent ?? 0),
    exceededBy: money(progress?.exceeded_by),
    daysLeft: progress?.days_left ?? null,
    state: oneOf<GoalState>(progress?.status, GOAL_STATES, row.archived_at ? 'archived' : 'active'),
    monthlyNeeded: moneyOrNull(progress?.monthly_needed),
    weeklyNeeded: moneyOrNull(progress?.weekly_needed),
    dailyNeeded: moneyOrNull(progress?.daily_needed),
    unassigned: row.account_id === null,
    accountBalance: moneyOrNull(progress?.account_balance),
    accountAllocated: moneyOrNull(progress?.account_allocated),
    movementCount: Number(progress?.movement_count ?? 0),
    lastMovementDate: progress?.last_movement_date ?? null,
  };
}

export function mapGoalMovement(row: SavingsGoalMovementRow): GoalMovement {
  return {
    id: row.id,
    goalId: row.goal_id,
    kind: row.kind === 'withdrawal' ? 'withdrawal' : 'contribution',
    amount: money(row.amount),
    date: row.movement_date,
    note: row.note,
    transactionId: row.transaction_id,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    createdAt: row.created_at,
  };
}

export function mapDebt(row: DebtRow, overview: DebtOverviewRow | undefined, account: Account | undefined): DebtRecord {
  const outstanding = overview ? money(overview.outstanding) : Math.max(-(account?.balance ?? 0), 0);
  return {
    id: row.id,
    accountId: row.account_id,
    name: account?.name ?? 'Deuda',
    color: account?.color ?? null,
    isActive: account?.isActive !== false,
    kind: oneOf<LoanKind>(row.kind, LOAN_KINDS, 'other'),
    creditor: row.creditor,
    originalAmount: money(row.original_amount),
    interestRate: row.interest_rate === null ? null : Number(row.interest_rate),
    interestPeriod: row.interest_period === null ? null : oneOf<InterestPeriod>(row.interest_period, ['monthly', 'annual'], 'monthly'),
    startDate: row.start_date,
    dueDate: row.due_date,
    installment: moneyOrNull(row.installment_amount),
    frequency: oneOf<PaymentFrequency>(row.frequency, PAYMENT_FREQUENCIES, 'none'),
    firstPaymentDate: row.first_payment_date,
    paymentAccountId: row.payment_account_id,
    description: row.description,
    createdAt: row.created_at,
    outstanding,
    creditBalance: money(overview?.credit_balance),
    initialOutstanding: money(overview?.initial_outstanding),
    paidBefore: money(overview?.paid_before),
    totalPaid: money(overview?.total_paid),
    installmentsPaid: Number(overview?.installments_paid ?? 0),
    interestRegistered: money(overview?.interest_registered),
    disbursed: money(overview?.disbursed),
    lastPaymentDate: overview?.last_payment_date ?? null,
    percentPaid: Number(overview?.percent_paid ?? 0),
    nextPaymentDate: overview?.next_payment_date ?? null,
    daysToNextPayment: overview?.days_to_next_payment ?? null,
    daysToDue: overview?.days_to_due ?? null,
    state: oneOf<DebtState>(overview?.status, DEBT_STATES, account?.isActive === false ? 'archived' : 'active'),
  };
}

/** Respuesta de planning_snapshot() (jsonb) → modelo. */
export function parsePlanning(raw: Record<string, unknown>): PlanningSnapshot {
  const nullable = (key: string) => {
    const value = raw[key];
    return value === null || value === undefined ? null : fromDb(value as number | string);
  };
  const rate = raw.savings_rate;
  return {
    basis: oneOf<PlanningBasis>(String(raw.basis ?? ''), ['complete_months', 'current_month', 'none'], 'none'),
    monthsUsed: Number(raw.months_used ?? 0),
    preliminary: raw.preliminary !== false,
    incomeAvg: nullable('income_avg'),
    expenseAvg: nullable('expense_avg'),
    essentialAvg: nullable('essential_avg'),
    fixedAvg: nullable('fixed_avg'),
    variableAvg: nullable('variable_avg'),
    savingsAvg: nullable('savings_avg'),
    savingsRate: rate === null || rate === undefined ? null : Number(rate),
    obligationsMonthly: fromDb((raw.obligations_monthly as number | null) ?? 0),
    obligationDebts: Number(raw.obligation_debts ?? 0),
    savingsCapacity: nullable('savings_capacity'),
    goalsMonthlyNeeded: fromDb((raw.goals_monthly_needed as number | null) ?? 0),
    activeGoals: Number(raw.active_goals ?? 0),
  };
}
