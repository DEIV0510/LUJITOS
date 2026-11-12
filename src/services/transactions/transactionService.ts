/**
 * Movimientos. Lecturas con RLS; crear, editar, anular y ajustar saldo SOLO
 * por funciones RPC transaccionales (los saldos se recalculan en PostgreSQL).
 */
import { fromDb, type Money } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { financeFailure } from '@/services/finance/errors';
import { mapTransaction } from '@/services/finance/mappers';
import type { Transaction, TransactionType } from '@/types/finance';

/** Todos los movimientos (incluye anulados, marcados con voidedAt), del más reciente al más antiguo. */
export async function fetchTransactions(limit = 3000): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw financeFailure('transactions.fetch', error);
  return data.map(mapTransaction);
}

export type TransactionInput = {
  type: TransactionType;
  amount: Money;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  /** AAAA-MM-DD (día de Bogotá). */
  date: string;
  description: string;
  /** Comercio (gasto) o persona/empresa de origen (ingreso). */
  counterparty?: string | null;
  notes?: string | null;
};

/** Confirmaciones del usuario ante las advertencias del servidor. */
export type WriteOptions = { allowNegative?: boolean; allowDuplicate?: boolean };

function movementArgs(input: TransactionInput) {
  const isTransfer = input.type === 'transfer';
  return {
    p_amount: input.amount,
    p_account_id: input.accountId,
    p_destination_account_id: isTransfer ? (input.toAccountId ?? null) : null,
    p_category_id: isTransfer ? null : (input.categoryId ?? null),
    p_transaction_date: input.date,
    p_description: input.description.trim(),
    p_merchant: isTransfer ? null : input.counterparty?.trim() || null,
    p_notes: input.notes?.trim() || null,
  };
}

export async function createTransaction(input: TransactionInput, requestId: string, options: WriteOptions = {}): Promise<string> {
  const { data, error } = await supabase.rpc('create_transaction', {
    p_type: input.type,
    ...movementArgs(input),
    p_request_id: requestId,
    p_allow_negative: options.allowNegative ?? false,
    p_allow_duplicate: options.allowDuplicate ?? false,
  });
  if (error) throw financeFailure('transactions.create', error);
  return data;
}

/** Editar: el tipo no cambia; el servidor valida y los saldos se recalculan solos. */
export async function updateTransaction(transactionId: string, input: TransactionInput, options: WriteOptions = {}): Promise<void> {
  const { error } = await supabase.rpc('update_transaction', {
    p_transaction_id: transactionId,
    ...movementArgs(input),
    p_allow_negative: options.allowNegative ?? false,
    p_allow_duplicate: options.allowDuplicate ?? false,
  });
  if (error) throw financeFailure('transactions.update', error);
}

/** Anular: revierte el efecto en los saldos y conserva el registro con su motivo. */
export async function voidTransaction(transactionId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('void_transaction', { p_transaction_id: transactionId, p_reason: reason?.trim() || null });
  if (error) throw financeFailure('transactions.void', error);
}

export type ReconcileInput = {
  accountId: string;
  /** Saldo real que ve el usuario (en tarjetas: −deuda real). */
  observedBalance: Money;
  /** Saldo calculado que el usuario vio al confirmar la diferencia. */
  expectedBalance: Money;
  reason: string;
};

export async function reconcileAccount(
  input: ReconcileInput,
  requestId: string,
): Promise<{ transactionId: string | null; difference: Money }> {
  const { data, error } = await supabase.rpc('reconcile_account', {
    p_account_id: input.accountId,
    p_observed_balance: input.observedBalance,
    p_expected_balance: input.expectedBalance,
    p_reason: input.reason.trim(),
    p_request_id: requestId,
  });
  if (error) throw financeFailure('transactions.reconcile', error);
  const result = (data ?? {}) as { transaction_id?: string | null; difference?: number | string };
  return { transactionId: result.transaction_id ?? null, difference: fromDb(result.difference ?? 0) };
}
