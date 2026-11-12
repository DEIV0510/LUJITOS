/**
 * Cuentas del usuario. Lecturas con RLS; escrituras SOLO por funciones RPC
 * (validan en el servidor, bloquean y evitan duplicados con la clave de solicitud).
 */
import { supabase } from '@/lib/supabase';
import { financeFailure } from '@/services/finance/errors';
import { mapAccount } from '@/services/finance/mappers';
import type { Money } from '@/lib/money';
import type { Account, AccountKind, InstitutionId } from '@/types/finance';

export async function fetchAccounts(): Promise<Account[]> {
  const [accounts, balances] = await Promise.all([
    supabase.from('accounts').select('*').order('created_at', { ascending: true }),
    supabase.from('account_balances').select('*'),
  ]);
  if (accounts.error) throw financeFailure('accounts.fetch', accounts.error);
  if (balances.error) throw financeFailure('accounts.fetchBalances', balances.error);
  const byId = new Map(balances.data.map((row) => [row.account_id, row]));
  return accounts.data.map((row) => mapAccount(row, byId.get(row.id)));
}

export type AccountInput = {
  name: string;
  kind: AccountKind;
  institution: InstitutionId;
  /** Obligatorio si institution = 'custom'. */
  institutionName?: string | null;
  /** Dinero inicial (≥ 0) o, en tarjetas, −deuda inicial (≤ 0). */
  initialBalance: Money;
  creditLimit?: Money | null;
  lastFour?: string | null;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
  statementDay?: number | null;
  paymentDueDay?: number | null;
};

function accountArgs(input: AccountInput) {
  const isCard = input.kind === 'credit_card';
  return {
    p_name: input.name.trim(),
    p_account_type: input.kind,
    p_institution: input.institution,
    p_institution_name: input.institution === 'custom' ? (input.institutionName?.trim() ?? null) : null,
    p_initial_balance: input.initialBalance,
    p_credit_limit: isCard ? (input.creditLimit ?? null) : null,
    p_last_four_digits: input.lastFour || null,
    p_color: input.color ?? null,
    p_icon: input.icon ?? null,
    p_description: input.description?.trim() || null,
    p_statement_day: isCard ? (input.statementDay ?? null) : null,
    p_payment_due_day: isCard ? (input.paymentDueDay ?? null) : null,
  };
}

export async function createAccount(input: AccountInput, requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_account', { ...accountArgs(input), p_request_id: requestId });
  if (error) throw financeFailure('accounts.create', error);
  return data;
}

export async function updateAccount(accountId: string, input: AccountInput): Promise<void> {
  const { error } = await supabase.rpc('update_account', { p_account_id: accountId, ...accountArgs(input) });
  if (error) throw financeFailure('accounts.update', error);
}

/** Archivar conserva la cuenta y su historial. Con saldo, el servidor pide confirmar (force). */
export async function archiveAccount(accountId: string, force = false): Promise<void> {
  const { error } = await supabase.rpc('archive_account', { p_account_id: accountId, p_force: force });
  if (error) throw financeFailure('accounts.archive', error);
}

export async function restoreAccount(accountId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_account', { p_account_id: accountId });
  if (error) throw financeFailure('accounts.restore', error);
}
