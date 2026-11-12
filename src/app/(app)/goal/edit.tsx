import { useLocalSearchParams } from 'expo-router';

import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/States';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { GoalForm } from '@/features/planning/GoalForm';

/** Crear (sin id) o editar una meta (hoja modal). */
export default function GoalEditRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { getGoal } = useFinanceData();
  if (!id) return <GoalForm />;
  const goal = getGoal(id);
  if (!goal) {
    return (
      <Screen header={<ScreenHeader modal leading="close" title="Editar meta" />}>
        <EmptyState icon="magnifyingglass" title="Meta no encontrada" message="Puede que ya no exista." />
      </Screen>
    );
  }
  return <GoalForm goal={goal} />;
}
