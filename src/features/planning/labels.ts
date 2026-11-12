/** Textos e íconos de presupuestos, metas y deudas. */
import { MONTHS_SHORT, MONTHS, capitalize, parseISO, type ISODate } from '@/lib/dates';
import type { Category, IconName } from '@/types/finance';
import type {
  Budget,
  BudgetPeriod,
  BudgetState,
  DebtPaymentKind,
  DebtState,
  GoalKind,
  GoalState,
  LoanKind,
  PaymentFrequency,
} from '@/types/planning';

export const DEFAULT_THRESHOLDS = [50, 75, 90, 100];
/** Opciones de aviso que se ofrecen en el formulario. */
export const THRESHOLD_OPTIONS = [50, 70, 75, 80, 85, 90, 100];

export const BUDGET_PERIOD_LABEL: Record<BudgetPeriod, string> = {
  weekly: 'Semanal',
  monthly: 'Mensual',
  yearly: 'Anual',
  custom: 'Personalizado',
};

export const BUDGET_STATE_LABEL: Record<BudgetState, string> = {
  active: 'En curso',
  exceeded: 'Superado',
  scheduled: 'Programado',
  ended: 'Terminado',
  archived: 'Archivado',
};

export const GOAL_KIND_LABEL: Record<GoalKind, string> = {
  emergency: 'Fondo de emergencia',
  travel: 'Viaje',
  home: 'Vivienda',
  vehicle: 'Vehículo',
  education: 'Educación',
  retirement: 'Retiro',
  purchase: 'Compra',
  other: 'Otra meta',
};

export const GOAL_KIND_ICON: Record<GoalKind, IconName> = {
  emergency: 'cross.case.fill',
  travel: 'airplane',
  home: 'house.fill',
  vehicle: 'car.fill',
  education: 'graduationcap.fill',
  retirement: 'leaf.fill',
  purchase: 'bag.fill',
  other: 'target',
};

export const GOAL_STATE_LABEL: Record<GoalState, string> = {
  active: 'En curso',
  completed: 'Cumplida',
  overdue: 'Vencida',
  archived: 'Archivada',
};

export const LOAN_KIND_LABEL: Record<LoanKind, string> = {
  bank_loan: 'Crédito bancario',
  personal: 'Préstamo personal',
  mortgage: 'Crédito hipotecario',
  vehicle: 'Crédito de vehículo',
  education: 'Crédito educativo',
  other: 'Otra deuda',
};

export const LOAN_KIND_ICON: Record<LoanKind, IconName> = {
  bank_loan: 'building.columns.fill',
  personal: 'person.2.fill',
  mortgage: 'house.fill',
  vehicle: 'car.fill',
  education: 'graduationcap.fill',
  other: 'banknote',
};

export const FREQUENCY_LABEL: Record<PaymentFrequency, string> = {
  none: 'Sin cuotas fijas',
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

export const DEBT_STATE_LABEL: Record<DebtState, string> = {
  active: 'Al día',
  paid: 'Pagada',
  overdue: 'Pago vencido',
  archived: 'Archivada',
};

export const PAYMENT_KIND_LABEL: Record<DebtPaymentKind, string> = {
  installment: 'Cuota',
  extra: 'Abono extra',
  interest: 'Interés',
};

/** Nombre visible: el escrito, el de la categoría o «Presupuesto general». */
export function budgetName(budget: Pick<Budget, 'name' | 'categoryId'>, category: Category | undefined): string {
  if (budget.name) return budget.name;
  if (budget.categoryId && category) return category.name;
  return 'Presupuesto general';
}

function shortDate(iso: ISODate): string {
  const { day, month } = parseISO(iso);
  return `${day} ${MONTHS_SHORT[month - 1] ?? ''}`;
}

/** «Noviembre 2026», «10–16 nov», «2026» o «10 nov – 20 dic». */
export function periodLabel(period: BudgetPeriod, start: ISODate, end: ISODate): string {
  const s = parseISO(start);
  const e = parseISO(end);
  if (period === 'monthly') return `${capitalize(MONTHS[s.month - 1] ?? '')} ${s.year}`;
  if (period === 'yearly') return String(s.year);
  if (period === 'weekly' && s.month === e.month) return `${s.day}–${e.day} ${MONTHS_SHORT[s.month - 1] ?? ''}`;
  return `${shortDate(start)} – ${shortDate(end)}${s.year !== e.year ? ` ${e.year}` : ''}`;
}

/** «Hoy», «Mañana», «En 5 días», «Hace 3 días». */
export function relativeDays(days: number | null): string {
  if (days === null) return '';
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days === -1) return 'Ayer';
  return days > 0 ? `En ${days} días` : `Hace ${-days} días`;
}
