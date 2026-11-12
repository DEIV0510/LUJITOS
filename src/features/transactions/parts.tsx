/** Piezas compartidas por los formularios de movimientos y de ajuste de saldo. */
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { cardDebt, cardMetrics, isCreditCard } from '@/features/accounts/display';
import { formatMoney } from '@/lib/money';
import { useAppTheme } from '@/theme';
import type { Account } from '@/types/finance';

/** Texto corto del saldo de una cuenta en los selectores. */
export function accountBalanceLabel(account: Account, hidden: boolean): string {
  if (isCreditCard(account)) {
    const metrics = cardMetrics(account);
    const debt = `Deuda ${formatMoney(cardDebt(account), { hidden })}`;
    return metrics ? `${debt} · disponible ${formatMoney(metrics.available, { hidden })}` : debt;
  }
  return formatMoney(account.balance, { hidden });
}

export function EmptyIcon({ icon }: { icon: 'creditcard' | 'arrow.left.arrow.right' | 'square.grid.2x2.fill' | 'calendar' }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
      <Icon name={icon} size={15} color={colors.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  emptyIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
