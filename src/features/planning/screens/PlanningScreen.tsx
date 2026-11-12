/**
 * Planificación con datos reales: el mes, patrimonio, capacidad de ahorro,
 * gastos fijos y variables, proyección a 3/6/12 meses (con sus supuestos) y
 * los últimos meses. Con poco historial todo se marca como preliminar.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/finance/AmountText';
import { ProgressBar } from '@/components/finance/Progress';
import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { InfoRow } from '@/components/ui/Rows';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { MONTHS_SHORT, capitalize, parseISO } from '@/lib/dates';
import { formatMoney, formatPercent } from '@/lib/money';
import { fetchMonthlyFlows } from '@/services/planning/planningService';
import { useAppTheme } from '@/theme';
import type { MonthlyFlow } from '@/types/planning';

import { PROJECTION_ASSUMPTIONS, buildProjections } from '../projections';
import { Note } from '../ui';

function basisText(basis: string, months: number): string {
  if (basis === 'complete_months') return `Promedio de ${months === 1 ? 'tu último mes completo' : `tus últimos ${months} meses completos`}.`;
  if (basis === 'current_month') return 'Con lo que va de este mes: aún no hay un mes completo registrado.';
  return 'Sin movimientos todavía.';
}

function useMonthlyFlows(refreshKey: string) {
  const [flows, setFlows] = useState<MonthlyFlow[] | null>(null);
  useEffect(() => {
    let active = true;
    fetchMonthlyFlows(6)
      .then((data) => {
        if (active) setFlows(data);
      })
      .catch(() => {
        if (active) setFlows([]);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);
  return flows;
}

export function PlanningScreen() {
  const { colors, spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const { mode, status, error, reload, summary, planning } = useFinanceData();
  const flows = useMonthlyFlows(`${summary?.monthIncome}-${summary?.monthExpense}`);
  const money = (value: number | null | undefined) => (value === null || value === undefined ? '—' : formatMoney(value, { hidden }));

  if (mode === 'demo') {
    return (
      <Screen header={<ScreenHeader title="Planificación" />}>
        <FinancialCard>
          <EmptyState icon="chart.bar.fill" title="Solo con tus datos" message="La planificación usa tus movimientos reales. Sal del modo demostración en Configuración." />
        </FinancialCard>
      </Screen>
    );
  }
  if (status !== 'ready' || !summary || !planning) {
    return (
      <Screen header={<ScreenHeader title="Planificación" />}>
        {status === 'error' ? (
          <FinancialCard>
            <EmptyState icon="wifi" title="No pudimos cargar tus datos" message={error ?? 'Revisa tu conexión.'} actionLabel="Reintentar" onAction={() => void reload()} />
          </FinancialCard>
        ) : (
          <FinancialCard padding={spacing.xl}>
            <LoadingState rows={4} label="Calculando" />
          </FinancialCard>
        )}
      </Screen>
    );
  }

  const projections = buildProjections(planning, { netWorth: summary.netWorth, loanDebt: summary.loanDebt });
  const expense = planning.expenseAvg ?? 0;
  const fixedShare = expense > 0 ? (planning.fixedAvg ?? 0) / expense : 0;
  const goalsGap = planning.savingsCapacity !== null && planning.goalsMonthlyNeeded > planning.savingsCapacity;

  return (
    <Screen header={<ScreenHeader title="Planificación" />}>
      {planning.preliminary ? (
        <Note icon="exclamationmark.triangle">
          Preliminar: {basisText(planning.basis, planning.monthsUsed)} Con 3 meses completos de movimientos las cifras serán más
          confiables.
        </Note>
      ) : null}

      <View>
        <SectionHeader title="Este mes" />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          <InfoRow label="Ingresos" value={money(summary.monthIncome)} valueColor="positive" showDivider={false} />
          <InfoRow label="Gastos" value={money(summary.monthExpense)} />
          <InfoRow label="Ahorro" value={money(summary.monthSavings)} valueColor={summary.monthSavings < 0 ? 'negative' : 'text'} />
          <InfoRow
            label="% de ahorro"
            value={summary.savingsRate === null ? 'Sin ingresos este mes' : formatPercent(summary.savingsRate, { digits: 1 })}
          />
        </FinancialCard>
      </View>

      <View>
        <SectionHeader title="Patrimonio" />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          <InfoRow label="Activos" value={money(summary.assets)} showDivider={false} />
          <InfoRow label="Pasivos" value={money(summary.liabilities)} />
          <InfoRow label="Patrimonio neto" value={money(summary.netWorth)} valueColor={summary.netWorth < 0 ? 'negative' : 'text'} />
          <InfoRow label="Deudas (tarjetas y préstamos)" value={money(summary.totalDebt)} />
        </FinancialCard>
        <AppText variant="caption" color="textTertiary" style={{ marginTop: spacing.sm }}>
          Activos: saldos positivos de tus cuentas. Pasivos: deudas de tarjetas, préstamos y sobregiros. El cupo disponible y las metas no
          suman.
        </AppText>
      </View>

      <View>
        <SectionHeader title="Capacidad de ahorro" />
        <FinancialCard padding={spacing.xl}>
          {planning.savingsCapacity === null ? (
            <AppText variant="callout" color="textSecondary">
              Registra tus ingresos y gastos para calcularla.
            </AppText>
          ) : (
            <>
              <AmountText amount={planning.savingsCapacity} variant="amountXL" fit color={planning.savingsCapacity < 0 ? 'negative' : 'text'} />
              <AppText variant="footnote" color="textSecondary">
                al mes, si cubres solo lo esencial y tus cuotas
              </AppText>
              <View style={[styles.list, { marginTop: spacing.md }]}>
                <InfoRow label="Ingreso promedio" value={money(planning.incomeAvg)} showDivider={false} />
                <InfoRow label="− Gastos esenciales" value={money(planning.essentialAvg)} />
                <InfoRow label="− Cuotas de deudas" value={money(planning.obligationsMonthly)} />
              </View>
              <AppText variant="caption" color="textTertiary" style={{ marginTop: spacing.sm }}>
                {basisText(planning.basis, planning.monthsUsed)} Esenciales: comida, transporte, vivienda, servicios, salud, educación e
                impuestos.
              </AppText>
            </>
          )}
        </FinancialCard>
        {planning.activeGoals > 0 ? (
          <AppText variant="footnote" color={goalsGap ? 'warning' : 'textSecondary'} style={{ marginTop: spacing.sm }}>
            Tus metas piden {money(planning.goalsMonthlyNeeded)} al mes
            {goalsGap ? ': más que tu capacidad de ahorro.' : '.'}
          </AppText>
        ) : null}
      </View>

      {planning.basis !== 'none' ? (
        <View>
          <SectionHeader title="Gastos fijos y variables" subtitle="Promedio mensual" />
          <FinancialCard padding={spacing.lg}>
            <ProgressBar ratio={fixedShare} color={colors.primary} height={10} />
            <View style={[styles.row, { marginTop: spacing.md }]}>
              <View style={styles.flex}>
                <AppText variant="caption" color="textSecondary">
                  Fijos
                </AppText>
                <AppText variant="bodyStrong">{money(planning.fixedAvg)}</AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="caption" color="textSecondary">
                  Variables
                </AppText>
                <AppText variant="bodyStrong">{money(planning.variableAvg)}</AppText>
              </View>
            </View>
          </FinancialCard>
        </View>
      ) : null}

      <View>
        <SectionHeader title="Proyección" subtitle="Si todo sigue igual" />
        {projections === null ? (
          <FinancialCard>
            <EmptyState icon="chart.line.uptrend.xyaxis" title="Sin datos para proyectar" message="Registra ingresos y gastos: no inventamos cifras." />
          </FinancialCard>
        ) : (
          <FinancialCard padding={spacing.lg} style={styles.list}>
            <View style={[styles.tableRow, { borderBottomColor: colors.border }]}>
              <AppText variant="caption" color="textSecondary" style={styles.tableFirst}>
                Plazo
              </AppText>
              <AppText variant="caption" color="textSecondary" style={styles.tableCell}>
                Patrimonio
              </AppText>
              <AppText variant="caption" color="textSecondary" style={styles.tableCell}>
                Ahorro
              </AppText>
              <AppText variant="caption" color="textSecondary" style={styles.tableCell}>
                Préstamos
              </AppText>
            </View>
            {projections.map((row) => (
              <View key={row.months} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                <AppText variant="subhead" style={styles.tableFirst}>
                  {row.months} m
                </AppText>
                <AppText variant="footnote" style={styles.tableCell} numberOfLines={1} adjustsFontSizeToFit>
                  {formatMoney(row.netWorth, { hidden })}
                </AppText>
                <AppText variant="footnote" color={row.saved < 0 ? 'negative' : 'text'} style={styles.tableCell} numberOfLines={1} adjustsFontSizeToFit>
                  {formatMoney(row.saved, { hidden })}
                </AppText>
                <AppText variant="footnote" style={styles.tableCell} numberOfLines={1} adjustsFontSizeToFit>
                  {formatMoney(row.loanDebt, { hidden })}
                </AppText>
              </View>
            ))}
          </FinancialCard>
        )}
        <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
          {PROJECTION_ASSUMPTIONS.map((text) => (
            <AppText key={text} variant="caption" color="textTertiary">
              · {text}
            </AppText>
          ))}
          {planning.preliminary && projections ? (
            <AppText variant="caption" color="warning">
              · Preliminar: basada en poco historial.
            </AppText>
          ) : null}
        </View>
      </View>

      <View>
        <SectionHeader title="Últimos meses" />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          {flows === null ? (
            <LoadingState rows={3} label="Cargando meses" />
          ) : (
            [...flows].reverse().map((flow, index) => {
              const { month, year } = parseISO(flow.monthStart);
              const saving = flow.income - flow.expense;
              return (
                <View key={flow.monthStart} style={[styles.monthRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                  <AppText variant="subhead" style={styles.monthLabel}>
                    {capitalize(MONTHS_SHORT[month - 1] ?? '')} {String(year).slice(2)}
                  </AppText>
                  <View style={styles.flex}>
                    <AppText variant="footnote" color="textSecondary" numberOfLines={1}>
                      +{formatMoney(flow.income, { hidden })} · −{formatMoney(flow.expense, { hidden })}
                    </AppText>
                  </View>
                  <AppText variant="subhead" color={saving < 0 ? 'negative' : 'text'}>
                    {flow.movements === 0 ? '—' : formatMoney(saving, { hidden })}
                  </AppText>
                </View>
              );
            })
          )}
        </FinancialCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 4 },
  row: { flexDirection: 'row', gap: 16 },
  flex: { flex: 1, minWidth: 0 },
  tableRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  tableFirst: { width: 40 },
  tableCell: { flex: 1, textAlign: 'right' },
  monthRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 12 },
  monthLabel: { width: 56 },
});
