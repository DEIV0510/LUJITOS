/** Presupuestos con datos reales: lista y detalle. */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/finance/AmountText';
import { ProgressBar } from '@/components/finance/Progress';
import { TransactionItem } from '@/components/finance/TransactionItem';
import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { IconButton, PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { InfoRow, ListRow } from '@/components/ui/Rows';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { formatShortDate } from '@/lib/dates';
import { formatMoney, formatPercent, percentChange } from '@/lib/money';
import { errorMessage } from '@/services/finance/errors';
import { fetchBudgetHistory } from '@/services/planning/budgetService';
import { useAppTheme } from '@/theme';
import type { Budget, BudgetPeriodTotal } from '@/types/planning';

import { BudgetRow, budgetBarColor, budgetStateColor } from '../cards';
import { BUDGET_PERIOD_LABEL, BUDGET_STATE_LABEL, budgetName, periodLabel } from '../labels';
import { Note, StateText } from '../ui';

function openForm(params?: Record<string, string>) {
  router.push({ pathname: '/budget/edit', params });
}

/** El presupuesto general mensual activo (si existe) va arriba, destacado. */
function pickGeneral(budgets: Budget[]): Budget | undefined {
  return budgets.find((b) => !b.archivedAt && b.categoryId === null && b.period === 'monthly');
}

export function LiveBudgetsScreen() {
  const { colors, spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const { status, error, reload, budgets, getCategory } = useFinanceData();
  const general = pickGeneral(budgets);
  const active = budgets.filter((b) => !b.archivedAt && b.id !== general?.id);
  const archived = budgets.filter((b) => b.archivedAt);
  const nameOf = (b: Budget) => budgetName(b, b.categoryId ? getCategory(b.categoryId) : undefined);
  const change = general && general.previousSpent ? percentChange(general.spent, general.previousSpent) : null;

  return (
    <Screen
      header={<ScreenHeader title="Presupuestos" right={<IconButton icon="plus" accessibilityLabel="Nuevo presupuesto" onPress={() => openForm()} />} />}
    >
      {status === 'loading' || status === 'idle' ? (
        <FinancialCard padding={spacing.xl}>
          <LoadingState rows={3} label="Cargando presupuestos" />
        </FinancialCard>
      ) : status === 'error' ? (
        <FinancialCard>
          <EmptyState icon="wifi" title="No pudimos cargar tus datos" message={error ?? 'Revisa tu conexión.'} actionLabel="Reintentar" onAction={() => void reload()} />
        </FinancialCard>
      ) : budgets.length === 0 ? (
        <FinancialCard>
          <EmptyState
            icon="chart.pie.fill"
            title="Aún no tienes presupuestos"
            message="Pon un límite al mes (general) o a una categoría, como comida o transporte. Te avisamos al 50, 75, 90 y 100 %."
            actionLabel="Crear presupuesto"
            onAction={() => openForm()}
          />
        </FinancialCard>
      ) : (
        <>
          {general ? (
            <FinancialCard padding={spacing.xl} onPress={() => router.push({ pathname: '/budget/[id]', params: { id: general.id } })}>
              <AppText variant="overline" color="textSecondary">
                {periodLabel(general.period, general.periodStart, general.periodEnd)} · quedan {general.daysLeft} días
              </AppText>
              <AmountText
                amount={general.available}
                variant="amountXL"
                fit
                color={general.available < 0 ? 'negative' : 'text'}
                style={{ marginTop: spacing.sm }}
              />
              <AppText variant="callout" color="textSecondary">
                {general.available < 0 ? 'por encima de ' : 'disponibles de '}
                {formatMoney(general.limit, { hidden })}
              </AppText>
              <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                <ProgressBar ratio={general.percentUsed / 100} color={budgetBarColor(general, colors)} height={10} />
                <View style={styles.row}>
                  <AppText variant="footnote" color="textSecondary">
                    Gastado: {formatMoney(general.spent, { hidden })}
                  </AppText>
                  <AppText variant="footnote" color="textSecondary">
                    {formatPercent(general.percentUsed, { digits: 0 })} usado
                  </AppText>
                </View>
                {general.previousSpent !== null ? (
                  <AppText variant="footnote" color="textSecondary">
                    Mes anterior completo: {formatMoney(general.previousSpent, { hidden })}
                    {change !== null ? ` · este mes vas en ${formatPercent(change, { digits: 0, sign: true })}` : ''}
                  </AppText>
                ) : null}
              </View>
            </FinancialCard>
          ) : (
            <FinancialCard tone="muted" padding={spacing.lg}>
              <AppText variant="subhead">Sin presupuesto general</AppText>
              <AppText variant="footnote" color="textSecondary" style={{ marginTop: spacing.xs }}>
                Un límite para todos tus gastos del mes te muestra cuánto te queda y lo compara con el mes anterior.
              </AppText>
              <AppText variant="subhead" color="primary" style={{ marginTop: spacing.md }} onPress={() => openForm({ general: '1' })}>
                Crear presupuesto general
              </AppText>
            </FinancialCard>
          )}

          {active.length > 0 ? (
            <View>
              <SectionHeader title="Por categoría y período" />
              <FinancialCard padding={spacing.lg} style={styles.list}>
                {active.map((budget, index) => (
                  <BudgetRow
                    key={budget.id}
                    budget={budget}
                    name={nameOf(budget)}
                    category={budget.categoryId ? getCategory(budget.categoryId) : undefined}
                    showDivider={index > 0}
                  />
                ))}
              </FinancialCard>
            </View>
          ) : null}

          <Note>Solo cuentan los gastos reales: no las transferencias, los ingresos, los pagos de tarjeta ni los movimientos anulados.</Note>
          <SecondaryButton label="Nuevo presupuesto" icon="plus" onPress={() => openForm()} />

          {archived.length > 0 ? (
            <View>
              <SectionHeader title="Archivados" />
              <FinancialCard padding={spacing.lg} style={styles.list}>
                {archived.map((budget, index) => (
                  <ListRow
                    key={budget.id}
                    title={nameOf(budget)}
                    subtitle={`${BUDGET_PERIOD_LABEL[budget.period]} · ${formatMoney(budget.limit, { hidden })}`}
                    icon="archivebox"
                    showDivider={index > 0}
                    onPress={() => router.push({ pathname: '/budget/[id]', params: { id: budget.id } })}
                  />
                ))}
              </FinancialCard>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function useBudgetHistory(budget: Budget | undefined) {
  const [rows, setRows] = useState<BudgetPeriodTotal[] | null>(null);
  const [failed, setFailed] = useState(false);
  const id = budget?.id;
  const spent = budget?.spent;
  const limit = budget?.limit;
  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchBudgetHistory(id, 6)
      .then((data) => {
        if (active) {
          setRows(data);
          setFailed(false);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
    // Se vuelve a pedir cuando cambia lo gastado o el límite (después de guardar).
  }, [id, spent, limit]);
  return { rows, failed };
}

export function BudgetDetailScreen({ id }: { id: string | undefined }) {
  const { colors, spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const { getBudget, getCategory, budgetAlerts, transactions, setBudgetArchived, deleteBudget } = useFinanceData();
  const budget = getBudget(id);
  const history = useBudgetHistory(budget);
  const [busy, setBusy] = useState(false);

  if (!budget) {
    return (
      <Screen header={<ScreenHeader title="Presupuesto" />}>
        <EmptyState icon="magnifyingglass" title="Presupuesto no encontrado" message="Puede que lo hayas eliminado." />
      </Screen>
    );
  }
  const category = budget.categoryId ? getCategory(budget.categoryId) : undefined;
  const name = budgetName(budget, category);
  const alerts = budgetAlerts.filter((a) => a.budgetId === budget.id && a.periodStart === budget.periodStart);
  const movements = transactions.filter(
    (t) =>
      t.type === 'expense' &&
      t.date >= budget.periodStart &&
      t.date <= budget.periodEnd &&
      (budget.categoryId === null || t.categoryId === budget.categoryId),
  );
  const over = budget.available < 0;

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert('No se pudo completar', errorMessage(error, fallback));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert('¿Eliminar el presupuesto?', 'Se borran el presupuesto y sus avisos. Tus movimientos no se tocan.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          void run(async () => {
            await deleteBudget(budget.id);
            router.back();
          }, 'No pudimos eliminarlo.'),
      },
    ]);

  return (
    <Screen
      header={
        <ScreenHeader
          title={name}
          right={<IconButton icon="pencil" accessibilityLabel="Editar presupuesto" onPress={() => openForm({ id: budget.id })} />}
        />
      }
    >
      <FinancialCard padding={spacing.xl}>
        <View style={styles.row}>
          <AppText variant="overline" color="textSecondary" style={styles.flex}>
            {BUDGET_PERIOD_LABEL[budget.period]} · {periodLabel(budget.period, budget.periodStart, budget.periodEnd)}
          </AppText>
          <StateText label={BUDGET_STATE_LABEL[budget.state]} color={budgetStateColor(budget)} />
        </View>
        <AmountText amount={budget.available} variant="amountXL" fit color={over ? 'negative' : 'text'} style={{ marginTop: spacing.sm }} />
        <AppText variant="callout" color="textSecondary">
          {over ? 'por encima del límite de ' : 'disponibles de '}
          {formatMoney(budget.limit, { hidden })}
        </AppText>
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <ProgressBar ratio={budget.percentUsed / 100} color={budgetBarColor(budget, colors)} height={10} />
          <View style={styles.row}>
            <AppText variant="footnote" color="textSecondary">
              Gastado: {formatMoney(budget.spent, { hidden })}
            </AppText>
            <AppText variant="footnote" color={over ? 'negative' : 'textSecondary'}>
              {formatPercent(budget.percentUsed, { digits: 1 })}
            </AppText>
          </View>
        </View>
      </FinancialCard>

      <FinancialCard padding={spacing.lg} style={styles.list}>
        <InfoRow label="Categoría" value={category ? category.name : 'Todos los gastos'} showDivider={false} />
        <InfoRow label="Límite" value={formatMoney(budget.limit, { hidden })} />
        {budget.state === 'active' || budget.state === 'exceeded' ? <InfoRow label="Días restantes" value={String(budget.daysLeft)} /> : null}
        {budget.previousSpent !== null ? <InfoRow label="Período anterior" value={formatMoney(budget.previousSpent, { hidden })} /> : null}
        <InfoRow label="Desde" value={formatShortDate(budget.startDate)} />
        {budget.endDate ? <InfoRow label="Hasta" value={formatShortDate(budget.endDate)} /> : null}
        <InfoRow label="Avisos" value={budget.thresholds.length ? `${budget.thresholds.join(' %, ')} %` : 'Solo al superarlo'} />
      </FinancialCard>

      {alerts.length > 0 ? (
        <View>
          <SectionHeader title="Avisos de este período" />
          <FinancialCard padding={spacing.lg} style={styles.list}>
            {alerts.map((alert, index) => (
              <ListRow
                key={alert.id}
                title={alert.kind === 'exceeded' ? 'Superaste el límite' : `Llegaste al ${alert.threshold} %`}
                subtitle={`${formatShortDate(alert.createdAt.slice(0, 10))} · ${formatMoney(alert.spent, { hidden })} gastado`}
                icon={alert.kind === 'exceeded' ? 'exclamationmark.triangle.fill' : 'bell.fill'}
                tone={alert.kind === 'exceeded' ? 'rose' : 'amber'}
                showDivider={index > 0}
              />
            ))}
          </FinancialCard>
        </View>
      ) : null}

      <View>
        <SectionHeader title="Períodos" subtitle="Desde que empezó el presupuesto" />
        <FinancialCard padding={spacing.lg} style={styles.list}>
          {history.rows === null ? (
            history.failed ? (
              <AppText variant="footnote" color="textSecondary" style={{ paddingVertical: spacing.md }}>
                No pudimos cargar el historial.
              </AppText>
            ) : (
              <LoadingState rows={2} label="Cargando historial" />
            )
          ) : (
            history.rows.map((row, index) => (
              <View
                key={row.periodStart}
                style={[styles.historyRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
              >
                <AppText variant="subhead" style={styles.historyLabel} numberOfLines={1}>
                  {periodLabel(budget.period, row.periodStart, row.periodEnd)}
                </AppText>
                <View style={styles.flex}>
                  <ProgressBar ratio={row.percentUsed / 100} color={budgetBarColor({ percentUsed: row.percentUsed, thresholds: budget.thresholds }, colors)} height={6} />
                </View>
                <AppText variant="footnote" color="textSecondary" style={styles.historyValue}>
                  {formatMoney(row.spent, { hidden })}
                </AppText>
              </View>
            ))
          )}
        </FinancialCard>
      </View>

      <View>
        <SectionHeader title="Gastos de este período" subtitle={movements.length ? `${movements.length} movimientos` : undefined} />
        {movements.length === 0 ? (
          <FinancialCard>
            <EmptyState icon="tray" title="Sin gastos en este período" message="Cuando registres gastos de esta categoría aparecerán aquí." />
          </FinancialCard>
        ) : (
          <FinancialCard padding={16} style={styles.list}>
            {movements.slice(0, 20).map((transaction, index) => (
              <TransactionItem key={transaction.id} transaction={transaction} meta="date" showDivider={index > 0} />
            ))}
          </FinancialCard>
        )}
      </View>

      <View style={{ gap: spacing.sm }}>
        {budget.archivedAt ? (
          <PrimaryButton
            label="Reactivar presupuesto"
            icon="arrow.uturn.backward"
            loading={busy}
            onPress={() => void run(() => setBudgetArchived(budget.id, false), 'No pudimos reactivarlo.')}
          />
        ) : (
          <SecondaryButton
            label="Archivar"
            icon="archivebox"
            disabled={busy}
            onPress={() => void run(() => setBudgetArchived(budget.id, true), 'No pudimos archivarlo.')}
          />
        )}
        <SecondaryButton label="Eliminar presupuesto" icon="trash" disabled={busy} onPress={confirmDelete} />
      </View>
      <AppText variant="caption" color="textTertiary">
        Archivar lo pausa y conserva su historial. Eliminar no borra ningún movimiento.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  list: { paddingVertical: 4 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  historyLabel: { width: 112 },
  historyValue: { width: 96, textAlign: 'right' },
});
