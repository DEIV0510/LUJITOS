import { Alert, StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/finance/AmountText';
import { BudgetProgress, ProgressBar, budgetColor } from '@/components/finance/Progress';
import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { SecondaryButton } from '@/components/ui/Buttons';
import { DemoNotice } from '@/components/ui/DemoNotice';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { BUDGET_ALERTS, DEMO_MONTHLY } from '@/features/demo/data';
import { getBudgetOverview } from '@/features/demo/selectors';
import { MONTHS, capitalize, parseISO } from '@/lib/dates';
import { formatPercent } from '@/lib/money';
import { useAppTheme } from '@/theme';

export default function BudgetsScreen() {
  const { colors, spacing } = useAppTheme();
  const budget = getBudgetOverview();
  const history = DEMO_MONTHLY.slice(-4, -1).reverse();

  return (
    <Screen header={<ScreenHeader title="Presupuestos" />}>
      <FinancialCard padding={spacing.xl}>
        <AppText variant="overline" color="textSecondary">
          Noviembre · quedan {budget.daysLeft} días
        </AppText>
        <View style={[styles.top, { marginTop: spacing.sm }]}>
          <AmountText amount={budget.remaining} variant="amountXL" fit style={styles.flex} />
        </View>
        <AppText variant="callout" color="textSecondary">
          disponibles de <AmountText amount={budget.limit} variant="callout" color="textSecondary" />
        </AppText>
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <ProgressBar ratio={budget.ratio} color={budgetColor(budget.ratio, colors)} height={10} />
          <View style={styles.top}>
            <AppText variant="footnote" color="textSecondary">
              Gastado: <AmountText amount={budget.spent} variant="footnote" color="text" />
            </AppText>
            <AppText variant="footnote" color="textSecondary">
              {formatPercent(budget.ratio * 100, { digits: 0 })} usado
            </AppText>
          </View>
        </View>
      </FinancialCard>

      <View>
        <SectionHeader title="Por categoría" subtitle={`Alertas al ${BUDGET_ALERTS.join(' %, ')} %`} />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          {budget.lines.map((line, index) => (
            <BudgetProgress key={line.categoryId} category={line.category} spent={line.spent} limit={line.limit} showDivider={index > 0} />
          ))}
        </FinancialCard>
      </View>

      <View>
        <SectionHeader title="Meses anteriores" />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          {history.map((month, index) => {
            const { month: number } = parseISO(`${month.month}-01`);
            const ratio = month.expense / budget.limit;
            return (
              <View
                key={month.month}
                style={[
                  styles.historyRow,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ]}
              >
                <AppText variant="bodyStrong" style={styles.historyMonth}>
                  {capitalize(MONTHS[number - 1] ?? '')}
                </AppText>
                <View style={styles.flex}>
                  <ProgressBar ratio={ratio} color={budgetColor(ratio, colors)} height={6} />
                </View>
                <AppText variant="subhead" color="textSecondary" style={styles.historyValue}>
                  {formatPercent(ratio * 100, { digits: 0 })}
                </AppText>
              </View>
            );
          })}
        </FinancialCard>
      </View>

      <DemoNotice />
      <SecondaryButton
        label="Nuevo presupuesto"
        icon="plus"
        onPress={() => Alert.alert('Nuevo presupuesto', 'Crear y editar presupuestos se activa en la Fase 6.')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  list: { paddingVertical: 4 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  historyMonth: { width: 96 },
  historyValue: { width: 48, textAlign: 'right' },
});
