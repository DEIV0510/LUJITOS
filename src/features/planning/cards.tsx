/** Filas y tarjetas de presupuestos, metas y deudas (datos reales). */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/finance/AmountText';
import { CategoryIcon } from '@/components/finance/Badges';
import { ProgressBar } from '@/components/finance/Progress';
import { AppText, type TextColor } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { isTone } from '@/services/finance/mappers';
import { formatShortDate } from '@/lib/dates';
import { formatMoney, formatPercent } from '@/lib/money';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { resolveTone, useAppTheme, type ThemeColors, type Tone } from '@/theme';
import type { Category, IconName } from '@/types/finance';
import type { Budget, DebtRecord, Goal } from '@/types/planning';

import { BUDGET_STATE_LABEL, DEBT_STATE_LABEL, GOAL_KIND_ICON, GOAL_STATE_LABEL, LOAN_KIND_ICON, LOAN_KIND_LABEL, periodLabel } from './labels';
import { StateText } from './ui';

/** Color de la barra: superado, cerca del límite (último aviso antes del 100 %) o normal. */
export function budgetBarColor(budget: Pick<Budget, 'percentUsed' | 'thresholds'>, colors: ThemeColors): string {
  if (budget.percentUsed >= 100) return colors.negativeGraphic;
  const warnings = budget.thresholds.filter((t) => t < 100);
  const lastWarning = warnings.length ? Math.max(...warnings) : 90;
  if (budget.percentUsed >= Math.min(lastWarning, 90)) return colors.warningGraphic;
  return colors.primary;
}

export function budgetStateColor(budget: Pick<Budget, 'state' | 'percentUsed'>): TextColor {
  if (budget.state === 'exceeded') return 'negative';
  if (budget.state === 'active') return budget.percentUsed >= 90 ? 'warning' : 'textSecondary';
  return 'textTertiary';
}

function ToneIcon({ icon, tone, size = 40 }: { icon: IconName; tone: Tone; size?: number }) {
  const { scheme } = useAppTheme();
  const set = resolveTone(tone, scheme);
  return (
    <View style={[styles.icon, { width: size, height: size, borderRadius: size / 3.2, backgroundColor: set.soft }]}>
      <Icon name={icon} size={size * 0.46} color={set.ink} />
    </View>
  );
}

// ---------------------------------------------------------------- Presupuesto
export function BudgetRow({
  budget,
  name,
  category,
  showDivider,
}: {
  budget: Budget;
  name: string;
  category?: Category;
  showDivider?: boolean;
}) {
  const { colors, spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const over = budget.available < 0;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${name}: ${formatPercent(budget.percentUsed, { digits: 0 })} usado`}
      onPress={() => router.push({ pathname: '/budget/[id]', params: { id: budget.id } })}
      style={[{ gap: spacing.sm, paddingVertical: spacing.md }, showDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
    >
      <View style={styles.head}>
        {category ? <CategoryIcon category={category} size={36} /> : <ToneIcon icon="chart.pie.fill" tone="forest" size={36} />}
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {name}
          </AppText>
          <AppText variant="footnote" color="textSecondary" numberOfLines={1}>
            {formatMoney(budget.spent, { hidden })} de {formatMoney(budget.limit, { hidden })}
          </AppText>
        </View>
        <AppText variant="subhead" color={over ? 'negative' : budget.percentUsed >= 90 ? 'warning' : 'text'}>
          {formatPercent(budget.percentUsed, { digits: 0 })}
        </AppText>
      </View>
      <ProgressBar ratio={budget.percentUsed / 100} color={budgetBarColor(budget, colors)} />
      <View style={styles.foot}>
        <AppText variant="footnote" color={over ? 'negative' : 'textSecondary'} style={styles.flex} numberOfLines={1}>
          {over ? 'Excedido en ' : 'Disponible: '}
          {formatMoney(Math.abs(budget.available), { hidden })}
          {budget.state === 'active' || budget.state === 'exceeded'
            ? ` · ${budget.daysLeft === 0 ? 'último día' : `${budget.daysLeft} días`}`
            : ''}
        </AppText>
        {budget.state !== 'active' ? (
          <StateText label={BUDGET_STATE_LABEL[budget.state]} color={budgetStateColor(budget)} />
        ) : (
          <AppText variant="caption" color="textTertiary">
            {periodLabel(budget.period, budget.periodStart, budget.periodEnd)}
          </AppText>
        )}
      </View>
    </PressableScale>
  );
}

// ---------------------------------------------------------------- Meta
export function goalStateColor(goal: Pick<Goal, 'state'>): TextColor {
  return goal.state === 'completed' ? 'positive' : goal.state === 'overdue' ? 'warning' : 'textTertiary';
}

export function goalTone(goal: Pick<Goal, 'color'>): Tone {
  return isTone(goal.color) ? goal.color : 'gold';
}

export function GoalCard({ goal }: { goal: Goal }) {
  const { colors, spacing, scheme } = useAppTheme();
  const { hidden } = usePrivacy();
  const tone = goalTone(goal);
  const set = resolveTone(tone, scheme);
  const icon = (goal.icon as IconName | null) ?? GOAL_KIND_ICON[goal.kind];
  return (
    <FinancialCard
      padding={spacing.lg}
      onPress={() => router.push({ pathname: '/goal/[id]', params: { id: goal.id } })}
      accessibilityLabel={`Meta ${goal.name}, ${formatPercent(goal.percent, { digits: 0 })}`}
    >
      <View style={styles.head}>
        <ToneIcon icon={icon} tone={tone} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {goal.name}
          </AppText>
          <AppText variant="footnote" color="textSecondary" numberOfLines={1}>
            {formatMoney(goal.saved, { hidden })} de {formatMoney(goal.target, { hidden })}
          </AppText>
        </View>
        <AppText variant="subhead" color={goal.state === 'completed' ? 'positive' : 'text'}>
          {formatPercent(goal.percent, { digits: goal.percent > 0 && goal.percent < 10 ? 1 : 0 })}
        </AppText>
      </View>
      <View style={{ marginTop: spacing.md }}>
        <ProgressBar ratio={goal.percent / 100} color={goal.state === 'completed' ? colors.positive : set.base} />
      </View>
      <View style={[styles.foot, { marginTop: spacing.sm }]}>
        <AppText variant="footnote" color="textSecondary" style={styles.flex} numberOfLines={1}>
          {goal.state === 'completed'
            ? goal.exceededBy > 0
              ? `Superada por ${formatMoney(goal.exceededBy, { hidden })}`
              : 'Meta cumplida'
            : goal.monthlyNeeded !== null
              ? `${formatMoney(goal.monthlyNeeded, { hidden })} al mes`
              : `Faltan ${formatMoney(goal.remaining, { hidden })}`}
        </AppText>
        {goal.state !== 'active' ? (
          <StateText label={GOAL_STATE_LABEL[goal.state]} color={goalStateColor(goal)} />
        ) : goal.unassigned ? (
          <StateText label="Sin cuenta asignada" color="textTertiary" />
        ) : goal.targetDate ? (
          <AppText variant="caption" color="textTertiary">
            {formatShortDate(goal.targetDate)}
          </AppText>
        ) : null}
      </View>
    </FinancialCard>
  );
}

// ---------------------------------------------------------------- Deuda
export function debtStateColor(debt: Pick<DebtRecord, 'state'>): TextColor {
  return debt.state === 'paid' ? 'positive' : debt.state === 'overdue' ? 'negative' : 'textTertiary';
}

export function debtTone(debt: Pick<DebtRecord, 'color'>): Tone {
  return isTone(debt.color) ? debt.color : 'rose';
}

export function DebtCard({ debt }: { debt: DebtRecord }) {
  const { colors, spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  return (
    <FinancialCard
      padding={spacing.lg}
      onPress={() => router.push({ pathname: '/debt/[id]', params: { id: debt.id } })}
      accessibilityLabel={`Deuda ${debt.name}, debes ${formatMoney(debt.outstanding)}`}
    >
      <View style={styles.head}>
        <ToneIcon icon={LOAN_KIND_ICON[debt.kind]} tone={debtTone(debt)} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {debt.name}
          </AppText>
          <AppText variant="footnote" color="textSecondary" numberOfLines={1}>
            {debt.creditor ?? LOAN_KIND_LABEL[debt.kind]}
          </AppText>
        </View>
        <View style={styles.right}>
          <AmountText amount={debt.outstanding} variant="amountS" />
          <AppText variant="caption" color="textTertiary">
            pendiente
          </AppText>
        </View>
      </View>
      <View style={{ marginTop: spacing.md }}>
        <ProgressBar ratio={debt.percentPaid / 100} color={debt.state === 'paid' ? colors.positive : colors.primary} />
      </View>
      <View style={[styles.foot, { marginTop: spacing.sm }]}>
        <AppText variant="footnote" color="textSecondary" style={styles.flex} numberOfLines={1}>
          {formatPercent(debt.percentPaid, { digits: 0 })} pagado
          {debt.nextPaymentDate
            ? ` · cuota ${formatShortDate(debt.nextPaymentDate)}${debt.installment ? ` (${formatMoney(debt.installment, { hidden })})` : ''}`
            : ''}
        </AppText>
        {debt.state !== 'active' ? <StateText label={DEBT_STATE_LABEL[debt.state]} color={debtStateColor(debt)} /> : null}
      </View>
    </FinancialCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end' },
  icon: { alignItems: 'center', justifyContent: 'center' },
});
