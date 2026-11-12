import { useLocalSearchParams } from 'expo-router';

import { TransactionForm, type FormType } from '@/features/transactions/TransactionForm';

const TYPES: FormType[] = ['income', 'expense', 'transfer', 'adjustment'];

/** Nuevo movimiento: /transaction/new?type=expense&accountId=…&toAccountId=… */
export default function NewTransactionScreen() {
  const params = useLocalSearchParams<{ type?: string; accountId?: string; toAccountId?: string }>();
  const type = TYPES.find((value) => value === params.type);
  return <TransactionForm initialType={type} initialAccountId={params.accountId} initialToAccountId={params.toAccountId} />;
}
