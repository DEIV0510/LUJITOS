import { useLocalSearchParams } from 'expo-router';

import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/States';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { GoalMovementForm } from '@/features/planning/GoalMovementForm';

/** Aporte o retiro: /goal/movement?goal=…&kind=contribution|withdrawal · editar: ?goal=…&id=… */
export default function GoalMovementRoute() {
  const { goal: goalId, kind, id } = useLocalSearchParams<{ goal: string; kind?: string; id?: string }>();
  const { getGoal, goalMovements } = useFinanceData();
  const goal = getGoal(goalId);
  const movement = id ? goalMovements.find((m) => m.id === id && !m.voidedAt) : undefined;
  if (!goal || (id && !movement)) {
    return (
      <Screen header={<ScreenHeader modal leading="close" title="Meta" />}>
        <EmptyState icon="magnifyingglass" title="No encontrado" message="La meta o el movimiento ya no existen." />
      </Screen>
    );
  }
  return <GoalMovementForm goal={goal} movement={movement} initialKind={kind === 'withdrawal' ? 'withdrawal' : 'contribution'} />;
}
