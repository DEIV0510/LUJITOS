import { useLocalSearchParams } from 'expo-router';

import { BudgetDetailScreen } from '@/features/planning/screens/BudgetScreens';

/** Detalle de un presupuesto: /budget/… */
export default function BudgetRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BudgetDetailScreen id={id} />;
}
