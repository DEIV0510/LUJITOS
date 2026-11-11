import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { ACCOUNT_KIND_LABEL, METHOD_LABEL } from '@/constants/institutions';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { getInstitution, signedAmountFor } from '@/features/demo/selectors';
import { formatShortDate } from '@/lib/dates';
import { resolveTone, useAppTheme } from '@/theme';
import type { Account } from '@/types/finance';

import { AmountText } from './AmountText';
import { InstitutionBadge } from './Badges';

type Props = { account: Account; variant?: 'compact' | 'full' };

/** Tarjeta de cuenta. 'compact' para el Inicio, 'full' para Mis cuentas. */
export function AccountCard({ account, variant = 'full' }: Props) {
  const { colors, spacing, scheme } = useAppTheme();
  const { transactions } = useFinanceData();
  const institution = getInstitution(account);
  const tone = resolveTone(institution.tone, scheme);
  const open = () => router.push({ pathname: '/account/[id]', params: { id: account.id } });
  const kindLabel = `${ACCOUNT_KIND_LABEL[account.kind]}${account.lastFour ? ` · •••• ${account.lastFour}` : ''}`;

  if (variant === 'compact') {
    return (
      <FinancialCard
        onPress={open}
        accessibilityLabel={`${account.name}, ver detalle`}
        style={styles.compact}
        padding={spacing.md + 2}
      >
        <View style={styles.compactTop}>
          <InstitutionBadge institution={institution} size={36} />
          <View style={[styles.dot, { backgroundColor: tone.base }]} />
        </View>
        <AppText variant="subhead" color="textSecondary" numberOfLines={1} style={{ marginTop: spacing.md }}>
          {institution.name}
        </AppText>
        <AmountText amount={account.balance} variant="amountM" fit style={{ marginTop: 2 }} />
      </FinancialCard>
    );
  }

  const last = transactions.find((t) => t.accountId === account.id || t.toAccountId === account.id);
  return (
    <FinancialCard onPress={open} accessibilityLabel={`${account.name}, ${kindLabel}, ver detalle`} padding={spacing.lg}>
      <View style={styles.row}>
        <InstitutionBadge institution={institution} size={44} />
        <View style={styles.texts}>
          <AppText variant="headline" numberOfLines={2}>
            {account.name}
          </AppText>
          <AppText variant="footnote" color="textSecondary" numberOfLines={2}>
            {kindLabel}
          </AppText>
        </View>
        <AmountText
          amount={account.balance}
          variant="amount"
          color={account.balance < 0 ? 'negative' : 'text'}
          style={styles.balance}
        />
      </View>
      <View style={[styles.footer, { borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.md }]}>
        <View style={styles.footerItem}>
          <Icon name="clock.fill" size={12} color={colors.textTertiary} />
          {last ? (
            <AppText variant="footnote" color="textSecondary" numberOfLines={2} style={styles.flex}>
              {last.description || 'Movimiento'} · {formatShortDate(last.date)} ·{' '}
              <AmountText amount={signedAmountFor(last, account.id)} variant="footnote" sign="always" color="textSecondary" />
            </AppText>
          ) : (
            <AppText variant="footnote" color="textSecondary">
              Sin movimientos recientes
            </AppText>
          )}
        </View>
        <View style={styles.method}>
          <Icon name="hand.tap.fill" size={12} color={colors.textTertiary} />
          <AppText variant="caption" color="textTertiary" numberOfLines={1}>
            {METHOD_LABEL[account.method]}
          </AppText>
        </View>
      </View>
    </FinancialCard>
  );
}

const styles = StyleSheet.create({
  compact: { flex: 1, minWidth: 0 },
  compactTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  balance: { flexShrink: 0, maxWidth: '45%' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, gap: 6 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
});
