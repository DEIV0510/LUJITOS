import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AmountText } from '@/components/finance/AmountText';
import { CategoryIcon, InstitutionBadge } from '@/components/finance/Badges';
import { TransactionItem } from '@/components/finance/TransactionItem';
import { TabHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/Buttons';
import { FilterChip } from '@/components/ui/FormField';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { ListRow } from '@/components/ui/Rows';
import { EmptyState } from '@/components/ui/States';
import { DemoModeBanner } from '@/features/data/DemoModeBanner';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { groupByDay, inMonth, totalsOf } from '@/features/data/summaries';
import { DEMO_TODAY } from '@/features/demo/data';
import { getInstitution } from '@/features/demo/selectors';
import { formatDayHeading, formatMonthYear, nowInBogota, parseISO } from '@/lib/dates';
import { screenPadding, useAppTheme } from '@/theme';
import type { StoredTransactionType } from '@/types/finance';

type TypeFilter = StoredTransactionType | 'all';

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'transfer', label: 'Transferencias' },
];

function shiftMonth(key: string, delta: number): string {
  const { year, month } = parseISO(`${key}-01`);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function TransactionsRoute() {
  const { mode } = useFinanceData();
  // Al cambiar entre datos reales y demostración, la pantalla empieza de cero.
  return <TransactionsScreen key={mode} />;
}

function TransactionsScreen() {
  const { colors, spacing } = useAppTheme();
  const { mode, transactions, accounts, categories, getAccount, getCategory, status, error, reload } = useFinanceData();
  const today = mode === 'demo' ? DEMO_TODAY : nowInBogota().date;
  const [month, setMonth] = useState(today.slice(0, 7));
  const [type, setType] = useState<TypeFilter>('all');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'account' | 'category' | null>(null);

  const monthTransactions = inMonth(transactions, month).filter(
    (t) =>
      (!accountId || t.accountId === accountId || t.toAccountId === accountId) &&
      (!categoryId || t.categoryId === categoryId),
  );
  const totals = totalsOf(monthTransactions);
  const visible = monthTransactions.filter((t) => type === 'all' || t.type === type);
  const days = groupByDay(visible);
  const { year, month: monthNumber } = parseISO(`${month}-01`);
  const isCurrentMonth = month === today.slice(0, 7);
  const account = getAccount(accountId ?? undefined);
  const hasFilters = Boolean(accountId || categoryId || type !== 'all');

  return (
    <Screen inTabs withFab>
      <TabHeader title="Mis movimientos" subtitle="Ingresos, gastos y transferencias" />
      <DemoModeBanner />
      {mode === 'live' && status === 'error' ? (
        <EmptyState icon="wifi" title="No pudimos cargar tus movimientos" message={error ?? 'Revisa tu conexión.'} actionLabel="Reintentar" onAction={() => void reload()} />
      ) : null}

      <View style={{ gap: spacing.md }}>
        <View style={styles.monthNav}>
          <IconButton icon="chevron.left" accessibilityLabel="Mes anterior" onPress={() => setMonth(shiftMonth(month, -1))} />
          <AppText variant="headline" align="center" style={styles.flex} accessibilityRole="header">
            {formatMonthYear(year, monthNumber)}
          </AppText>
          <IconButton
            icon="chevron.right"
            accessibilityLabel="Mes siguiente"
            onPress={() => {
              if (!isCurrentMonth) setMonth(shiftMonth(month, 1));
            }}
          />
        </View>

        <FinancialCard padding={spacing.lg}>
          <View style={styles.totals}>
            <View style={styles.total}>
              <AppText variant="caption" color="textSecondary">
                Ingresos
              </AppText>
              <AmountText amount={totals.income} variant="amount" color="positive" fit />
            </View>
            <View style={[styles.total, styles.totalRight, { borderColor: colors.border }]}>
              <AppText variant="caption" color="textSecondary">
                Gastos
              </AppText>
              <AmountText amount={-totals.expense} variant="amount" color="negative" fit />
            </View>
          </View>
          <View style={[styles.balance, { borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.md }]}>
            <AppText variant="subhead">Balance del periodo</AppText>
            <AmountText amount={totals.balance} variant="amountM" sign="always" />
          </View>
          <AppText variant="caption" color="textTertiary" style={{ marginTop: spacing.sm }}>
            Las transferencias entre tus cuentas no suman como ingreso ni gasto.
          </AppText>
        </FinancialCard>
      </View>

      <View style={{ gap: spacing.sm }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chips}>
          {TYPE_FILTERS.map((filter) => (
            <FilterChip key={filter.value} label={filter.label} selected={type === filter.value} onPress={() => setType(filter.value)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chips}>
          <FilterChip
            label={account ? getInstitution(account).name : 'Cuenta'}
            icon="creditcard"
            trailingIcon="chevron.down"
            selected={Boolean(accountId)}
            onPress={() => setSheet('account')}
          />
          <FilterChip
            label={categoryId ? getCategory(categoryId).name : 'Categoría'}
            icon="square.grid.2x2.fill"
            trailingIcon="chevron.down"
            selected={Boolean(categoryId)}
            onPress={() => setSheet('category')}
          />
          {hasFilters ? (
            <FilterChip
              label="Limpiar"
              icon="xmark"
              onPress={() => {
                setType('all');
                setAccountId(null);
                setCategoryId(null);
              }}
            />
          ) : null}
        </ScrollView>
      </View>

      {days.length === 0 ? (
        <EmptyState
          icon="tray"
          title="Sin movimientos"
          message={hasFilters ? 'Ningún movimiento coincide con estos filtros en este mes.' : 'No hay movimientos registrados en este mes.'}
          actionLabel={hasFilters ? 'Quitar filtros' : undefined}
          onAction={
            hasFilters
              ? () => {
                  setType('all');
                  setAccountId(null);
                  setCategoryId(null);
                }
              : undefined
          }
        />
      ) : (
        <Animated.View key={`${month}-${type}-${accountId}-${categoryId}`} entering={FadeIn.duration(220)} style={{ gap: spacing.xl }}>
          {days.map((day) => {
            const dayTotals = totalsOf(day.data);
            return (
              <View key={day.date} style={{ gap: spacing.sm }}>
                <View style={styles.dayHeader}>
                  <AppText variant="subhead" color="textSecondary">
                    {formatDayHeading(day.date, today)}
                  </AppText>
                  {dayTotals.balance !== 0 ? (
                    <AmountText amount={dayTotals.balance} variant="footnote" sign="always" color="textSecondary" />
                  ) : null}
                </View>
                <FinancialCard padding={16} style={styles.dayCard}>
                  {day.data.map((transaction, index) => (
                    <TransactionItem key={transaction.id} transaction={transaction} showDivider={index > 0} />
                  ))}
                </FinancialCard>
              </View>
            );
          })}
        </Animated.View>
      )}

      <OptionSheet visible={sheet === 'account'} title="Filtrar por cuenta" onClose={() => setSheet(null)}>
        <ListRow
          title="Todas las cuentas"
          icon="square.grid.2x2.fill"
          onPress={() => {
            setAccountId(null);
            setSheet(null);
          }}
        />
        {accounts.map((option) => (
          <ListRow
            key={option.id}
            title={option.name}
            showDivider
            right={<InstitutionBadge institution={getInstitution(option)} size={30} />}
            onPress={() => {
              setAccountId(option.id);
              setSheet(null);
            }}
          />
        ))}
      </OptionSheet>

      <OptionSheet visible={sheet === 'category'} title="Filtrar por categoría" onClose={() => setSheet(null)}>
        <ListRow
          title="Todas las categorías"
          icon="square.grid.2x2.fill"
          onPress={() => {
            setCategoryId(null);
            setSheet(null);
          }}
        />
        {categories.map((category) => (
          <ListRow
            key={category.id}
            title={category.name}
            subtitle={category.kind === 'income' ? 'Ingreso' : 'Gasto'}
            showDivider
            right={<CategoryIcon category={category} size={30} />}
            onPress={() => {
              setCategoryId(category.id);
              setSheet(null);
            }}
          />
        ))}
      </OptionSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  totals: { flexDirection: 'row' },
  total: { flex: 1, minWidth: 0, gap: 2 },
  totalRight: { borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 16 },
  balance: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: StyleSheet.hairlineWidth },
  bleed: { marginHorizontal: -screenPadding },
  chips: { gap: 8, paddingHorizontal: screenPadding },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  dayCard: { paddingVertical: 4 },
});
