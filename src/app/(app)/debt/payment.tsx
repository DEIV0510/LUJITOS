import { useLocalSearchParams } from 'expo-router';

import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/States';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { DebtPaymentForm } from '@/features/planning/DebtPaymentForm';
import type { DebtPaymentKind } from '@/types/planning';

const KINDS: DebtPaymentKind[] = ['installment', 'extra', 'interest'];

/** Pago de una deuda: /debt/payment?debt=…&kind=installment|extra|interest */
export default function DebtPaymentRoute() {
  const params = useLocalSearchParams<{ debt: string; kind?: string }>();
  const { getDebt } = useFinanceData();
  const debt = getDebt(params.debt);
  if (!debt) {
    return (
      <Screen header={<ScreenHeader modal leading="close" title="Pago" />}>
        <EmptyState icon="magnifyingglass" title="Deuda no encontrada" message="Puede que ya no exista." />
      </Screen>
    );
  }
  return <DebtPaymentForm debt={debt} initialKind={KINDS.find((kind) => kind === params.kind)} />;
}
