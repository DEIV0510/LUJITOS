import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { BarChart } from '@/components/charts/BarChart';
import { ChartCard } from '@/components/charts/ChartCard';
import { DonutChart } from '@/components/charts/DonutChart';
import { LineChart } from '@/components/charts/LineChart';
import { StackedBar } from '@/components/charts/StackedBar';
import { AmountText } from '@/components/finance/AmountText';
import { TabHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { SecondaryButton } from '@/components/ui/Buttons';
import { DemoNotice } from '@/components/ui/DemoNotice';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ACCOUNT_GROUP_LABEL } from '@/constants/institutions';
import { getDistribution, getStats, type StatsPeriod } from '@/features/demo/selectors';
import { formatPercent } from '@/lib/money';
import { resolveTone, useAppTheme, type Tone } from '@/theme';
import { LiveGate } from '@/features/data/ComingSoon';
import type { AccountGroup, IconName } from '@/types/finance';

const PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: 'year', label: 'Año' },
];

const PERIOD_TEXT: Record<StatsPeriod, string> = {
  week: 'Últimos 7 días',
  month: 'Últimas 4 semanas',
  '3m': 'Últimos 3 meses',
  '6m': 'Últimos 6 meses',
  year: 'Últimos 12 meses',
};

const GROUP_TONE: Record<AccountGroup, Tone> = {
  banks: 'forest',
  wallets: 'plum',
  cash: 'sage',
  other: 'olive',
  investments: 'gold',
  credit: 'clay',
};

function StatisticsScreen() {
  const { colors, spacing, scheme } = useAppTheme();
  const [period, setPeriod] = useState<StatsPeriod>('month');
  const stats = getStats(period);
  const labels = stats.points.map((p) => p.label);
  const details = stats.points.map((p) => p.detail);

  const top = stats.categories.slice(0, 5);
  const rest = stats.categories.slice(5).reduce((acc, item) => acc + item.amount, 0);
  const slices = [
    ...top.map(({ category, amount }) => ({
      key: category.id,
      label: category.name,
      value: amount,
      color: resolveTone(category.tone, scheme).base,
    })),
    ...(rest > 0 ? [{ key: 'rest', label: 'Otras categorías', value: rest, color: colors.textTertiary }] : []),
  ];

  const distribution = getDistribution().map((entry) => ({
    key: entry.group,
    label: ACCOUNT_GROUP_LABEL[entry.group],
    value: entry.total,
    color: resolveTone(GROUP_TONE[entry.group], scheme).base,
  }));

  return (
    <Screen inTabs withFab>
      <TabHeader title="Estadísticas" subtitle={PERIOD_TEXT[period]} />
      <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} accessibilityLabel="Periodo" />

      <View style={{ gap: spacing.md }}>
        <View style={[styles.row, { gap: spacing.md }]}>
          <Kpi icon="arrow.down.left" label="Ingresos" amount={stats.income} tone="positive" />
          <Kpi icon="arrow.up.right" label="Gastos" amount={stats.expense} tone="negative" />
        </View>
        <View style={[styles.row, { gap: spacing.md }]}>
          <Kpi icon="banknote.fill" label="Ahorro" amount={stats.savings} tone={stats.savings >= 0 ? 'positive' : 'negative'} />
          <FinancialCard style={styles.kpi} padding={spacing.lg}>
            <View style={styles.kpiHead}>
              <Icon name="percent" size={13} color={colors.textSecondary} />
              <AppText variant="subhead" color="textSecondary">
                Tasa de ahorro
              </AppText>
            </View>
            <AppText variant="amountM" style={{ marginTop: spacing.sm }}>
              {formatPercent(stats.savingsRate, { digits: 0 })}
            </AppText>
            <AppText variant="caption" color="textTertiary">
              de los ingresos
            </AppText>
          </FinancialCard>
        </View>
      </View>

      <ChartCard title="Ingresos frente a gastos" subtitle="Toca una columna para ver el detalle">
        <BarChart
          key={`bars-${period}`}
          labels={labels}
          details={details}
          totalsCaption={`Total · ${PERIOD_TEXT[period].toLowerCase()}`}
          series={[
            { key: 'income', label: 'Ingresos', color: colors.positiveGraphic, values: stats.points.map((p) => p.income) },
            { key: 'expense', label: 'Gastos', color: colors.negativeGraphic, values: stats.points.map((p) => p.expense) },
          ]}
        />
      </ChartCard>

      <ChartCard title="Gastos por categoría" subtitle="Toca una categoría para resaltarla">
        <DonutChart key={`donut-${period}`} data={slices} centerCaption="Total gastado" />
      </ChartCard>

      <ChartCard title="Evolución del patrimonio" subtitle="Desliza el dedo sobre la línea">
        <LineChart
          key={`worth-${period}`}
          labels={labels}
          details={details}
          currentCaption="Patrimonio actual"
          series={[
            { key: 'worth', label: 'Patrimonio', color: colors.primary, values: stats.points.map((p) => p.netWorth), area: true },
          ]}
        />
      </ChartCard>

      <ChartCard title="Distribución del dinero" subtitle="Hoy, por tipo de cuenta (sin deudas)">
        <StackedBar data={distribution} />
      </ChartCard>

      <ChartCard title="Evolución del ahorro" subtitle="Ingresos menos gastos en cada periodo">
        <LineChart
          key={`savings-${period}`}
          labels={labels}
          details={details}
          currentCaption="Último periodo"
          series={[
            { key: 'savings', label: 'Ahorro', color: colors.accent, values: stats.points.map((p) => p.savings), area: true },
          ]}
        />
      </ChartCard>

      <DemoNotice />
      <SecondaryButton
        label="Exportar informe"
        icon="square.and.arrow.up"
        onPress={() =>
          Alert.alert('Exportar informe', 'La exportación a PDF y Excel se construye en la Fase 8, con tus datos reales.')
        }
      />
    </Screen>
  );
}

type KpiProps = { icon: IconName; label: string; amount: number; tone: 'positive' | 'negative' };

function Kpi({ icon, label, amount, tone }: KpiProps) {
  const { colors, spacing } = useAppTheme();
  return (
    <FinancialCard style={styles.kpi} padding={spacing.lg}>
      <View style={styles.kpiHead}>
        <Icon name={icon} size={13} weight="bold" color={tone === 'positive' ? colors.positive : colors.negative} />
        <AppText variant="subhead" color="textSecondary">
          {label}
        </AppText>
      </View>
      <AmountText amount={amount} variant="amountM" fit style={{ marginTop: spacing.sm }} />
    </FinancialCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  kpi: { flex: 1, minWidth: 0 },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});

export default function StatisticsRoute() {
  return (
    <LiveGate
      title="Estadísticas"
      phase="Fase 8"
      description="Ingresos frente a gastos, gastos por categoría, evolución del patrimonio y del ahorro, calculados con tus movimientos reales."
      icon="chart.bar.fill"
      layout="tab"
      demo={<StatisticsScreen />}
    />
  );
}
