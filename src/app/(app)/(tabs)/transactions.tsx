import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { AmountText } from '@/components/finance/AmountText';
import { CategoryIcon, InstitutionBadge } from '@/components/finance/Badges';
import { MoneyInput } from '@/components/finance/MoneyInput';
import { TransactionItem } from '@/components/finance/TransactionItem';
import { TabHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { IconButton, PrimaryButton } from '@/components/ui/Buttons';
import { FilterChip, SelectField } from '@/components/ui/FormField';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { ListRow } from '@/components/ui/Rows';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { institutionOf } from '@/features/accounts/display';
import { DemoModeBanner } from '@/features/data/DemoModeBanner';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { totalsOf } from '@/features/data/summaries';
import { DEMO_TODAY } from '@/features/demo/data';
import {
  activeFilterCount,
  applyFilters,
  EMPTY_FILTERS,
  groupByMonthAndDay,
  type TransactionFilters,
  type TypeFilter,
} from '@/features/transactions/filters';
import { addDays, formatDayHeading, formatMonthYear, formatShortDate, nowInBogota, parseISO, toISO, type ISODate } from '@/lib/dates';
import { screenPadding, useAppTheme } from '@/theme';

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'transfer', label: 'Transferencias' },
  { value: 'adjustment', label: 'Ajustes' },
];

type Sheet = 'account' | 'category' | 'more' | 'from' | 'to' | null;

function shiftMonth(key: string, delta: number): string {
  const { year, month } = parseISO(`${key}-01`);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthBounds(key: string): { from: ISODate; to: ISODate } {
  const { year, month } = parseISO(`${key}-01`);
  const next = shiftMonth(key, 1);
  return { from: toISO(year, month, 1), to: addDays(`${next}-01`, -1) };
}

export default function TransactionsRoute() {
  const { mode } = useFinanceData();
  const params = useLocalSearchParams<{ accountId?: string }>();
  // Al cambiar entre datos reales y demostración (o llegar desde una cuenta), la pantalla empieza de cero.
  return <TransactionsScreen key={`${mode}|${params.accountId ?? ''}`} initialAccountId={params.accountId ?? null} />;
}

function TransactionsScreen({ initialAccountId }: { initialAccountId: string | null }) {
  const { colors, spacing, radius } = useAppTheme();
  const { mode, transactions, voidedTransactions, accounts, categories, getAccount, getCategory, status, error, reload } = useFinanceData();
  const today = mode === 'demo' ? DEMO_TODAY : nowInBogota().date;
  const [month, setMonth] = useState(today.slice(0, 7));
  const [filters, setFilters] = useState<TransactionFilters>({ ...EMPTY_FILTERS, accountId: initialAccountId });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [calendar, setCalendar] = useState(() => parseISO(today));

  const customRange = Boolean(filters.from || filters.to);
  // Sin rango propio se ve un mes a la vez; con rango, todo lo que cae en él.
  const effective = customRange ? filters : { ...filters, ...monthBounds(month) };
  const source = filters.includeVoided ? [...transactions, ...voidedTransactions].sort((a, b) =>
    a.date === b.date ? (b.createdAt ?? '').localeCompare(a.createdAt ?? '') : b.date.localeCompare(a.date),
  ) : transactions;
  const visible = applyFilters(source, effective);
  const months = groupByMonthAndDay(visible);
  const totals = totalsOf(visible.filter((t) => !t.voidedAt));
  const count = activeFilterCount(filters);
  const account = getAccount(filters.accountId ?? undefined);
  const { year, month: monthNumber } = parseISO(`${month}-01`);
  const isCurrentMonth = month === today.slice(0, 7);

  const set = <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const clear = () => setFilters(EMPTY_FILTERS);
  const quickRange = (from: ISODate | null, to: ISODate | null) => setFilters((current) => ({ ...current, from, to }));

  return (
    <Screen inTabs withFab>
      <TabHeader title="Mis movimientos" subtitle="Ingresos, gastos, transferencias y ajustes" />
      <DemoModeBanner />
      {mode === 'live' && status === 'error' ? (
        <EmptyState icon="wifi" title="No pudimos cargar tus movimientos" message={error ?? 'Revisa tu conexión.'} actionLabel="Reintentar" onAction={() => void reload()} />
      ) : null}

      <View style={[styles.search, { backgroundColor: colors.surface, borderRadius: radius.md, borderColor: colors.border }]}>
        <Icon name="magnifyingglass" size={15} color={colors.textTertiary} />
        <TextInput
          value={filters.search}
          onChangeText={(text) => set('search', text)}
          placeholder="Buscar por descripción o comercio"
          placeholderTextColor={colors.textTertiary}
          style={[styles.searchInput, { color: colors.text }]}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Buscar movimientos"
        />
      </View>

      {customRange ? (
        <View style={styles.monthNav}>
          <AppText variant="headline" style={styles.flex} accessibilityRole="header">
            {filters.from ? formatShortDate(filters.from) : 'Desde el inicio'} – {filters.to ? formatShortDate(filters.to) : 'hoy'}
          </AppText>
          <FilterChip label="Ver por mes" icon="calendar" onPress={() => quickRange(null, null)} />
        </View>
      ) : (
        <View style={styles.monthNav}>
          <IconButton icon="chevron.left" accessibilityLabel="Mes anterior" onPress={() => setMonth(shiftMonth(month, -1))} />
          <AppText variant="headline" align="center" style={styles.flex} accessibilityRole="header">
            {formatMonthYear(year, monthNumber)}
          </AppText>
          <IconButton icon="chevron.right" accessibilityLabel="Mes siguiente" onPress={() => !isCurrentMonth && setMonth(shiftMonth(month, 1))} />
        </View>
      )}

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
        <AppText variant="caption" color="textTertiary" style={{ marginTop: spacing.sm }}>
          {visible.length} {visible.length === 1 ? 'movimiento' : 'movimientos'}. Transferencias y ajustes no suman como ingreso ni gasto.
        </AppText>
      </FinancialCard>

      <View style={{ gap: spacing.sm }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chips}>
          {TYPE_FILTERS.map((filter) => (
            <FilterChip key={filter.value} label={filter.label} selected={filters.type === filter.value} onPress={() => set('type', filter.value)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chips}>
          <FilterChip
            label={account ? account.name : 'Cuenta'}
            icon="creditcard"
            trailingIcon="chevron.down"
            selected={Boolean(filters.accountId)}
            onPress={() => setSheet('account')}
          />
          <FilterChip
            label={filters.categoryId ? getCategory(filters.categoryId).name : 'Categoría'}
            icon="square.grid.2x2.fill"
            trailingIcon="chevron.down"
            selected={Boolean(filters.categoryId)}
            onPress={() => setSheet('category')}
          />
          <FilterChip
            label="Más filtros"
            icon="slider.horizontal.3"
            selected={customRange || filters.min !== null || filters.max !== null || filters.includeVoided}
            onPress={() => setSheet('more')}
          />
          {count > 0 ? <FilterChip label="Limpiar" icon="xmark" onPress={clear} /> : null}
        </ScrollView>
      </View>

      {mode === 'live' && (status === 'loading' || status === 'idle') ? (
        <FinancialCard padding={spacing.xl}>
          <LoadingState rows={3} label="Cargando tus movimientos" />
        </FinancialCard>
      ) : months.length === 0 ? (
        <EmptyState
          icon="tray"
          title="Sin movimientos"
          message={count > 0 ? 'Ningún movimiento coincide con estos filtros.' : customRange ? 'No hay movimientos en este rango.' : 'No hay movimientos registrados en este mes.'}
          actionLabel={count > 0 ? 'Quitar filtros' : undefined}
          onAction={count > 0 ? clear : undefined}
        />
      ) : (
        <View style={{ gap: spacing.xl }}>
          {months.map((group) => {
            const { year: groupYear, month: groupMonth } = parseISO(`${group.month}-01`);
            return (
              <View key={group.month} style={{ gap: spacing.lg }}>
                {customRange ? (
                  <AppText variant="title" accessibilityRole="header">
                    {formatMonthYear(groupYear, groupMonth)}
                  </AppText>
                ) : null}
                {group.days.map((day) => {
                  const dayTotals = totalsOf(day.data.filter((t) => !t.voidedAt));
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
              </View>
            );
          })}
        </View>
      )}

      <OptionSheet visible={sheet === 'account'} title="Filtrar por cuenta" onClose={() => setSheet(null)}>
        <ListRow title="Todas las cuentas" icon="square.grid.2x2.fill" onPress={() => { set('accountId', null); setSheet(null); }} />
        {accounts.map((option) => (
          <ListRow
            key={option.id}
            title={option.name}
            subtitle={option.isActive === false ? 'Archivada' : institutionOf(option).name}
            showDivider
            right={<InstitutionBadge institution={institutionOf(option)} size={30} />}
            onPress={() => {
              set('accountId', option.id);
              setSheet(null);
            }}
          />
        ))}
      </OptionSheet>

      <OptionSheet visible={sheet === 'category'} title="Filtrar por categoría" onClose={() => setSheet(null)}>
        <ListRow title="Todas las categorías" icon="square.grid.2x2.fill" onPress={() => { set('categoryId', null); setSheet(null); }} />
        {categories.map((category) => (
          <ListRow
            key={category.id}
            title={category.name}
            subtitle={`${category.kind === 'income' ? 'Ingreso' : 'Gasto'}${category.archivedAt ? ' · archivada' : ''}`}
            showDivider
            right={<CategoryIcon category={category} size={30} />}
            onPress={() => {
              set('categoryId', category.id);
              setSheet(null);
            }}
          />
        ))}
      </OptionSheet>

      <OptionSheet visible={sheet === 'more'} title="Más filtros" onClose={() => setSheet(null)}>
        <View style={{ gap: spacing.lg, paddingBottom: spacing.sm }}>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="overline" color="textSecondary">
              Fechas
            </AppText>
            <View style={styles.wrap}>
              <FilterChip label="Este mes" onPress={() => quickRange(monthBounds(today.slice(0, 7)).from, today)} />
              <FilterChip label="Mes anterior" onPress={() => quickRange(monthBounds(shiftMonth(today.slice(0, 7), -1)).from, monthBounds(shiftMonth(today.slice(0, 7), -1)).to)} />
              <FilterChip label="Últimos 3 meses" onPress={() => quickRange(addDays(today, -89), today)} />
              <FilterChip label="Este año" onPress={() => quickRange(`${today.slice(0, 4)}-01-01`, today)} />
              <FilterChip label="Todo" onPress={() => quickRange('2000-01-01', today)} />
            </View>
            <FinancialCard padding={spacing.md} tone="muted" style={styles.fields}>
              <SelectField
                label="Fecha inicial"
                placeholder="Sin límite"
                value={filters.from ? formatShortDate(filters.from) + ` ${filters.from.slice(0, 4)}` : undefined}
                onPress={() => {
                  setCalendar(parseISO(filters.from ?? today));
                  setSheet('from');
                }}
              />
              <SelectField
                label="Fecha final"
                placeholder="Hasta hoy"
                value={filters.to ? formatShortDate(filters.to) + ` ${filters.to.slice(0, 4)}` : undefined}
                onPress={() => {
                  setCalendar(parseISO(filters.to ?? today));
                  setSheet('to');
                }}
                showDivider
              />
            </FinancialCard>
          </View>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="overline" color="textSecondary">
              Valor
            </AppText>
            <MoneyInput label="Valor mínimo" value={filters.min ?? 0} onChange={(value) => set('min', value > 0 ? value : null)} />
            <MoneyInput label="Valor máximo" value={filters.max ?? 0} onChange={(value) => set('max', value > 0 ? value : null)} />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <AppText variant="subhead">Incluir anulados</AppText>
              <AppText variant="caption" color="textSecondary">
                Se ven tachados y no suman en los totales.
              </AppText>
            </View>
            <Switch
              value={filters.includeVoided}
              onValueChange={(value) => set('includeVoided', value)}
              trackColor={{ true: colors.primary, false: colors.surfaceMuted }}
              accessibilityLabel="Incluir movimientos anulados"
            />
          </View>
          <PrimaryButton label="Ver resultados" onPress={() => setSheet(null)} />
        </View>
      </OptionSheet>

      <OptionSheet visible={sheet === 'from' || sheet === 'to'} title={sheet === 'to' ? 'Fecha final' : 'Fecha inicial'} onClose={() => setSheet('more')}>
        <View style={styles.monthNav}>
          <IconButton
            icon="chevron.left"
            variant="plain"
            accessibilityLabel="Mes anterior"
            onPress={() => setCalendar((current) => (current.month === 1 ? { ...current, year: current.year - 1, month: 12 } : { ...current, month: current.month - 1 }))}
          />
          <AppText variant="headline" align="center" style={styles.flex}>
            {formatMonthYear(calendar.year, calendar.month)}
          </AppText>
          <IconButton
            icon="chevron.right"
            variant="plain"
            accessibilityLabel="Mes siguiente"
            onPress={() => setCalendar((current) => (current.month === 12 ? { ...current, year: current.year + 1, month: 1 } : { ...current, month: current.month + 1 }))}
          />
        </View>
        <CalendarGrid
          year={calendar.year}
          month={calendar.month}
          selected={sheet === 'to' ? filters.to : filters.from}
          today={today}
          maxDate={today}
          onSelect={(date) => {
            set(sheet === 'to' ? 'to' : 'from', date);
            setSheet('more');
          }}
        />
      </OptionSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, minHeight: 44, borderWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 16, paddingVertical: 10 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  totals: { flexDirection: 'row' },
  total: { flex: 1, minWidth: 0, gap: 2 },
  totalRight: { borderLeftWidth: StyleSheet.hairlineWidth, paddingLeft: 16 },
  bleed: { marginHorizontal: -screenPadding },
  chips: { gap: 8, paddingHorizontal: screenPadding },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fields: { paddingVertical: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  dayCard: { paddingVertical: 4 },
});
