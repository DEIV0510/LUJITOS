/**
 * Inicio con los datos REALES del usuario (Supabase). Mientras no haya cuentas,
 * muestra un estado vacío con la acción principal: agregar la primera cuenta.
 * Análisis, presupuesto y asesor se activan con datos reales en sus fases.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AccountCard } from '@/components/finance/AccountCard';
import { BalanceCard } from '@/components/finance/BalanceCard';
import { MetricCard } from '@/components/finance/MetricCard';
import { TransactionItem } from '@/components/finance/TransactionItem';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { totalsOf } from '@/features/data/summaries';
import { MONTHS, capitalize, nowInBogota, parseISO, toISO } from '@/lib/dates';
import { useAppTheme } from '@/theme';

import { HomeHeader } from './HomeSections';

const enter = (order: number) => FadeInDown.delay(80 + order * 70).duration(420);

export function LiveHome() {
  const { colors, spacing } = useAppTheme();
  const { status, error, activeAccounts: active, transactions, summary, reload, setMode } = useFinanceData();

  const today = nowInBogota().date;
  const { year, month, day } = parseISO(today);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const previousStart = toISO(previousYear, previousMonth, 1);
  const previousEnd = toISO(previousYear, previousMonth, day);
  // Mes actual: cifras del servidor. Mismo tramo del mes anterior: para comparar.
  const current = { income: summary?.monthIncome ?? 0, expense: summary?.monthExpense ?? 0 };
  const previous = totalsOf(transactions.filter((t) => t.date >= previousStart && t.date <= previousEnd));
  const recent = transactions.slice(0, 5);

  return (
    <Screen inTabs withFab>
      <Animated.View entering={enter(0)}>
        <HomeHeader />
      </Animated.View>

      {status === 'loading' || status === 'idle' ? (
        <FinancialCard padding={spacing.xl}>
          <LoadingState rows={3} label="Cargando tus cuentas" />
        </FinancialCard>
      ) : status === 'error' ? (
        <FinancialCard>
          <EmptyState
            icon="wifi"
            title="No pudimos cargar tus datos"
            message={error ?? 'Revisa tu conexión.'}
            actionLabel="Reintentar"
            onAction={() => void reload()}
          />
        </FinancialCard>
      ) : active.length === 0 ? (
        <Animated.View entering={enter(1)} style={{ gap: spacing.lg }}>
          <FinancialCard padding={spacing.xl}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
              <Icon name="creditcard.fill" size={24} color={colors.primary} />
            </View>
            <AppText variant="title" style={{ marginTop: spacing.lg }}>
              Agrega tu primera cuenta
            </AppText>
            <AppText variant="callout" color="textSecondary" style={{ marginTop: spacing.xs }}>
              Registra tu banco, billetera digital o efectivo con el saldo que tienes hoy. Desde ahí, LUJITOS calcula tu
              patrimonio y tus movimientos.
            </AppText>
            <PrimaryButton
              label="Agregar cuenta"
              icon="plus"
              size="large"
              style={{ marginTop: spacing.xl }}
              onPress={() => router.push('/account/new')}
            />
          </FinancialCard>
          <AppText variant="footnote" color="textTertiary">
            No necesitas conectar tu banco ni dar datos bancarios. Las conexiones con entidades compatibles serán opcionales.
          </AppText>
          <SecondaryButton label="Ver cómo se ve con datos de ejemplo" icon="sparkles" onPress={() => setMode('demo')} />
        </Animated.View>
      ) : (
        <>
          <Animated.View entering={enter(1)}>
            {summary ? (
              <BalanceCard
                netWorth={summary.netWorth}
                available={summary.available}
                investments={summary.invested}
                debts={summary.cardDebt}
                breakdown={{ banks: summary.banks, wallets: summary.wallets, cash: summary.cash }}
              />
            ) : null}
          </Animated.View>

          <Animated.View entering={enter(2)}>
            <SectionHeader title="Resumen del mes" subtitle={`${capitalize(MONTHS[month - 1] ?? '')} ${year}`} />
            <View style={[styles.row, { gap: spacing.md }]}>
              <MetricCard
                kind="income"
                amount={current.income}
                previous={previous.income}
                comparisonLabel={`en el mismo tramo del mes anterior`}
                onPress={() => router.navigate('/transactions')}
              />
              <MetricCard
                kind="expense"
                amount={current.expense}
                previous={previous.expense}
                comparisonLabel={`en el mismo tramo del mes anterior`}
                onPress={() => router.navigate('/transactions')}
              />
            </View>
          </Animated.View>

          <Animated.View entering={enter(3)}>
            <SectionHeader title="Mis cuentas" actionLabel="Ver todas" onAction={() => router.navigate('/accounts')} />
            <View style={{ gap: spacing.md }}>
              {[active.slice(0, 2), active.slice(2, 4)]
                .filter((row) => row.length > 0)
                .map((row, index) => (
                  <View key={index} style={[styles.row, { gap: spacing.md }]}>
                    {row.map((account) => (
                      <AccountCard key={account.id} account={account} variant="compact" />
                    ))}
                    {row.length === 1 ? <View style={styles.flex} /> : null}
                  </View>
                ))}
            </View>
          </Animated.View>

          <View>
            <SectionHeader
              title="Últimos movimientos"
              actionLabel={recent.length ? 'Ver todos' : undefined}
              onAction={() => router.navigate('/transactions')}
            />
            {recent.length === 0 ? (
              <FinancialCard>
                <EmptyState
                  icon="plus.circle"
                  title="Aún no hay movimientos"
                  message="Registra un ingreso, un gasto, una transferencia o un ajuste con el botón «+»."
                  actionLabel="Registrar movimiento"
                  onAction={() => router.push('/transaction/new')}
                />
              </FinancialCard>
            ) : (
              <FinancialCard padding={16} style={styles.list}>
                {recent.map((transaction, index) => (
                  <TransactionItem key={transaction.id} transaction={transaction} meta="date" showDivider={index > 0} />
                ))}
              </FinancialCard>
            )}
          </View>

          <FinancialCard tone="muted" padding={spacing.lg}>
            <AppText variant="subhead">Próximamente con tus datos</AppText>
            <AppText variant="footnote" color="textSecondary" style={{ marginTop: spacing.xs }}>
              Estadísticas, presupuestos, metas y el asesor se activan con tus datos reales en las próximas fases.
            </AppText>
            <AppText variant="subhead" color="primary" style={{ marginTop: spacing.md }} onPress={() => setMode('demo')}>
              Ver la demostración
            </AppText>
          </FinancialCard>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  flex: { flex: 1 },
  list: { paddingVertical: 4 },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
