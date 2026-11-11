import type { Category, StoredTransactionType } from '@/types/finance';

export const TRANSACTION_TYPE_LABEL: Record<StoredTransactionType, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  transfer: 'Transferencia',
  adjustment: 'Ajuste de saldo',
};

/** Pseudocategoría para mostrar ajustes de saldo. */
export const ADJUSTMENT_CATEGORY: Category = {
  id: 'adjustment',
  name: 'Ajuste de saldo',
  kind: 'expense',
  icon: 'slider.horizontal.3',
  tone: 'stone',
};
