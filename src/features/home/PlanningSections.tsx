/**
 * Secciones del Inicio con presupuestos, gasto por categoría, metas, deudas,
 * próximos pagos y capacidad de ahorro (datos reales). Cada bloque lleva a su
 * módulo con un toque. Solo aparece lo que tiene datos, para no llenar la
 * pantalla.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/finance/AmountText';
import { CategoryIcon } from '@/components/finance/Badges';
import { ProgressBar } from '@/components/finance/Progress';
import { AppText } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { ListRow } from '@/components/ui/Rows';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { budgetBarColor } from '@/features/planning/cards';
import { budgetName, relativeDays } from '@/features/planning/labels';
import { useReminders } from '@/features/planning/useReminderSync';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { diffInDays, formatShortDate, nowInBogota } from '@/lib/dates';
import { formatMoney, formatPercent } from '@/lib/money';
import { useAppTheme } from '@/theme';

/** Avisos sin ver + cuotas vencidas: para la campana y la franja de alertas. */
export function usePendingAlerts(): number {
  const { mode, budgetAlerts, debts } = useFinanceData();
  if (mode === 'demo') return 0;
  return budgetAlerts.filter((a) => !a.seenAt).length + debts.filter((d) => d.state === 'overdue').length;
}

export function PlanningSections() {
  const { colors, spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const today = nowInBogota().date;
  const { budgets, goals, debts, summary, planning, monthSpending, getCategory } = useFinanceData();
  const reminders = useReminders(14).filter((r) => r.kind === 'debt' || r.kind === 'card');
  const pending = usePendingAlerts();

  const activeBudgets = budgets.filter((b) => !b.archivedAt && (b.state === 'active' || b.state === 'exceeded'));
  const general = activeBudgets.find((b) => b.categoryId === null && b.period === 'monthly');
  const featured = general ? [general] : [...activeBudgets].sort((a, b) => b.percentUsed - a.percentUsed).slice(0, 2);
  const liveGoals = goals.filter((g) => !g.archivedAt);
  const goalSaved = liveGoals.reduce((t, g) => t + g.saved, 0);
  const goalTarget = liveGoals.reduce((t, g) => t + g.target, 0);
  const totalDebt = summary?.totalDebt ?? 0;
  const topSpending = monthSpending.slice(0, 4);
  const maxSpending = topSpending[0]?.total ?? 0;
  const nameOf = (id: string) => {
    const budget = budgets.find((b) => b.id === id);
    return budget ? budgetName(budget, budget.categoryId ? getCategory(budget.categoryId) : undefined) : '';
  };

  return (
    <>
      {pending > 0 ? (
        <FinancialCard tone="muted" padding={spacing.lg} onPress={() => router.push('/notifications')} accessibilityLabel={`${pending} avisos`}>
          <View style={[styles.row, { gap: spacing.md }]}>
            <Icon name="bell.badge.fill" size={20} color={colors.warning} />
            <AppText variant="subhead" style={styles.flex}>
              {pending === 1 ? 'Tienes 1 aviso nuevo' : `Tienes ${pending} avisos nuevos`}
            </AppText>
            <Icon name="chevron.right" size={14} color={colors.textTertiary} />
          </View>
        </FinancialCard>
      ) : null}

      <View>
        <SectionHeader title="Presupuesto" actionLabel={budgets.length ? 'Ver todos' : undefined} onAction={() => router.push('/budgets')} />
        {featured.length === 0 ? (
          <FinancialCard padding={spacing.lg} onPress={() => router.push('/budget/edit')} accessibilityLabel="Crear presupuesto">
            <View style={[styles.row, { gap: spacing.md }]}>
              <Icon name="chart.pie.fill" size={20} color={colors.primary} />
              <View style={styles.flex}>
                <AppText variant="subhead">Pon un límite a tus gastos</AppText>
                <AppText variant="footnote" color="textSecondary">
                  Te avisamos al 50, 75, 90 y 100 %.
                </AppText>
              </View>
              <Icon name="plus" size={16} color={colors.primary} />
            </View>
          </FinancialCard>
        ) : (
          <FinancialCard padding={spacing.lg} style={{ gap: spacing.lg }} onPress={() => router.push('/budgets')}>
            {featured.map((budget) => (
              <View key={budget.id} style={{ gap: spacing.sm }}>
                <View style={styles.row}>
                  <AppText variant="subhead" style={styles.flex} numberOfLines={1}>
                    {nameOf(budget.id)}
                  </AppText>
                  <AppText variant="footnote" color={budget.available < 0 ? 'negative' : 'textSecondary'}>
                    {budget.available < 0 ? 'Excedido ' : 'Quedan '}
                    {formatMoney(Math.abs(budget.available), { hidden })}
                  </AppText>
                </View>
                <ProgressBar ratio={budget.percentUsed / 100} color={budgetBarColor(budget, colors)} />
                <AppText variant="caption" color="textTertiary">
                  {formatMoney(budget.spent, { hidden })} de {formatMoney(budget.limit, { hidden })} · {formatPercent(budget.percentUsed, { digits: 0 })}
                </AppText>
              </View>
            ))}
          </FinancialCard>
        )}
      </View>

      {topSpending.length > 0 ? (
        <View>
          <SectionHeader title="Gasto por categoría" subtitle="Este mes" actionLabel="Movimientos" onAction={() => router.navigate('/transactions')} />
          <FinancialCard padding={spacing.lg} style={{ gap: spacing.md }}>
            {topSpending.map((item) => {
              const category = getCategory(item.categoryId);
              return (
                <View key={item.categoryId} style={[styles.row, { gap: spacing.md }]}>
                  <CategoryIcon category={category} size={30} />
                  <View style={[styles.flex, { gap: 4 }]}>
                    <View style={styles.row}>
                      <AppText variant="footnote" style={styles.flex} numberOfLines={1}>
                        {category.name}
                      </AppText>
                      <AppText variant="footnote" color="textSecondary">
                        {formatMoney(item.total, { hidden })}
                      </AppText>
                    </View>
                    <ProgressBar ratio={maxSpending > 0 ? item.total / maxSpending : 0} color={colors.primary} height={5} />
                  </View>
                </View>
              );
            })}
          </FinancialCard>
        </View>
      ) : null}

      <View style={[styles.row, { gap: spacing.md, alignItems: 'stretch' }]}>
        <FinancialCard padding={spacing.lg} style={styles.flex} onPress={() => router.push('/savings')} accessibilityLabel="Metas de ahorro">
          <AppText variant="caption" color="textSecondary">
            Metas
          </AppText>
          {liveGoals.length ? (
            <>
              <AmountText amount={goalSaved} variant="amountM" fit style={{ marginTop: 4 }} />
              <AppText variant="caption" color="textTertiary">
                {formatPercent(goalTarget > 0 ? (goalSaved / goalTarget) * 100 : 0, { digits: 0 })} de {liveGoals.length}{' '}
                {liveGoals.length === 1 ? 'meta' : 'metas'}
              </AppText>
            </>
          ) : (
            <AppText variant="footnote" color="primary" style={{ marginTop: 4 }}>
              Crear una meta
            </AppText>
          )}
        </FinancialCard>
        <FinancialCard padding={spacing.lg} style={styles.flex} onPress={() => router.push('/debts')} accessibilityLabel="Deudas">
          <AppText variant="caption" color="textSecondary">
            Deudas
          </AppText>
          {totalDebt > 0 || debts.length ? (
            <>
              <AmountText amount={totalDebt} variant="amountM" fit style={{ marginTop: 4 }} />
              <AppText variant="caption" color="textTertiary">
                tarjetas y préstamos
              </AppText>
            </>
          ) : (
            <AppText variant="footnote" color="textSecondary" style={{ marginTop: 4 }}>
              Sin deudas
            </AppText>
          )}
        </FinancialCard>
      </View>

      {reminders.length > 0 ? (
        <View>
          <SectionHeader title="Próximos pagos" subtitle="14 días" actionLabel="Avisos" onAction={() => router.push('/notifications')} />
          <FinancialCard padding={spacing.lg} style={styles.list}>
            {reminders.slice(0, 3).map((reminder, index) => (
              <ListRow
                key={reminder.id}
                title={reminder.title}
                subtitle={`${formatShortDate(reminder.date)} · ${relativeDays(diffInDays(today, reminder.date))}`}
                icon={reminder.kind === 'card' ? 'creditcard.fill' : 'banknote'}
                tone={reminder.overdue ? 'rose' : reminder.kind === 'card' ? 'gold' : 'clay'}
                value={reminder.amount !== null ? formatMoney(reminder.amount, { hidden }) : undefined}
                showDivider={index > 0}
                onPress={() => router.push(reminder.href as never)}
              />
            ))}
          </FinancialCard>
        </View>
      ) : null}

      {planning && planning.basis !== 'none' && planning.savingsCapacity !== null ? (
        <FinancialCard padding={spacing.lg} onPress={() => router.push('/planning')} accessibilityLabel="Planificación">
          <View style={styles.row}>
            <View style={styles.flex}>
              <AppText variant="caption" color="textSecondary">
                Capacidad de ahorro al mes{planning.preliminary ? ' · preliminar' : ''}
              </AppText>
              <AmountText
                amount={planning.savingsCapacity}
                variant="amountM"
                color={planning.savingsCapacity < 0 ? 'negative' : 'text'}
                style={{ marginTop: 4 }}
              />
            </View>
            <View style={styles.right}>
              <AppText variant="caption" color="textSecondary">
                Ahorro del mes
              </AppText>
              <AppText variant="subhead" color={(summary?.monthSavings ?? 0) < 0 ? 'negative' : 'text'}>
                {summary?.savingsRate === null || summary?.savingsRate === undefined ? '—' : formatPercent(summary.savingsRate, { digits: 0 })}
              </AppText>
            </View>
            <Icon name="chevron.right" size={14} color={colors.textTertiary} />
          </View>
        </FinancialCard>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', marginRight: 10 },
  list: { paddingVertical: 4 },
});
