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
import { isCreditCard } from '@/features/accounts/display';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { formatShortDate, formatWeekdayDate, parseISO } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { errorMessage } from '@/services/finance/errors';
import { useAppTheme } from '@/theme';

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useAppTheme();
  const { getTransaction, getAccount, getCategory, voidTransaction, mode } = useFinanceData();
  const transaction = getTransaction(id);

  if (!transaction) {
    return (
      <Screen header={<ScreenHeader title="Movimiento" />}>
        <EmptyState icon="magnifyingglass" title="Movimiento no encontrado" message="Puede que ya no exista." />
      </Screen>
    );
  }

  const isTransfer = transaction.type === 'transfer';
  const isAdjustment = transaction.type === 'adjustment';
  const voided = Boolean(transaction.voidedAt);
  const category = getCategory(isTransfer ? 'transfer' : isAdjustment ? 'adjustment' : transaction.categoryId);
  const account = getAccount(transaction.accountId);
  const target = getAccount(transaction.toAccountId);
  const signed =
    transaction.type === 'expense'
      ? -transaction.amount
      : isAdjustment
        ? transaction.amount * (transaction.adjustmentSign ?? 1)
        : transaction.amount;
  const paysCard = isTransfer && target !== undefined && isCreditCard(target);
  const cardPurchase = transaction.type === 'expense' && account !== undefined && isCreditCard(account);

  const doVoid = async (reason?: string) => {
    try {
      await voidTransaction(transaction.id, reason);
      haptics.success();
      router.back();
    } catch (error) {
      haptics.error();
      Alert.alert('No se pudo anular', errorMessage(error, 'Inténtalo de nuevo.'));
    }
  };

  const confirmVoid = () => {
    if (mode === 'demo') {
      Alert.alert('Modo demostración', 'Los movimientos de ejemplo no se pueden anular.');
      return;
    }
    const effect = isTransfer
      ? 'Las dos cuentas vuelven al saldo que tenían sin esta transferencia.'
      : 'Deja de contar en el saldo de la cuenta.';
    // iOS: pide el motivo (opcional) en el mismo cuadro de confirmación.
    Alert.prompt(
      '¿Anular este movimiento?',
      `${effect} El registro se conserva con su motivo. Motivo (opcional):`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Anular', style: 'destructive', onPress: (reason?: string) => void doVoid(reason) },
      ],
      'plain-text',
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
          color={voided ? 'textTertiary' : transaction.type === 'income' ? 'positive' : 'text'}
          align="center"
          fit
          style={voided ? styles.struck : undefined}
        />
        <AppText variant="callout" color="textSecondary" align="center">
          {formatWeekdayDate(transaction.date)} de {parseISO(transaction.date).year}
        </AppText>
      </View>

      {voided ? (
        <FinancialCard tone="muted" padding={spacing.lg} style={{ gap: spacing.xs }}>
          <View style={styles.row}>
            <Icon name="xmark.circle.fill" size={16} color={colors.negative} />
            <AppText variant="headline">Anulado</AppText>
          </View>
          <AppText variant="footnote" color="textSecondary">
            {transaction.voidedAt ? `El ${formatShortDate(transaction.voidedAt.slice(0, 10))}. ` : ''}
            Ya no cuenta en los saldos; se conserva para tu historial.
            {transaction.voidReason ? ` Motivo: ${transaction.voidReason}` : ''}
          </AppText>
        </FinancialCard>
      ) : null}

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
          <InfoRow label={transaction.type === 'income' ? 'Origen' : 'Comercio'} value={transaction.counterparty} />
        ) : null}
        <InfoRow label={isAdjustment ? 'Motivo' : 'Notas'} value={transaction.notes ?? 'Sin notas'} />
        {transaction.createdAt ? <InfoRow label="Registrado" value={formatShortDate(transaction.createdAt.slice(0, 10))} /> : null}
      </FinancialCard>

      {isTransfer || cardPurchase || isAdjustment ? (
        <View style={styles.note}>
          <Icon name="info.circle" size={15} color={colors.textSecondary} />
          <AppText variant="footnote" color="textSecondary" style={styles.flex}>
            {paysCard
              ? 'Pago de tarjeta: redujo la deuda y descontó la cuenta de origen. No se cuenta como gasto: las compras ya se registraron.'
              : isTransfer
                ? 'Las transferencias entre tus cuentas no cuentan como ingreso ni como gasto.'
                : cardPurchase
                  ? 'Compra con tarjeta: aumentó la deuda de la tarjeta.'
                  : 'Ajuste de saldo: corrige la diferencia con el saldo real. No es ingreso ni gasto.'}
          </AppText>
        </View>
      ) : null}

      {voided ? null : (
        <FinancialCard padding={spacing.lg} style={styles.info}>
          {isAdjustment ? null : (
            <ListRow
              title="Editar movimiento"
              icon="pencil"
              onPress={() => router.push({ pathname: '/transaction/edit', params: { id: transaction.id } })}
            />
          )}
          <ListRow title="Anular movimiento" subtitle="Revierte su efecto y conserva el registro" icon="xmark.circle" destructive onPress={confirmVoid} showDivider={!isAdjustment} />
        </FinancialCard>
      )}
      {isAdjustment && !voided ? (
        <AppText variant="footnote" color="textTertiary">
          Un ajuste no se edita: anúlalo y vuelve a ajustar el saldo desde la cuenta.
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 8 },
  info: { paddingVertical: 4 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 4 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  struck: { textDecorationLine: 'line-through' },
});
