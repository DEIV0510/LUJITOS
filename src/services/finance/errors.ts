/**
 * Errores del motor financiero (funciones RPC). Los códigos LJ0xx los definen
 * las migraciones finance_engine (LJ001–LJ009) y budgets_goals_debts (LJ010–LJ013); sus mensajes ya vienen
 * en español desde el servidor. Algunos son advertencias que el usuario puede
 * confirmar (saldo negativo, cupo, transferencia repetida, archivar con saldo).
 */
import { logError } from '@/lib/logger';
import { dbErrorMessage } from '@/services/database/errors';

export type FinanceErrorCode =
  | 'insufficient_funds'
  | 'over_credit_limit'
  | 'duplicate_transfer'
  | 'account_has_balance'
  | 'stale_balance'
  | 'not_found'
  | 'invalid'
  | 'voided'
  | 'category_in_use'
  | 'goal_below_zero'
  | 'overpayment'
  | 'duplicate_budget'
  | 'has_history'
  | 'unknown';

const BY_SQLSTATE: Record<string, FinanceErrorCode> = {
  LJ001: 'insufficient_funds',
  LJ002: 'over_credit_limit',
  LJ003: 'duplicate_transfer',
  LJ004: 'account_has_balance',
  LJ005: 'stale_balance',
  LJ006: 'not_found',
  LJ007: 'invalid',
  LJ008: 'voided',
  LJ009: 'category_in_use',
  LJ010: 'goal_below_zero',
  LJ011: 'overpayment',
  LJ012: 'duplicate_budget',
  LJ013: 'has_history',
};

export class FinanceError extends Error {
  readonly code: FinanceErrorCode;
  /** Dato que acompaña al error: saldo resultante, cupo disponible, saldo actual… */
  readonly detail: string | null;

  constructor(message: string, code: FinanceErrorCode, detail: string | null) {
    super(message);
    this.name = 'FinanceError';
    this.code = code;
    this.detail = detail;
  }

  /** El detalle como monto en pesos, si lo es. */
  get detailAmount(): number | null {
    if (this.detail === null || !/^-?\d+$/.test(this.detail)) return null;
    return Number(this.detail);
  }
}

type RpcLikeError = { code?: string; message?: string; details?: string | null } | null | undefined;

/** Registra el error (sin datos sensibles) y lo traduce. */
export function financeFailure(context: string, error: RpcLikeError): FinanceError {
  logError(context, error);
  const code = (error?.code && BY_SQLSTATE[error.code]) || 'unknown';
  const message = code !== 'unknown' && error?.message ? error.message : dbErrorMessage(error);
  return new FinanceError(message, code, typeof error?.details === 'string' ? error.details : null);
}

export function isFinanceError(error: unknown, code?: FinanceErrorCode): error is FinanceError {
  return error instanceof FinanceError && (code === undefined || error.code === code);
}

export function errorMessage(error: unknown, fallback = 'No pudimos completar la operación.'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
