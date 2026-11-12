import { useLocalSearchParams } from 'expo-router';

import { DebtDetailScreen } from '@/features/planning/screens/DebtScreens';

/** Detalle de una deuda: /debt/… */
export default function DebtRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DebtDetailScreen id={id} />;
}
