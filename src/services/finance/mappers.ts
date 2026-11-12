/** Filas de la base → modelo de la app. */
import { INSTITUTIONS } from '@/constants/institutions';
import { fromDb } from '@/lib/money';
import { tones, type Tone } from '@/theme/colors';
import type { Account, Category, IconName, InstitutionId, RegistrationMethod, Transaction, TransactionPurpose } from '@/types/finance';
import type { AccountBalanceRow, AccountRow, CategoryRow, ConnectionTypeDb, TransactionRow } from '@/types/database';

const METHOD: Record<ConnectionTypeDb, RegistrationMethod> = {
  manual: 'manual',
  import: 'imported',
  open_finance: 'connected',
};

export function toInstitutionId(value: string): InstitutionId {
  return value in INSTITUTIONS ? (value as InstitutionId) : 'custom';
}

export function isTone(value: string | null | undefined): value is Tone {
  return typeof value === 'string' && value in tones;
}

function toTone(value: string): Tone {
  return isTone(value) ? value : 'stone';
}

export function mapAccount(row: AccountRow, balance?: AccountBalanceRow): Account {
  return {
    id: row.id,
    name: row.name,
    institutionId: toInstitutionId(row.institution),
    institutionName: row.institution_name,
    kind: row.account_type,
    balance: balance ? fromDb(balance.balance) : fromDb(row.initial_balance),
    initialBalance: fromDb(row.initial_balance),
    currency: 'COP',
    createdAt: row.created_at.slice(0, 10),
    updatedAt: row.updated_at,
    lastFour: row.last_four_digits ?? undefined,
    method: METHOD[row.connection_type],
    creditLimit: row.credit_limit === null ? undefined : fromDb(row.credit_limit),
    isActive: row.is_active,
    color: row.color,
    icon: row.icon,
    description: row.description,
    statementDay: row.statement_day,
    paymentDueDay: row.payment_due_day,
    stats: balance
      ? {
          totalIncome: fromDb(balance.total_income),
          totalExpense: fromDb(balance.total_expense),
          transfersIn: fromDb(balance.transfers_in),
          transfersOut: fromDb(balance.transfers_out),
          adjustmentsNet: fromDb(balance.adjustments_net),
          transactionCount: Number(balance.transaction_count),
          lastTransactionDate: balance.last_transaction_date,
          lastActivityAt: balance.last_activity_at,
        }
      : undefined,
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
    archivedAt: row.archived_at,
    isFixed: row.is_fixed,
    isEssential: row.is_essential,
  };
}

const PURPOSES: TransactionPurpose[] = ['debt_installment', 'debt_extra', 'debt_interest', 'goal_contribution', 'goal_withdrawal'];

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
    voidedAt: row.deleted_at,
    voidReason: row.void_reason,
    createdAt: row.created_at,
    purpose: PURPOSES.includes(row.purpose as TransactionPurpose) ? (row.purpose as TransactionPurpose) : null,
  };
}
