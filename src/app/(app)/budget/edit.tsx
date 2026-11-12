import { useLocalSearchParams } from 'expo-router';

import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/States';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { BudgetForm } from '@/features/planning/BudgetForm';

/** Crear (sin id) o editar un presupuesto (hoja modal). ?category=… preselecciona la categoría. */
export default function BudgetEditRoute() {
  const { id, category } = useLocalSearchParams<{ id?: string; category?: string }>();
  const { getBudget } = useFinanceData();
  if (!id) return <BudgetForm initialCategoryId={category} />;
  const budget = getBudget(id);
  if (!budget) {
    return (
      <Screen header={<ScreenHeader modal leading="close" title="Editar presupuesto" />}>
        <EmptyState icon="magnifyingglass" title="Presupuesto no encontrado" message="Puede que ya no exista." />
      </Screen>
    );
  }
  return <BudgetForm budget={budget} />;
}
