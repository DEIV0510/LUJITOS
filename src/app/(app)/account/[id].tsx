import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ChartCard } from '@/components/charts/ChartCard';
import { LineChart } from '@/components/charts/LineChart';
import { AmountText } from '@/components/finance/AmountText';
import { InstitutionBadge } from '@/components/finance/Badges';
import { budgetColor, ProgressBar } from '@/components/finance/Progress';
import { TransactionItem } from '@/components/finance/TransactionItem';
import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { InfoRow, ListRow } from '@/components/ui/Rows';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { ACCOUNT_KIND_LABEL } from '@/constants/institutions';
import { cardDebt, cardMetrics, institutionOf, isCreditCard, nextDayOfMonth } from '@/features/accounts/display';
import { HISTORY_RANGES, type HistoryRange } from '@/features/accounts/history';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { getAccountBalanceSeries } from '@/features/demo/selectors';
import { confirmWarning } from '@/features/finance/confirmations';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { useBalanceHistory } from '@/hooks/accounts/useBalanceHistory';
import { formatLongDate, formatShortDate, nowInBogota } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { formatMoney, formatPercent } from '@/lib/money';
import { errorMessage, isFinanceError } from '@/services/finance/errors';
import { useAppTheme } from '@/theme';

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const { mode, getAccount, transactions: allTransactions, archiveAccount, restoreAccount } = useFinanceData();
  const account = getAccount(id);
  const [range, setRange] = useState<HistoryRange>('month');
  const isDemo = mode === 'demo';
  const history = useBalanceHistory(account?.id, range, `${account?.balance ?? 0}|${account?.stats?.transactionCount ?? 0}`, !isDemo);

  if (!account) {
    return (
      <Screen header={<ScreenHeader title="Cuenta" />}>
        <EmptyState icon="magnifyingglass" title="Cuenta no encontrada" message="Puede que ya no exista." />
      </Screen>
    );
  }

  const institution = institutionOf(account);
  const transactions = allTransactions.filter((t) => t.accountId === account.id || t.toAccountId === account.id);
  const isCard = isCreditCard(account);
  const archived = account.isActive === false;
  const metrics = isCard ? cardMetrics(account) : null;
  const today = nowInBogota().date;
  const stats = account.stats;
  const demoSeries = isDemo ? getAccountBalanceSeries(account.id) : [];
  const chart = isDemo
    ? demoSeries.map((point) => ({ label: point.label, detail: point.label, balance: point.value }))
    : history.points.map((point) => ({ label: point.label, detail: point.detail, balance: isCard ? -point.balance : point.balance }));

  const newMovement = (params: Record<string, string>) => router.push({ pathname: '/transaction/new', params });

  const archive = async (force: boolean) => {
    try {
      await archiveAccount(account.id, force);
      haptics.success();
      router.back();
    } catch (error) {
      if (isFinanceError(error, 'account_has_balance')) {
        if (await confirmWarning(error)) await archive(true);
        return;
      }
      haptics.error();
      Alert.alert('No se pudo archivar', errorMessage(error));
    }
  };

  const confirmArchive = () => {
    if (isDemo) {
      Alert.alert('Modo demostración', 'Las cuentas de ejemplo no se pueden archivar.');
      return;
    }
    if (account.balance !== 0) {
      const amount = isCard ? `una deuda de ${formatMoney(cardDebt(account))}` : `un saldo de ${formatMoney(account.balance)}`;
      Alert.alert(
        'La cuenta tiene saldo',
        `Tiene ${amount}. Al archivarla deja de sumar en tus totales, aunque su historial se conserva. Si ya no la usas, primero transfiere o ajusta el saldo a cero.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Archivar igual', style: 'destructive', onPress: () => void archive(true) },
        ],
      );
      return;
    }
    Alert.alert('¿Archivar esta cuenta?', 'Deja de aparecer y no podrás registrar movimientos nuevos en ella. Su historial se conserva.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Archivar', style: 'destructive', onPress: () => void archive(false) },
    ]);
  };

  const restore = async () => {
    try {
      await restoreAccount(account.id);
      haptics.success();
    } catch (error) {
      Alert.alert('No se pudo reactivar', errorMessage(error));
    }
  };

  return (
    <Screen header={<ScreenHeader title={institution.name} />}>
      <View style={[styles.hero, { gap: spacing.xs }]}>
        <InstitutionBadge institution={institution} size={60} />
        <AppText variant="title" align="center" style={{ marginTop: spacing.sm }}>
          {account.name}
        </AppText>
        <AppText variant="callout" color="textSecondary" align="center">
          {institution.name} · {ACCOUNT_KIND_LABEL[account.kind]}
          {account.lastFour ? ` · •••• ${account.lastFour}` : ''}
          {archived ? ' · Archivada' : ''}
        </AppText>
        <AmountText
          amount={isCard ? cardDebt(account) : account.balance}
          variant="amountXL"
          color={!isCard && account.balance < 0 ? 'negative' : 'text'}
          align="center"
          fit
          style={{ marginTop: spacing.sm }}
        />
        <AppText variant="footnote" color="textTertiary" align="center">
          {isCard ? 'Deuda actual' : 'Saldo actual'}
        </AppText>
        {account.description ? (
          <AppText variant="footnote" color="textSecondary" align="center" style={{ marginTop: spacing.xs }}>
            {account.description}
          </AppText>
        ) : null}
      </View>

      {archived ? (
        <PrimaryButton label="Reactivar cuenta" icon="arrow.uturn.backward" onPress={() => void restore()} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={[styles.actions, { gap: spacing.md }]}>
            {isCard ? (
              <>
                <PrimaryButton label="Compra" icon="cart.fill" style={styles.flex} onPress={() => newMovement({ type: 'expense', accountId: account.id })} />
                <SecondaryButton label="Pagar" icon="arrow.down.circle.fill" style={styles.flex} onPress={() => newMovement({ type: 'transfer', toAccountId: account.id })} />
              </>
            ) : (
              <>
                <PrimaryButton label="Gasto" icon="minus" style={styles.flex} onPress={() => newMovement({ type: 'expense', accountId: account.id })} />
                <SecondaryButton label="Ingreso" icon="plus" style={styles.flex} onPress={() => newMovement({ type: 'income', accountId: account.id })} />
              </>
            )}
          </View>
          <View style={[styles.actions, { gap: spacing.md }]}>
            <SecondaryButton
              label="Transferir"
              icon="arrow.left.arrow.right"
              style={styles.flex}
              onPress={() => newMovement({ type: 'transfer', accountId: account.id })}
            />
            <SecondaryButton label="Ajustar saldo" icon="slider.horizontal.3" style={styles.flex} onPress={() => newMovement({ type: 'adjustment', accountId: account.id })} />
          </View>
        </View>
      )}

      {metrics ? (
        <FinancialCard padding={spacing.lg} style={{ gap: spacing.md }}>
          <View style={styles.between}>
            <AppText variant="headline">Cupo de la tarjeta</AppText>
            <AppText variant="subhead" color="textSecondary">
              {formatPercent(metrics.utilization * 100, { digits: 0 })} usado
            </AppText>
          </View>
          <ProgressBar ratio={Math.min(metrics.utilization, 1)} color={budgetColor(metrics.utilization, colors)} />
          <View>
            <InfoRow label="Cupo total" value={formatMoney(metrics.limit, { hidden })} showDivider={false} />
            <InfoRow label="Cupo utilizado" value={formatMoney(metrics.debt, { hidden })} />
            <InfoRow label="Cupo disponible" value={formatMoney(metrics.available, { hidden })} />
            <InfoRow label="Deuda pendiente" value={formatMoney(metrics.debt, { hidden })} />
            {account.statementDay ? (
              <InfoRow label="Próximo corte" value={`${formatShortDate(nextDayOfMonth(account.statementDay, today))} (día ${account.statementDay})`} />
            ) : null}
            {account.paymentDueDay ? (
              <InfoRow label="Pago límite" value={`${formatShortDate(nextDayOfMonth(account.paymentDueDay, today))} (día ${account.paymentDueDay})`} />
            ) : null}
          </View>
        </FinancialCard>
      ) : null}

      <View>
        <SectionHeader title="Resumen" subtitle="Calculado con todos los movimientos de la cuenta" />
        <FinancialCard padding={spacing.lg} style={styles.info}>
          <InfoRow
            label={isCard ? 'Deuda inicial' : 'Saldo inicial'}
            value={formatMoney(isCard ? -account.initialBalance : account.initialBalance, { hidden })}
            showDivider={false}
          />
          <InfoRow label={isCard ? 'Deuda actual' : 'Saldo actual'} value={formatMoney(isCard ? cardDebt(account) : account.balance, { hidden })} />
          {stats ? (
            <>
              <InfoRow label={isCard ? 'Abonos e ingresos' : 'Total de ingresos'} value={formatMoney(stats.totalIncome, { hidden })} />
              <InfoRow label={isCard ? 'Compras y cargos' : 'Total de gastos'} value={formatMoney(stats.totalExpense, { hidden })} />
              <InfoRow label={isCard ? 'Pagos recibidos' : 'Transferencias recibidas'} value={formatMoney(stats.transfersIn, { hidden })} />
              <InfoRow label="Transferencias enviadas" value={formatMoney(stats.transfersOut, { hidden })} />
              {stats.adjustmentsNet !== 0 ? (
                <InfoRow label="Ajustes" value={formatMoney(stats.adjustmentsNet, { hidden, sign: 'always' })} />
              ) : null}
              <InfoRow label="Movimientos" value={String(stats.transactionCount)} />
            </>
          ) : (
            <InfoRow label="Movimientos" value={String(transactions.length)} />
          )}
          <InfoRow label="Creada" value={formatLongDate(account.createdAt)} />
        </FinancialCard>
      </View>

      <ChartCard
        title={isCard ? 'Evolución de la deuda' : 'Evolución del saldo'}
        subtitle={isDemo ? 'Últimas semanas · demostración' : 'Saldo al cierre de cada día'}
        control={isDemo ? undefined : <SegmentedControl options={HISTORY_RANGES} value={range} onChange={setRange} accessibilityLabel="Periodo del gráfico" />}
      >
        {history.loading ? (
          <LoadingState rows={2} label="Cargando el gráfico" />
        ) : history.error ? (
          <AppText variant="footnote" color="textSecondary">
            {history.error}
          </AppText>
        ) : chart.length > 1 ? (
          <LineChart
            labels={chart.map((point) => point.label)}
            details={chart.map((point) => point.detail)}
            currentCaption={isCard ? 'Deuda de hoy' : 'Saldo de hoy'}
            series={[{ key: 'balance', label: isCard ? 'Deuda' : 'Saldo', color: colors.primary, values: chart.map((point) => point.balance), area: true }]}
          />
        ) : (
          <AppText variant="footnote" color="textSecondary">
            Todavía no hay suficiente historia para dibujar el gráfico.
          </AppText>
        )}
      </ChartCard>

      <View>
        <SectionHeader
          title="Movimientos"
          subtitle={`${transactions.length} ${transactions.length === 1 ? 'movimiento' : 'movimientos'}`}
          actionLabel={transactions.length > 15 ? 'Ver todos' : undefined}
          onAction={() => router.push({ pathname: '/transactions', params: { accountId: account.id } })}
        />
        {transactions.length === 0 ? (
          <FinancialCard>
            <EmptyState icon="tray" title="Sin movimientos" message={archived ? 'Esta cuenta está archivada.' : 'Registra el primero con los botones de arriba.'} />
          </FinancialCard>
        ) : (
          <FinancialCard padding={16} style={styles.list}>
            {transactions.slice(0, 15).map((transaction, index) => (
              <TransactionItem key={transaction.id} transaction={transaction} meta="date" showDivider={index > 0} />
            ))}
          </FinancialCard>
        )}
      </View>

      <FinancialCard padding={spacing.lg} style={styles.list}>
        <ListRow title="Editar cuenta" subtitle="Nombre, entidad, color, ícono y más" icon="pencil" onPress={() => router.push({ pathname: '/account/edit', params: { id: account.id } })} />
        {archived ? null : (
          <ListRow title="Archivar cuenta" subtitle="Deja de aparecer, sin borrar su historial" icon="archivebox" onPress={confirmArchive} showDivider />
        )}
      </FinancialCard>
      <AppText variant="footnote" color="textTertiary">
        Las cuentas no se eliminan: se archivan para conservar tu historial.
        {stats?.lastActivityAt ? ` Último movimiento registrado el ${formatShortDate(stats.lastActivityAt.slice(0, 10))}.` : ''}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 4 },
  actions: { flexDirection: 'row' },
  flex: { flex: 1 },
  info: { paddingVertical: 4 },
  list: { paddingVertical: 4 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
