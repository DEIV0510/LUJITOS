import { useLocalSearchParams } from 'expo-router';

import { GoalDetailScreen } from '@/features/planning/screens/GoalScreens';

/** Detalle de una meta: /goal/… */
export default function GoalRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GoalDetailScreen id={id} />;
}
