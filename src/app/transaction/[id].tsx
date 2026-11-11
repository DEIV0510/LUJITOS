import { router, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/finance/AmountText';
import { CategoryIcon } from '@/components/finance/Badges';
import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { SecondaryButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { InfoRow, ListRow } from '@/components/ui/Rows';
import { EmptyState } from '@/components/ui/States';
import { getCategory, TRANSFER_CATEGORY } from '@/constants/categories';
import { getAccount, getTransaction } from '@/features/demo/selectors';
import { formatWeekdayDate, parseISO } from '@/lib/dates';
import { useAppTheme } from '@/theme';

const TYPE_LABEL = { income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia' } as const;

export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useAppTheme();
  const transaction = getTransaction(id);

  if (!transaction) {
    return (
      <Screen header={<ScreenHeader title="Movimiento" />}>
        <EmptyState icon="magnifyingglass" title="Movimiento no encontrado" message="Puede que se haya eliminado." />
      </Screen>
    );
  }

  const isTransfer = transaction.type === 'transfer';
  const category = isTransfer ? TRANSFER_CATEGORY : getCategory(transaction.categoryId);
  const account = getAccount(transaction.accountId);
  const target = getAccount(transaction.toAccountId);
  const signed = transaction.type === 'expense' ? -transaction.amount : transaction.amount;
  const paysCard = isTransfer && target?.kind === 'credit_card';

  return (
    <Screen header={<ScreenHeader title={TYPE_LABEL[transaction.type]} />}>
      <View style={[styles.hero, { gap: spacing.sm }]}>
        <CategoryIcon category={category} size={64} />
        <AppText variant="title" align="center" style={{ marginTop: spacing.sm }}>
          {transaction.description}
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
        <InfoRow label="Tipo" value={TYPE_LABEL[transaction.type]} showDivider={false} />
        {isTransfer ? (
          <>
            <InfoRow label="Desde" value={account?.name ?? '—'} />
            <InfoRow label="Hacia" value={target?.name ?? '—'} />
          </>
        ) : (
          <>
            <InfoRow label="Cuenta" value={account?.name ?? '—'} />
            <InfoRow label="Categoría" value={category.name} />
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

      <View style={{ gap: spacing.md }}>
        <SecondaryButton
          label="Editar movimiento"
          icon="pencil"
          onPress={() => Alert.alert('Editar movimiento', 'La edición se activa en la Fase 5, cuando los movimientos se guarden en la base de datos.')}
        />
        <FinancialCard padding={spacing.lg} style={styles.danger}>
          <ListRow
            title="Eliminar movimiento"
            icon="trash"
            destructive
            onPress={() =>
              Alert.alert('¿Eliminar este movimiento?', 'Prototipo: en esta fase no se elimina nada. Con datos reales, esta acción pedirá confirmación y no se podrá deshacer.', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Entendido', onPress: () => router.back() },
              ])
            }
          />
        </FinancialCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 8 },
  info: { paddingVertical: 4 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 4 },
  flex: { flex: 1 },
  danger: { paddingVertical: 4 },
});
