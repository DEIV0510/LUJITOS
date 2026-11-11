import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { ChartCard } from '@/components/charts/ChartCard';
import { LineChart } from '@/components/charts/LineChart';
import { AmountText } from '@/components/finance/AmountText';
import { InstitutionBadge } from '@/components/finance/Badges';
import { TransactionItem } from '@/components/finance/TransactionItem';
import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { IconButton, PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { InfoRow, ListRow } from '@/components/ui/Rows';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/States';
import { ACCOUNT_KIND_LABEL, METHOD_LABEL } from '@/constants/institutions';
import {
  getAccount,
  getAccountBalanceSeries,
  getInstitution,
  getTransactionsForAccount,
} from '@/features/demo/selectors';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { formatLongDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useAppTheme } from '@/theme';

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const account = getAccount(id);

  if (!account) {
    return (
      <Screen header={<ScreenHeader title="Cuenta" />}>
        <EmptyState icon="magnifyingglass" title="Cuenta no encontrada" message="Puede que se haya archivado o eliminado." />
      </Screen>
    );
  }

  const institution = getInstitution(account);
  const transactions = getTransactionsForAccount(account.id);
  const series = getAccountBalanceSeries(account.id);
  const isCard = account.kind === 'credit_card';
  const prototype = (title: string) =>
    Alert.alert(title, 'Prototipo: esta acción se activa cuando las cuentas se guarden en la base de datos (Fase 4).');

  return (
    <Screen
      header={
        <ScreenHeader
          title={institution.name}
          right={<IconButton icon="pencil" variant="plain" accessibilityLabel="Editar cuenta" onPress={() => prototype('Editar cuenta')} />}
        />
      }
    >
      <View style={[styles.hero, { gap: spacing.xs }]}>
        <InstitutionBadge institution={institution} size={60} />
        <AppText variant="title" align="center" style={{ marginTop: spacing.sm }}>
          {account.name}
        </AppText>
        <AppText variant="callout" color="textSecondary" align="center">
          {ACCOUNT_KIND_LABEL[account.kind]}
          {account.lastFour ? ` · •••• ${account.lastFour}` : ''}
        </AppText>
        <AmountText
          amount={account.balance}
          variant="amountXL"
          color={account.balance < 0 ? 'negative' : 'text'}
          align="center"
          fit
          style={{ marginTop: spacing.sm }}
        />
        <AppText variant="footnote" color="textTertiary" align="center">
          {isCard ? 'Saldo usado de la tarjeta' : 'Saldo actual'}
        </AppText>
      </View>

      <View style={[styles.actions, { gap: spacing.md }]}>
        <PrimaryButton
          label="Registrar"
          icon="plus"
          style={styles.flex}
          onPress={() =>
            router.push({ pathname: '/transaction/new', params: { accountId: account.id, type: 'expense' } })
          }
        />
        <SecondaryButton
          label={isCard ? 'Pagar' : 'Transferir'}
          icon="arrow.left.arrow.right"
          style={styles.flex}
          onPress={() =>
            router.push({
              pathname: '/transaction/new',
              params: isCard ? { type: 'transfer', toAccountId: account.id } : { type: 'transfer', accountId: account.id },
            })
          }
        />
      </View>

      {transactions.length > 0 && series.length > 1 ? (
        <ChartCard title="Evolución del saldo" subtitle="Últimas 4 semanas">
          <LineChart
            labels={series.map((point) => point.label)}
            details={series.map((point) => point.label)}
            currentCaption="Saldo de hoy"
            series={[{ key: 'balance', label: 'Saldo', color: colors.primary, values: series.map((p) => p.value), area: true }]}
          />
        </ChartCard>
      ) : null}

      <FinancialCard padding={spacing.lg} style={styles.info}>
        <InfoRow label="Entidad" value={institution.name} showDivider={false} />
        <InfoRow label="Tipo" value={ACCOUNT_KIND_LABEL[account.kind]} />
        <InfoRow label="Moneda" value="COP · peso colombiano" />
        <InfoRow label="Saldo inicial" value={formatMoney(account.initialBalance, { hidden })} />
        {account.creditLimit ? <InfoRow label="Cupo total" value={formatMoney(account.creditLimit, { hidden })} /> : null}
        <InfoRow label="Creada" value={formatLongDate(account.createdAt)} />
        <InfoRow label="Últimos 4 dígitos" value={account.lastFour ?? 'No registrados'} />
        <InfoRow label="Registro" value={METHOD_LABEL[account.method]} />
      </FinancialCard>

      <View>
        <SectionHeader title="Movimientos" subtitle={`${transactions.length} en octubre y noviembre`} />
        {transactions.length === 0 ? (
          <FinancialCard>
            <EmptyState icon="tray" title="Sin movimientos" message="Esta cuenta no tiene movimientos en el periodo de demostración." />
          </FinancialCard>
        ) : (
          <FinancialCard padding={16} style={styles.list}>
            {transactions.map((transaction, index) => (
              <TransactionItem key={transaction.id} transaction={transaction} meta="date" showDivider={index > 0} />
            ))}
          </FinancialCard>
        )}
      </View>

      <FinancialCard padding={spacing.lg} style={styles.list}>
        <ListRow title="Archivar cuenta" subtitle="Deja de aparecer, sin borrar su historial" icon="archivebox" onPress={() => prototype('Archivar cuenta')} />
        <ListRow
          title="Eliminar cuenta"
          icon="trash"
          destructive
          showDivider
          onPress={() =>
            Alert.alert('¿Eliminar esta cuenta?', 'Con datos reales se borrarán también sus movimientos y no se podrá deshacer. En este prototipo no se elimina nada.', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Entendido', style: 'default' },
            ])
          }
        />
      </FinancialCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 4 },
  actions: { flexDirection: 'row' },
  flex: { flex: 1 },
  info: { paddingVertical: 4 },
  list: { paddingVertical: 4 },
});
