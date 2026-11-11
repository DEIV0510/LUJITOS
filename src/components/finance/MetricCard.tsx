import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { formatPercent, percentChange, type Money } from '@/lib/money';
import { useAppTheme } from '@/theme';

import { AmountText } from './AmountText';

type Props = {
  kind: 'income' | 'expense';
  amount: Money;
  previous: Money;
  comparisonLabel: string;
  onPress?: () => void;
};

/** Tarjeta de ingresos o gastos del mes con la comparación frente al mes anterior. */
export function MetricCard({ kind, amount, previous, comparisonLabel, onPress }: Props) {
  const { colors, spacing } = useAppTheme();
  const isIncome = kind === 'income';
  const change = percentChange(amount, previous);
  // Más ingresos es bueno; más gastos, no.
  const good = change === null ? null : isIncome ? change >= 0 : change <= 0;
  const changeColor = good === null ? 'textSecondary' : good ? 'positive' : 'negative';

  return (
    <FinancialCard onPress={onPress} style={styles.card} padding={spacing.lg}>
      <View style={styles.header}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: isIncome ? colors.positiveSoft : colors.negativeSoft },
          ]}
        >
          <Icon
            name={isIncome ? 'arrow.down.left' : 'arrow.up.right'}
            size={14}
            weight="bold"
            color={isIncome ? colors.positive : colors.negative}
          />
        </View>
        <AppText variant="subhead" color="textSecondary">
          {isIncome ? 'Ingresos' : 'Gastos'}
        </AppText>
      </View>
      <AmountText amount={amount} variant="amountM" fit style={{ marginTop: spacing.md }} />
      {change !== null ? (
        <AppText variant="footnote" color={changeColor} numberOfLines={2} style={{ marginTop: spacing.xs }}>
          {formatPercent(Math.abs(change))} {change >= 0 ? 'más' : 'menos'}
          <AppText variant="footnote" color="textSecondary">
            {' '}
            que {comparisonLabel}
          </AppText>
        </AppText>
      ) : null}
    </FinancialCard>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBox: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
