import { useLocalSearchParams } from 'expo-router';

import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/States';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { TransactionForm } from '@/features/transactions/TransactionForm';

/** Editar un movimiento (hoja modal): /transaction/edit?id=… */
export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getTransaction } = useFinanceData();
  const transaction = getTransaction(id);
  if (!transaction || transaction.voidedAt || transaction.type === 'adjustment') {
    return (
      <Screen header={<ScreenHeader modal leading="close" title="Editar movimiento" />}>
        <EmptyState
          icon="lock.fill"
          title="No se puede editar"
          message={transaction?.voidedAt ? 'Está anulado.' : transaction ? 'Los ajustes se anulan y se vuelven a registrar.' : 'No encontramos el movimiento.'}
        />
      </Screen>
    );
  }
  return <TransactionForm transaction={transaction} />;
}
