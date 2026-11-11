import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/finance/AmountText';
import { CategoryIcon } from '@/components/finance/Badges';
import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { InfoRow, ListRow } from '@/components/ui/Rows';
import { EmptyState } from '@/components/ui/States';
import { TRANSACTION_TYPE_LABEL } from '@/constants/transactions';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { formatWeekdayDate, parseISO } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/theme';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useAppTheme();
  const { transactions, getAccount, getCategory, deleteTransaction, mode } = useFinanceData();
  const transaction = transactions.find((item) => item.id === id);

  if (!transaction) {
    return (
      <Screen header={<ScreenHeader title="Movimiento" />}>
        <EmptyState icon="magnifyingglass" title="Movimiento no encontrado" message="Puede que se haya eliminado." />
      </Screen>
    );
  }

  const isTransfer = transaction.type === 'transfer';
  const isAdjustment = transaction.type === 'adjustment';
  const category = getCategory(isTransfer ? 'transfer' : isAdjustment ? 'adjustment' : transaction.categoryId);
  const account = getAccount(transaction.accountId);
  const target = getAccount(transaction.toAccountId);
  const signed =
    transaction.type === 'expense'
      ? -transaction.amount
      : isAdjustment
        ? transaction.amount * (transaction.adjustmentSign ?? 1)
        : transaction.amount;
  const paysCard = isTransfer && target?.kind === 'credit_card';

  const confirmDelete = () => {
    if (mode === 'demo') {
      Alert.alert('Modo demostración', 'Los movimientos de ejemplo no se pueden eliminar.');
      return;
    }
    Alert.alert(
      '¿Eliminar este movimiento?',
      'Dejará de contar en tus saldos. El registro se conserva internamente para mantener la integridad de tu historial.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction(transaction.id);
              haptics.success();
              router.back();
            } catch (error) {
              haptics.error();
              Alert.alert('No se pudo eliminar', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
            }
          },
        },
      ],
    );
  };

  return (
    <Screen header={<ScreenHeader title={TRANSACTION_TYPE_LABEL[transaction.type]} />}>
      <View style={[styles.hero, { gap: spacing.sm }]}>
        <CategoryIcon category={category} size={64} />
        <AppText variant="title" align="center" style={{ marginTop: spacing.sm }}>
          {transaction.description || category.name}
        </AppText>
        <AmountText
          amount={signed}
          variant="amountXL"
          sign={isTransfer ? 'never' : 'always'}
          color={transaction.type === 'income' ? 'positive' : 'text'}
          align="center"
          fit
        />
        <AppText variant="callout" color="textSecondary" align="center">
          {formatWeekdayDate(transaction.date)} de {parseISO(transaction.date).year}
        </AppText>
      </View>

      <FinancialCard padding={spacing.lg} style={styles.info}>
        <InfoRow label="Tipo" value={TRANSACTION_TYPE_LABEL[transaction.type]} showDivider={false} />
        {isTransfer ? (
          <>
            <InfoRow label="Desde" value={account?.name ?? '—'} />
            <InfoRow label="Hacia" value={target?.name ?? '—'} />
          </>
        ) : (
          <>
            <InfoRow label="Cuenta" value={account?.name ?? '—'} />
            {isAdjustment ? null : <InfoRow label="Categoría" value={category.name} />}
          </>
        )}
        {transaction.counterparty ? (
          <InfoRow label={transaction.type === 'income' ? 'Pagador' : 'Comercio o persona'} value={transaction.counterparty} />
        ) : null}
        {transaction.tags?.length ? <InfoRow label="Etiquetas" value={transaction.tags.map((tag) => `#${tag}`).join('  ')} /> : null}
        <InfoRow label="Notas" value={transaction.notes ?? 'Sin notas'} />
      </FinancialCard>

      {isTransfer ? (
        <View style={styles.note}>
          <Icon name="info.circle" size={15} color={colors.textSecondary} />
          <AppText variant="footnote" color="textSecondary" style={styles.flex}>
            {paysCard
              ? 'El pago de la tarjeta no se cuenta como gasto: las compras hechas con ella ya se registraron como gastos.'
              : 'Las transferencias entre tus cuentas no cuentan como ingreso ni como gasto.'}
          </AppText>
        </View>
      ) : null}

      <FinancialCard padding={spacing.lg} style={styles.info}>
        <ListRow title="Eliminar movimiento" icon="trash" destructive onPress={confirmDelete} />
      </FinancialCard>
      <AppText variant="footnote" color="textTertiary">
        Editar movimientos llega en la Fase 5.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 8 },
  info: { paddingVertical: 4 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 4 },
  flex: { flex: 1 },
});
