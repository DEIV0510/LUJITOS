/**
 * Cuentas, categorías y movimientos reales del usuario en Supabase.
 * El RLS garantiza que cada consulta solo devuelve filas del usuario con sesión;
 * aquí no se filtra por user_id a mano (sería una falsa sensación de seguridad).
 */
import { INSTITUTIONS } from '@/constants/institutions';
import { fromDb, type Money } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { tones, type Tone } from '@/theme';
import type { Account, Category, IconName, InstitutionId, RegistrationMethod, Transaction } from '@/types/finance';
import type { AccountRow, CategoryRow, ConnectionTypeDb, TransactionRow } from '@/types/database';

import { dbErrorMessage } from './errors';

const METHOD: Record<ConnectionTypeDb, RegistrationMethod> = {
  manual: 'manual',
  import: 'imported',
  open_finance: 'connected',
};

function toInstitutionId(value: string): InstitutionId {
  return value in INSTITUTIONS ? (value as InstitutionId) : 'custom';
}

function toTone(value: string): Tone {
  return value in tones ? (value as Tone) : 'stone';
}

export function mapAccount(row: AccountRow, balance: Money | undefined): Account {
  return {
    id: row.id,
    name: row.name,
    institutionId: toInstitutionId(row.institution),
    kind: row.account_type,
    balance: balance ?? fromDb(row.initial_balance),
    initialBalance: fromDb(row.initial_balance),
    currency: 'COP',
    createdAt: row.created_at.slice(0, 10),
    lastFour: row.last_four_digits ?? undefined,
    method: METHOD[row.connection_type],
    creditLimit: row.credit_limit === null ? undefined : fromDb(row.credit_limit),
    isActive: row.is_active,
    color: row.color,
  };
}

export function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    kind: row.type,
    icon: row.icon as IconName,
    tone: toTone(row.color),
    slug: row.slug,
    isDefault: row.is_default,
  };
}

export function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    amount: fromDb(row.amount),
    adjustmentSign: row.adjustment_sign === -1 ? -1 : row.adjustment_sign === 1 ? 1 : undefined,
    accountId: row.account_id ?? '',
    toAccountId: row.destination_account_id ?? undefined,
    categoryId: row.category_id ?? undefined,
    description: row.description,
    counterparty: row.merchant ?? undefined,
    date: row.transaction_date,
    notes: row.notes ?? undefined,
  };
}

// ---------- Lecturas ----------

export async function fetchAccounts(): Promise<Account[]> {
  const [accounts, balances] = await Promise.all([
    supabase.from('accounts').select('*').order('created_at', { ascending: true }),
    supabase.from('account_balances').select('account_id, balance'),
  ]);
  if (accounts.error) throw new Error(dbErrorMessage(accounts.error));
  if (balances.error) throw new Error(dbErrorMessage(balances.error));
  const byId = new Map(balances.data.map((row) => [row.account_id, fromDb(row.balance)]));
  return accounts.data.map((row) => mapAccount(row, byId.get(row.id)));
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw new Error(dbErrorMessage(error));
  return data.map(mapCategory);
}

/** Movimientos no borrados, del más reciente al más antiguo. */
export async function fetchTransactions(limit = 500): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .is('deleted_at', null)
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(dbErrorMessage(error));
  return data.map(mapTransaction);
}

// ---------- Escrituras ----------

export type NewAccountInput = {
  name: string;
  institution: InstitutionId;
  kind: Account['kind'];
  initialBalance: Money;
  lastFour?: string;
  creditLimit?: Money;
};

export async function createAccount(input: NewAccountInput): Promise<void> {
  const { error } = await supabase.from('accounts').insert({
    name: input.name.trim(),
    institution: input.institution,
    account_type: input.kind,
    initial_balance: input.initialBalance,
    last_four_digits: input.lastFour || null,
    credit_limit: input.kind === 'credit_card' ? (input.creditLimit ?? null) : null,
    connection_type: 'manual',
  });
  if (error) throw new Error(dbErrorMessage(error));
}

export async function archiveAccount(accountId: string): Promise<void> {
  const { error } = await supabase.from('accounts').update({ is_active: false }).eq('id', accountId);
  if (error) throw new Error(dbErrorMessage(error));
}

export type NewTransactionInput = {
  type: 'income' | 'expense' | 'transfer';
  amount: Money;
  accountId: string;
  toAccountId?: string | null;
  categoryId?: string | null;
  description: string;
  date: string;
  notes?: string;
};

export async function createTransaction(input: NewTransactionInput): Promise<void> {
  const isTransfer = input.type === 'transfer';
  const { error } = await supabase.from('transactions').insert({
    type: input.type,
    amount: input.amount,
    account_id: input.accountId,
    destination_account_id: isTransfer ? (input.toAccountId ?? null) : null,
    category_id: isTransfer ? null : (input.categoryId ?? null),
    description: input.description.trim(),
    notes: input.notes?.trim() || null,
    transaction_date: input.date,
    source: 'manual',
  });
  if (error) throw new Error(dbErrorMessage(error));
}

/** Borrado lógico: el movimiento deja de contar, pero queda el registro. */
export async function deleteTransaction(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', transactionId);
  if (error) throw new Error(dbErrorMessage(error));
}
