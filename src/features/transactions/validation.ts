/** Validación de un movimiento antes de enviarlo (el servidor valida otra vez). */
import type { ISODate } from '@/lib/dates';
import type { Money } from '@/lib/money';
import type { TransactionType } from '@/types/finance';

export type TransactionDraft = {
  type: TransactionType;
  amount: Money;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  description: string;
  counterparty: string;
  date: ISODate;
  notes: string;
};

export type TransactionErrors = Partial<Record<'amount' | 'accountId' | 'toAccountId' | 'categoryId' | 'date', string>>;

export function validateTransactionDraft(draft: TransactionDraft, today: ISODate): TransactionErrors {
  const errors: TransactionErrors = {};
  if (!Number.isSafeInteger(draft.amount) || draft.amount <= 0) errors.amount = 'Escribe un valor mayor que cero.';
  if (!draft.accountId) errors.accountId = draft.type === 'transfer' ? 'Elige la cuenta de origen.' : 'Elige la cuenta.';
  if (draft.type === 'transfer') {
    if (!draft.toAccountId) errors.toAccountId = 'Elige la cuenta de destino.';
    else if (draft.toAccountId === draft.accountId) errors.toAccountId = 'El origen y el destino deben ser cuentas distintas.';
  } else if (!draft.categoryId) {
    errors.categoryId = 'Elige una categoría.';
  }
  if (draft.date > today) errors.date = 'La fecha no puede ser futura.';
  return errors;
}

/** Diferencia entre el saldo real y el calculado (lo que registrará el ajuste). */
export function reconcileDifference(observedBalance: Money, calculatedBalance: Money): Money {
  return observedBalance - calculatedBalance;
}
