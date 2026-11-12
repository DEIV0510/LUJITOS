import { useLocalSearchParams } from 'expo-router';

import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/States';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { DebtForm } from '@/features/planning/DebtForm';

/** Registrar (sin id) o editar una deuda (hoja modal). */
export default function DebtEditRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getDebt } = useFinanceData();
  if (!id) return <DebtForm />;
  const debt = getDebt(id);
  if (!debt) {
    return (
      <Screen header={<ScreenHeader modal leading="close" title="Editar deuda" />}>
        <EmptyState icon="magnifyingglass" title="Deuda no encontrada" message="Puede que ya no exista." />
      </Screen>
    );
  }
  return <DebtForm debt={debt} />;
}
