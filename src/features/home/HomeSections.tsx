import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LogoLockup } from '@/components/brand/LogoMark';
import { BarChart } from '@/components/charts/BarChart';
import { ChartCard } from '@/components/charts/ChartCard';
import { AccountCard } from '@/components/finance/AccountCard';
import { AmountText } from '@/components/finance/AmountText';
import { ProgressBar, budgetColor } from '@/components/finance/Progress';
import { TransactionItem } from '@/components/finance/TransactionItem';
import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { NotificationBadge } from '@/components/ui/NotificationBadge';
import { PressableScale } from '@/components/ui/PressableScale';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DEMO_ADVISOR_TIP, DEMO_NOTIFICATIONS, DEMO_USER } from '@/features/demo/data';
import {
  getBudgetOverview,
  getHomeAccounts,
  getRecentTransactions,
  getStats,
  type StatsPeriod,
} from '@/features/demo/selectors';
import { greeting, nowInBogota } from '@/lib/dates';
import { formatPercent } from '@/lib/money';
import { palette, useAppTheme } from '@/theme';

export function HomeHeader() {
  const { colors, scheme, spacing } = useAppTheme();
  const unread = DEMO_NOTIFICATIONS.filter((notification) => !notification.read).length;
  const { hour } = nowInBogota();

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.headerRow}>
        <LogoLockup color={scheme === 'dark' ? palette.ivory : palette.forest} />
        <View style={styles.headerActions}>
          <IconButton icon="bell.fill" accessibilityLabel={`Notificaciones, ${unread} sin leer`} onPress={() => router.push('/notifications')}>
            <NotificationBadge count={unread} />
          </IconButton>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Perfil y módulos"
            scaleTo={0.92}
            onPress={() => router.push('/profile')}
            style={[styles.avatar, { backgroundColor: colors.primary }]}
          >
            <AppText variant="subhead" color="onPrimary" style={styles.avatarText}>
              {DEMO_USER.initials}
            </AppText>
          </PressableScale>
        </View>
      </View>
      <View>
        <AppText variant="callout" color="textSecondary">
          {greeting(hour)},
        </AppText>
        <AppText variant="largeTitle">{DEMO_USER.firstName}</AppText>
      </View>
    </View>
  );
}

export function HomeAccounts() {
  const { spacing } = useAppTheme();
  const accounts = getHomeAccounts();
  const rows = [accounts.slice(0, 2), accounts.slice(2, 4)];
  return (
    <View>
      <SectionHeader title="Mis cuentas" actionLabel="Ver todas" onAction={() => router.navigate('/accounts')} />
      <View style={{ gap: spacing.md }}>
        {rows.map((row, index) => (
          <View key={index} style={[styles.gridRow, { gap: spacing.md }]}>
            {row.map((account) => (
              <AccountCard key={account.id} account={account} variant="compact" />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const HOME_PERIODS = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
] as const;

const PERIOD_CAPTION: Record<StatsPeriod, string> = {
  week: 'Total de los últimos 7 días',
  month: 'Total de las últimas 4 semanas',
  '3m': 'Total de los últimos 3 meses',
  '6m': 'Total de los últimos 6 meses',
  year: 'Total de los últimos 12 meses',
};

export function HomeAnalysis() {
  const { colors } = useAppTheme();
  const [period, setPeriod] = useState<StatsPeriod>('month');
  const stats = getStats(period);
  return (
    <ChartCard
      title="Análisis"
      subtitle="Ingresos frente a gastos"
      control={
        <SegmentedControl
          options={[...HOME_PERIODS]}
          value={period}
          onChange={setPeriod}
          accessibilityLabel="Periodo del análisis"
        />
      }
    >
      <BarChart
        key={period}
        labels={stats.points.map((point) => point.label)}
        details={stats.points.map((point) => point.detail)}
        totalsCaption={PERIOD_CAPTION[period]}
        series={[
          { key: 'income', label: 'Ingresos', color: colors.positiveGraphic, values: stats.points.map((p) => p.income) },
          { key: 'expense', label: 'Gastos', color: colors.negativeGraphic, values: stats.points.map((p) => p.expense) },
        ]}
      />
    </ChartCard>
  );
}

export function HomeBudget() {
  const { colors, spacing } = useAppTheme();
  const budget = getBudgetOverview();
  const items = [
    { label: 'Presupuesto', amount: budget.limit },
    { label: 'Gastado', amount: budget.spent },
    { label: 'Disponible', amount: budget.remaining },
  ];
  return (
    <View>
      <SectionHeader title="Presupuesto" actionLabel="Detalle" onAction={() => router.push('/budgets')} />
      <FinancialCard onPress={() => router.push('/budgets')} accessibilityLabel="Ver presupuesto por categoría">
        <View style={styles.budgetTop}>
          <AppText variant="headline">Noviembre</AppText>
          <AppText variant="footnote" color="textSecondary">
            Quedan {budget.daysLeft} días
          </AppText>
        </View>
        <View style={[styles.budgetRow, { marginTop: spacing.md, marginBottom: spacing.lg }]}>
          {items.map((item) => (
            <View key={item.label} style={styles.budgetItem}>
              <AppText variant="caption" color="textSecondary">
                {item.label}
              </AppText>
              <AmountText amount={item.amount} variant="amountS" fit />
            </View>
          ))}
        </View>
        <ProgressBar ratio={budget.ratio} color={budgetColor(budget.ratio, colors)} height={10} />
        <AppText variant="footnote" color="textSecondary" style={{ marginTop: spacing.sm }}>
          Has usado el {formatPercent(budget.ratio * 100, { digits: 0 })} del presupuesto del mes.
        </AppText>
      </FinancialCard>
    </View>
  );
}

export function HomeRecent() {
  const transactions = getRecentTransactions(5);
  return (
    <View>
      <SectionHeader title="Últimos movimientos" actionLabel="Ver todos" onAction={() => router.navigate('/transactions')} />
      <FinancialCard padding={16} style={styles.listCard}>
        {transactions.map((transaction, index) => (
          <TransactionItem key={transaction.id} transaction={transaction} meta="date" showDivider={index > 0} />
        ))}
      </FinancialCard>
    </View>
  );
}

export function HomeAdvisorTip() {
  const { colors, spacing } = useAppTheme();
  return (
    <FinancialCard onPress={() => router.navigate('/assistant')} accessibilityLabel="Consejo de ejemplo del asesor. Abrir asesor">
      <View style={styles.tipHead}>
        <View style={[styles.tipIcon, { backgroundColor: colors.accentSoft }]}>
          <Icon name="sparkles" size={17} color={colors.accentText} />
        </View>
        <View style={styles.flex}>
          <AppText variant="subhead">Consejo del asesor</AppText>
          <AppText variant="caption" color="textTertiary">
            Ejemplo · el asesor con IA llega en la Fase 9
          </AppText>
        </View>
      </View>
      <AppText variant="headline" style={{ marginTop: spacing.md }}>
        {DEMO_ADVISOR_TIP.title}
      </AppText>
      <AppText variant="callout" color="textSecondary" style={{ marginTop: spacing.xs }}>
        {DEMO_ADVISOR_TIP.body}
      </AppText>
      <View style={[styles.tipLink, { marginTop: spacing.md }]}>
        <AppText variant="subhead" color="primary">
          Hablar con el asesor
        </AppText>
        <Icon name="chevron.right" size={11} color={colors.primary} weight="bold" />
      </View>
    </FinancialCard>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: 'Inter_600SemiBold', letterSpacing: 0.5 },
  gridRow: { flexDirection: 'row' },
  budgetTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  budgetRow: { flexDirection: 'row', gap: 12 },
  budgetItem: { flex: 1, minWidth: 0, gap: 2 },
  listCard: { paddingVertical: 4 },
  tipHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tipLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flex: { flex: 1 },
});
