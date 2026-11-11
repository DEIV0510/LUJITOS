import { useLocalSearchParams } from 'expo-router';

import { TransactionForm } from '@/features/transactions/TransactionForm';
import type { TransactionType } from '@/types/finance';

const TYPES: TransactionType[] = ['income', 'expense', 'transfer'];

export default function NewTransactionScreen() {
  const params = useLocalSearchParams<{ type?: string; accountId?: string; toAccountId?: string }>();
  const type = TYPES.find((value) => value === params.type);
  return (
    <TransactionForm
      initialType={type}
      initialAccountId={params.accountId}
      initialToAccountId={params.toAccountId}
    />
  );
}
