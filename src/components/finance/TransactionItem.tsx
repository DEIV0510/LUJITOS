import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { getCategory, TRANSFER_CATEGORY } from '@/constants/categories';
import { getAccount, getInstitution } from '@/features/demo/selectors';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { formatShortDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useAppTheme } from '@/theme';
import type { Account, Transaction } from '@/types/finance';

import { AmountText } from './AmountText';
import { CategoryIcon } from './Badges';

type Props = {
  transaction: Transaction;
  /** 'date' muestra fecha y cuenta (Inicio) · 'category' muestra categoría y cuenta (listas por día). */
  meta?: 'date' | 'category';
  showDivider?: boolean;
};

const TYPE_LABEL = { income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia' } as const;

/** Nombre corto para las listas: la entidad («Bancolombia») o el nombre propio de la cuenta. */
function shortAccountName(account: Account | undefined): string {
  if (!account) return '';
  if (account.kind === 'credit_card') return account.name;
  const institution = getInstitution(account);
  return account.institutionId === 'custom' || account.institutionId === 'cash' ? account.name : institution.name;
}

/** Fila de movimiento: ícono de categoría, descripción, datos y valor con signo. */
export function TransactionItem({ transaction, meta = 'category', showDivider }: Props) {
  const { colors } = useAppTheme();
  const { hidden } = usePrivacy();
  const isTransfer = transaction.type === 'transfer';
  const category = isTransfer ? TRANSFER_CATEGORY : getCategory(transaction.categoryId);
  const account = getAccount(transaction.accountId);
  const target = getAccount(transaction.toAccountId);

  const accountText = isTransfer
    ? `${shortAccountName(account)} → ${shortAccountName(target)}`
    : shortAccountName(account);
  const metaText =
    meta === 'date'
      ? `${formatShortDate(transaction.date)} · ${accountText}`
      : isTransfer
        ? accountText
        : `${category.name} · ${accountText}`;
  const signed = transaction.type === 'expense' ? -transaction.amount : transaction.amount;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${TYPE_LABEL[transaction.type]}: ${transaction.description}, ${
        hidden ? 'valor oculto' : formatMoney(transaction.amount)
      }, ${metaText}`}
      accessibilityHint="Abre el detalle del movimiento"
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: transaction.id } })}
      style={({ pressed }) => [
        styles.row,
        showDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        pressed && { opacity: 0.6 },
      ]}
    >
      <CategoryIcon category={category} size={42} />
      <View style={styles.texts}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {transaction.description}
        </AppText>
        <AppText variant="footnote" color="textSecondary" numberOfLines={2}>
          {metaText}
        </AppText>
      </View>
      <AmountText
        amount={signed}
        sign={isTransfer ? 'never' : 'always'}
        color={transaction.type === 'income' ? 'positive' : isTransfer ? 'textSecondary' : 'text'}
        style={styles.amount}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10 },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  amount: { flexShrink: 0, maxWidth: '44%' },
});
