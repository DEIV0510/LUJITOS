import { Alert, StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/finance/AmountText';
import { ProgressBar, SavingsProgress } from '@/components/finance/Progress';
import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { SecondaryButton } from '@/components/ui/Buttons';
import { DemoNotice } from '@/components/ui/DemoNotice';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { DEMO_GOALS } from '@/features/demo/data';
import { getGoalPlan } from '@/features/demo/selectors';
import { formatPercent } from '@/lib/money';
import { useAppTheme } from '@/theme';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { LiveSavingsScreen } from '@/features/planning/screens/GoalScreens';

const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 } as const;

function SavingsScreen() {
  const { colors, spacing } = useAppTheme();
  const goals = [...DEMO_GOALS].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const saved = goals.reduce((acc, goal) => acc + goal.saved, 0);
  const target = goals.reduce((acc, goal) => acc + goal.target, 0);
  const monthly = goals.reduce((acc, goal) => acc + getGoalPlan(goal).perMonth, 0);

  return (
    <Screen header={<ScreenHeader title="Metas de ahorro" />}>
      <FinancialCard tone="brand" padding={spacing.xl}>
        <AppText variant="overline" color="onBrandSecondary">
          Ahorrado en metas
        </AppText>
        <AmountText amount={saved} variant="amountXL" color="onBrand" fit style={{ marginTop: spacing.xs }} />
        <AppText variant="callout" color="onBrandSecondary">
          de <AmountText amount={target} variant="callout" color="onBrandSecondary" /> · {formatPercent((saved / target) * 100, { digits: 0 })}
        </AppText>
        <View style={{ marginTop: spacing.lg }}>
          <ProgressBar ratio={saved / target} color={colors.accent} />
        </View>
        <View style={[styles.row, { marginTop: spacing.lg }]}>
          <AppText variant="footnote" color="onBrandSecondary" style={styles.flex}>
            Para cumplir todas a tiempo, separa cada mes
          </AppText>
          <AmountText amount={monthly} variant="amount" color="onBrand" />
        </View>
      </FinancialCard>

      <View>
        <SectionHeader title="Tus metas" subtitle="Ordenadas por prioridad" />
        <View style={{ gap: spacing.md }}>
          {goals.map((goal) => (
            <SavingsProgress key={goal.id} goal={goal} />
          ))}
        </View>
      </View>

      <DemoNotice />
      <SecondaryButton
        label="Nueva meta"
        icon="plus"
        onPress={() => Alert.alert('Nueva meta', 'Estás en modo demostración: nada se guarda. Desactívalo en Configuración para crear tus metas.')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
});

/** Datos reales por defecto; la versión de ejemplo solo en modo demostración. */
export default function SavingsRoute() {
  const { mode } = useFinanceData();
  return mode === 'demo' ? <SavingsScreen /> : <LiveSavingsScreen />;
}
