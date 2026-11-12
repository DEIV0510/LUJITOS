/**
 * Validaciones de los formularios de presupuestos, metas, deudas y pagos.
 * El servidor valida todo otra vez; aquí solo se evita enviar algo inválido.
 */
import type { ISODate } from '@/lib/dates';
import type { Money } from '@/lib/money';
import type { BudgetPeriod, InterestPeriod, PaymentFrequency } from '@/types/planning';

const MAX_AMOUNT = 999_999_999_999_999;
const validAmount = (value: Money) => Number.isInteger(value) && value > 0 && value <= MAX_AMOUNT;

// ---------------------------------------------------------------- Presupuesto
export type BudgetDraft = {
  limit: Money;
  period: BudgetPeriod;
  startDate: ISODate;
  endDate: ISODate | null;
  thresholds: number[];
  name: string;
};
export type BudgetErrors = Partial<Record<'limit' | 'endDate' | 'thresholds' | 'name', string>>;

export function validateBudgetDraft(draft: BudgetDraft): BudgetErrors {
  const errors: BudgetErrors = {};
  if (!validAmount(draft.limit)) errors.limit = 'Escribe un límite mayor que cero.';
  if (draft.period === 'custom' && !draft.endDate) errors.endDate = 'Elige hasta cuándo va el período.';
  else if (draft.endDate && draft.endDate < draft.startDate) errors.endDate = 'La fecha final debe ser igual o posterior al inicio.';
  if (draft.thresholds.length > 6) errors.thresholds = 'Elige hasta 6 avisos.';
  if (draft.thresholds.some((value) => !Number.isInteger(value) || value < 1 || value > 100)) {
    errors.thresholds = 'Cada aviso debe estar entre 1 y 100.';
  }
  if (draft.name.trim().length > 60) errors.name = 'Máximo 60 caracteres.';
  return errors;
}

// ---------------------------------------------------------------- Meta
export type GoalDraft = {
  name: string;
  target: Money;
  initialSaved: Money;
  startDate: ISODate;
  targetDate: ISODate | null;
  description: string;
};
export type GoalErrors = Partial<Record<'name' | 'target' | 'initialSaved' | 'targetDate' | 'description', string>>;

export function validateGoalDraft(draft: GoalDraft): GoalErrors {
  const errors: GoalErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = 'Escribe un nombre para la meta.';
  else if (name.length > 60) errors.name = 'Máximo 60 caracteres.';
  if (!validAmount(draft.target)) errors.target = 'Escribe cuánto quieres ahorrar.';
  if (!Number.isInteger(draft.initialSaved) || draft.initialSaved < 0 || draft.initialSaved > MAX_AMOUNT) {
    errors.initialSaved = 'No puede ser negativo.';
  }
  if (draft.targetDate && draft.targetDate < draft.startDate) errors.targetDate = 'Debe ser posterior al inicio.';
  if (draft.description.length > 280) errors.description = 'Máximo 280 caracteres.';
  return errors;
}

// ---------------------------------------------------------------- Deuda
export type DebtDraft = {
  name: string;
  creditor: string;
  originalAmount: Money;
  outstanding: Money;
  /** Tasa escrita por el usuario («1,5»). Vacío = sin interés. */
  rateText: string;
  ratePeriod: InterestPeriod;
  startDate: ISODate;
  dueDate: ISODate | null;
  frequency: PaymentFrequency;
  installment: Money;
  firstPaymentDate: ISODate | null;
  description: string;
};
export type DebtErrors = Partial<
  Record<'name' | 'creditor' | 'originalAmount' | 'outstanding' | 'rate' | 'dueDate' | 'installment' | 'firstPaymentDate' | 'description', string>
>;

/** «1,5» o «1.5» → 1.5. Vacío → null. Texto inválido → NaN. */
export function parseRate(text: string): number | null {
  const clean = text.trim().replace('%', '').replace(',', '.');
  if (!clean) return null;
  return /^\d{1,3}(\.\d{1,4})?$/.test(clean) ? Number(clean) : Number.NaN;
}

export function validateDebtDraft(draft: DebtDraft): DebtErrors {
  const errors: DebtErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = 'Escribe un nombre para la deuda.';
  else if (name.length > 60) errors.name = 'Máximo 60 caracteres.';
  if (draft.creditor.trim().length > 60) errors.creditor = 'Máximo 60 caracteres.';
  if (!validAmount(draft.originalAmount)) errors.originalAmount = 'Escribe cuánto te prestaron.';
  if (!validAmount(draft.outstanding)) errors.outstanding = 'Escribe cuánto debes hoy.';
  const rate = parseRate(draft.rateText);
  if (rate !== null && (Number.isNaN(rate) || rate > 999)) errors.rate = 'Escribe la tasa como 1,5 (máximo 4 decimales).';
  if (draft.dueDate && draft.dueDate < draft.startDate) errors.dueDate = 'Debe ser posterior al inicio.';
  if (draft.frequency !== 'none') {
    if (!validAmount(draft.installment)) errors.installment = 'Escribe el valor de la cuota.';
    if (!draft.firstPaymentDate) errors.firstPaymentDate = 'Elige la fecha del próximo pago.';
  }
  if (draft.description.length > 280) errors.description = 'Máximo 280 caracteres.';
  return errors;
}

// ---------------------------------------------------------------- Pagos y aportes
export function validatePaymentAmount(amount: Money): string | undefined {
  return validAmount(amount) ? undefined : 'Escribe un valor mayor que cero.';
}

export function validateInterestPortion(portion: Money, amount: Money): string | undefined {
  if (!Number.isInteger(portion) || portion < 0) return 'No puede ser negativo.';
  if (portion > amount) return 'No puede ser mayor que el pago.';
  return undefined;
}
