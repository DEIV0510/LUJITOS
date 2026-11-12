import { useLocalSearchParams } from 'expo-router';

import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/States';
import { AccountForm } from '@/features/accounts/AccountForm';
import { useFinanceData } from '@/features/data/FinanceDataProvider';

/** Editar una cuenta (hoja modal): /account/edit?id=… */
export default function EditAccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getAccount } = useFinanceData();
  const account = getAccount(id);
  if (!account) {
    return (
      <Screen header={<ScreenHeader modal leading="close" title="Editar cuenta" />}>
        <EmptyState icon="magnifyingglass" title="Cuenta no encontrada" message="Puede que ya no exista." />
      </Screen>
    );
  }
  return <AccountForm account={account} />;
}
