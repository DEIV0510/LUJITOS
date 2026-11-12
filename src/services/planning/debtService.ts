/**
 * Deudas. Cada deuda tiene una cuenta de tipo «loan» (saldo negativo = lo que
 * se debe). Un pago es una transferencia desde la cuenta de pago: no es gasto
 * ni cambia el patrimonio. Un interés es un gasto que aumenta la deuda.
 * Editar o revertir un pago = editar o anular su movimiento (servicio de movimientos).
 */
import type { Money } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { financeFailure } from '@/services/finance/errors';
import type { WriteOptions } from '@/services/transactions/transactionService';
import type { Account } from '@/types/finance';
import type { DebtPaymentKind, DebtRecord, InterestPeriod, LoanKind, PaymentFrequency } from '@/types/planning';

import { mapDebt } from './mappers';

/** accounts: las cuentas ya cargadas (incluidas las de deuda) para el nombre y el estado. */
export async function fetchDebts(accounts: Account[]): Promise<DebtRecord[]> {
  const [debts, overview] = await Promise.all([
    supabase.from('debts').select('*').order('created_at', { ascending: true }),
    supabase.from('debt_overview').select('*'),
  ]);
  if (debts.error) throw financeFailure('debts.fetch', debts.error);
  if (overview.error) throw financeFailure('debts.fetchOverview', overview.error);
  const byId = new Map(overview.data.map((row) => [row.debt_id, row]));
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  return debts.data.map((row) => mapDebt(row, byId.get(row.id), accountById.get(row.account_id)));
}

export type DebtInput = {
  name: string;
  kind: LoanKind;
  creditor?: string | null;
  originalAmount: Money;
  /** Saldo pendiente al registrarla en LUJITOS. */
  outstanding: Money;
  interestRate: number | null;
  interestPeriod: InterestPeriod | null;
  startDate: string;
  dueDate: string | null;
  installment: Money | null;
  frequency: PaymentFrequency;
  firstPaymentDate: string | null;
  paymentAccountId: string | null;
  description?: string | null;
  color?: string | null;
};

function debtArgs(input: DebtInput) {
  const scheduled = input.frequency !== 'none';
  return {
    p_name: input.name.trim(),
    p_original_amount: input.originalAmount,
    p_kind: input.kind,
    p_creditor: input.creditor?.trim() || null,
    p_interest_rate: input.interestRate,
    p_interest_period: input.interestRate === null ? null : input.interestPeriod,
    p_start_date: input.startDate,
    p_due_date: input.dueDate,
    p_installment_amount: input.installment || null,
    p_frequency: input.frequency,
    p_first_payment_date: scheduled ? input.firstPaymentDate : null,
    p_payment_account_id: input.paymentAccountId,
    p_description: input.description?.trim() || null,
    p_color: input.color ?? null,
  };
}

export async function createDebt(input: DebtInput, requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_debt', {
    ...debtArgs(input),
    p_outstanding: input.outstanding,
    p_request_id: requestId,
  });
  if (error) throw financeFailure('debts.create', error);
  return data;
}

/** El saldo inicial solo cambia si la deuda aún no tiene movimientos (si no, «Corregir saldo»). */
export async function updateDebt(debtId: string, input: DebtInput): Promise<void> {
  const { error } = await supabase.rpc('update_debt', {
    p_debt_id: debtId,
    ...debtArgs(input),
    p_initial_outstanding: input.outstanding,
  });
  if (error) throw financeFailure('debts.update', error);
}

export async function setDebtArchived(debtId: string, archived: boolean, force = false): Promise<void> {
  const { error } = await supabase.rpc('archive_debt', { p_debt_id: debtId, p_archived: archived, p_force: force });
  if (error) throw financeFailure('debts.archive', error);
}

/** Solo deudas sin movimientos; con pagos, el servidor pide archivarla. */
export async function deleteDebt(debtId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_debt', { p_debt_id: debtId });
  if (error) throw financeFailure('debts.delete', error);
}

export type DebtPaymentInput = {
  debtId: string;
  kind: DebtPaymentKind;
  amount: Money;
  /** Cuenta de pago (cuota o abono). Si falta, se usa la de la deuda. */
  accountId?: string | null;
  /** Parte de la cuota que son intereses (solo cuotas). */
  interestPortion?: Money;
  date: string;
  notes?: string | null;
};

export async function registerDebtPayment(
  input: DebtPaymentInput,
  requestId: string,
  options: WriteOptions = {},
): Promise<{ transactionId: string; interestTransactionId: string | null }> {
  const { data, error } = await supabase.rpc('register_debt_payment', {
    p_debt_id: input.debtId,
    p_kind: input.kind,
    p_amount: input.amount,
    p_account_id: input.kind === 'interest' ? null : (input.accountId ?? null),
    p_interest_portion: input.kind === 'installment' ? (input.interestPortion ?? 0) : 0,
    p_payment_date: input.date,
    p_notes: input.notes?.trim() || null,
    p_request_id: requestId,
    p_allow_negative: options.allowNegative ?? false,
    p_allow_overpay: options.allowOverpay ?? false,
  });
  if (error) throw financeFailure('debts.payment', error);
  const result = (data ?? {}) as { transaction_id?: string; interest_transaction_id?: string | null };
  return { transactionId: result.transaction_id ?? '', interestTransactionId: result.interest_transaction_id ?? null };
}
