/**
 * Presupuestos, metas de ahorro, deudas y planificación (Fase 5).
 * Las cifras (gastado, ahorrado, pendiente, %…) las calcula PostgreSQL; la app
 * solo las muestra. Montos en pesos enteros.
 */
import type { ISODate } from '@/lib/dates';
import type { Money } from '@/lib/money';

// ---------------------------------------------------------------- Presupuestos
export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly' | 'custom';
/** scheduled: aún no empieza · ended: ya terminó (personalizado o con fecha final). */
export type BudgetState = 'active' | 'exceeded' | 'scheduled' | 'ended' | 'archived';

export type Budget = {
  id: string;
  /** null = presupuesto general (todos los gastos). */
  categoryId: string | null;
  name: string | null;
  limit: Money;
  period: BudgetPeriod;
  startDate: ISODate;
  endDate: ISODate | null;
  /** Avisos en % (1–100), ordenados. */
  thresholds: number[];
  archivedAt: string | null;
  createdAt: string;
  // Período actual (calculado en el servidor).
  periodStart: ISODate;
  periodEnd: ISODate;
  spent: Money;
  /** Puede ser negativo si se superó el límite. */
  available: Money;
  percentUsed: number;
  state: BudgetState;
  daysLeft: number;
  previousPeriodStart: ISODate | null;
  previousSpent: Money | null;
};

export type BudgetAlert = {
  id: string;
  budgetId: string;
  periodStart: ISODate;
  kind: 'threshold' | 'exceeded';
  threshold: number;
  spent: Money;
  limit: Money;
  createdAt: string;
  seenAt: string | null;
};

export type BudgetPeriodTotal = {
  periodStart: ISODate;
  periodEnd: ISODate;
  spent: Money;
  limit: Money;
  percentUsed: number;
};

// ---------------------------------------------------------------- Metas
export type GoalKind = 'emergency' | 'travel' | 'home' | 'vehicle' | 'education' | 'retirement' | 'purchase' | 'other';
export type GoalState = 'active' | 'completed' | 'overdue' | 'archived';

export type Goal = {
  id: string;
  name: string;
  description: string | null;
  kind: GoalKind;
  target: Money;
  initialSaved: Money;
  startDate: ISODate;
  targetDate: ISODate | null;
  /** Cuenta donde está el dinero. null = sin cuenta asignada. */
  accountId: string | null;
  color: string | null;
  icon: string | null;
  archivedAt: string | null;
  createdAt: string;
  // Progreso (calculado en el servidor).
  saved: Money;
  contributed: Money;
  withdrawn: Money;
  remaining: Money;
  percent: number;
  exceededBy: Money;
  daysLeft: number | null;
  state: GoalState;
  /** Ahorro recomendado; null si la meta no está activa o no tiene fecha. */
  monthlyNeeded: Money | null;
  weeklyNeeded: Money | null;
  dailyNeeded: Money | null;
  unassigned: boolean;
  accountBalance: Money | null;
  /** Lo asignado a todas las metas activas de la misma cuenta. */
  accountAllocated: Money | null;
  movementCount: number;
  lastMovementDate: ISODate | null;
};

export type GoalMovementKind = 'contribution' | 'withdrawal';

export type GoalMovement = {
  id: string;
  goalId: string;
  kind: GoalMovementKind;
  amount: Money;
  date: ISODate;
  note: string | null;
  /** Transferencia real entre cuentas propias, si se movió dinero. */
  transactionId: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
};

// ---------------------------------------------------------------- Deudas
export type LoanKind = 'bank_loan' | 'personal' | 'mortgage' | 'vehicle' | 'education' | 'other';
export type PaymentFrequency = 'none' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
export type InterestPeriod = 'monthly' | 'annual';
export type DebtState = 'active' | 'paid' | 'overdue' | 'archived';
export type DebtPaymentKind = 'installment' | 'extra' | 'interest';

export type DebtRecord = {
  id: string;
  /** Cuenta de tipo «loan» con el saldo de la deuda (nombre, color, archivada). */
  accountId: string;
  name: string;
  color: string | null;
  isActive: boolean;
  kind: LoanKind;
  creditor: string | null;
  originalAmount: Money;
  interestRate: number | null;
  interestPeriod: InterestPeriod | null;
  startDate: ISODate;
  dueDate: ISODate | null;
  installment: Money | null;
  frequency: PaymentFrequency;
  firstPaymentDate: ISODate | null;
  paymentAccountId: string | null;
  description: string | null;
  createdAt: string;
  // Seguimiento (calculado en el servidor).
  outstanding: Money;
  /** Saldo a favor si se pagó de más. */
  creditBalance: Money;
  initialOutstanding: Money;
  /** Lo pagado antes de registrarla en LUJITOS (valor inicial − saldo al registrarla). */
  paidBefore: Money;
  totalPaid: Money;
  installmentsPaid: number;
  interestRegistered: Money;
  disbursed: Money;
  lastPaymentDate: ISODate | null;
  percentPaid: number;
  nextPaymentDate: ISODate | null;
  daysToNextPayment: number | null;
  daysToDue: number | null;
  state: DebtState;
};

// ---------------------------------------------------------------- Planificación
/** De dónde salen los promedios: meses completos, lo que va del mes o nada. */
export type PlanningBasis = 'complete_months' | 'current_month' | 'none';

export type PlanningSnapshot = {
  basis: PlanningBasis;
  monthsUsed: number;
  /** Menos de 3 meses completos de historial. */
  preliminary: boolean;
  incomeAvg: Money | null;
  expenseAvg: Money | null;
  essentialAvg: Money | null;
  fixedAvg: Money | null;
  variableAvg: Money | null;
  savingsAvg: Money | null;
  /** null si no hay ingresos (no se divide por cero). */
  savingsRate: number | null;
  obligationsMonthly: Money;
  obligationDebts: number;
  /** Ingreso promedio − gasto esencial promedio − cuotas del mes. */
  savingsCapacity: Money | null;
  goalsMonthlyNeeded: Money;
  activeGoals: number;
};

export type MonthlyFlow = {
  monthStart: ISODate;
  income: Money;
  expense: Money;
  fixedExpense: Money;
  essentialExpense: Money;
  movements: number;
};

export type CategorySpending = { categoryId: string; total: Money; movements: number };
