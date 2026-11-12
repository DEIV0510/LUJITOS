import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { ACCOUNT_KIND_LABEL } from '@/constants/institutions';
import { cardDebt, cardMetrics, institutionOf, isCreditCard } from '@/features/accounts/display';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { formatShortDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { resolveTone, useAppTheme, type ThemeColors } from '@/theme';
import type { Account } from '@/types/finance';

import { AmountText } from './AmountText';
import { InstitutionBadge } from './Badges';

type Props = { account: Account; variant?: 'compact' | 'full' };

type Status = { label: string; color: keyof ThemeColors };

/** Indicador de estado de una cuenta (archivada, saldo negativo, cupo alto…). */
export function accountStatus(account: Account): Status {
  if (account.isActive === false) return { label: 'Archivada', color: 'textTertiary' };
  if (isCreditCard(account)) {
    const metrics = cardMetrics(account);
    if (metrics && metrics.utilization >= 0.9) return { label: 'Cupo casi agotado', color: 'negative' };
    if (metrics && metrics.utilization >= 0.7) return { label: 'Cupo alto', color: 'warning' };
    return { label: cardDebt(account) === 0 ? 'Sin deuda' : 'Al día', color: 'positive' };
  }
  if (account.balance < 0) return { label: 'Saldo negativo', color: 'negative' };
  if (account.stats && account.stats.transactionCount === 0) return { label: 'Sin movimientos', color: 'textTertiary' };
  return { label: 'Activa', color: 'positive' };
}

/** Tarjeta de cuenta. 'compact' para el Inicio, 'full' para Mis cuentas. */
export function AccountCard({ account, variant = 'full' }: Props) {
  const { colors, spacing, scheme } = useAppTheme();
  const { hidden } = usePrivacy();
  const institution = institutionOf(account);
  const tone = resolveTone(institution.tone, scheme);
  const isCard = isCreditCard(account);
  const open = () => router.push({ pathname: '/account/[id]', params: { id: account.id } });
  const kindLabel = `${ACCOUNT_KIND_LABEL[account.kind]}${account.lastFour ? ` · •••• ${account.lastFour}` : ''}`;
  const shown = isCard ? cardDebt(account) : account.balance;

  if (variant === 'compact') {
    return (
      <FinancialCard onPress={open} accessibilityLabel={`${account.name}, ver detalle`} style={styles.compact} padding={spacing.md + 2}>
        <View style={styles.compactTop}>
          <InstitutionBadge institution={institution} size={36} />
          <View style={[styles.dot, { backgroundColor: tone.base }]} />
        </View>
        <AppText variant="subhead" color="textSecondary" numberOfLines={1} style={{ marginTop: spacing.md }}>
          {isCard ? `${account.name} · deuda` : account.name}
        </AppText>
        <AmountText amount={shown} variant="amountM" fit style={{ marginTop: 2 }} />
      </FinancialCard>
    );
  }

  const status = accountStatus(account);
  const updated = account.stats?.lastActivityAt ?? account.updatedAt ?? null;
  const metrics = isCard ? cardMetrics(account) : null;
  return (
    <FinancialCard onPress={open} accessibilityLabel={`${account.name}, ${institution.name}, ${kindLabel}, ver detalle`} padding={spacing.lg}>
      <View style={styles.row}>
        <InstitutionBadge institution={institution} size={44} />
        <View style={styles.texts}>
          <AppText variant="headline" numberOfLines={2}>
            {account.name}
          </AppText>
          <AppText variant="footnote" color="textSecondary" numberOfLines={2}>
            {institution.name} · {kindLabel}
          </AppText>
        </View>
        <View style={styles.amount}>
          <AmountText amount={shown} variant="amount" color={!isCard && account.balance < 0 ? 'negative' : 'text'} align="right" />
          <AppText variant="caption" color="textTertiary" align="right">
            {isCard ? 'Deuda' : 'Saldo'}
          </AppText>
        </View>
      </View>
      <View style={[styles.footer, { borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.md }]}>
        <View style={styles.footerItem}>
          <View style={[styles.statusDot, { backgroundColor: colors[status.color] }]} />
          <AppText variant="footnote" color="textSecondary" numberOfLines={1} style={styles.flex}>
            {status.label}
            {metrics ? ` · disponible ${formatMoney(metrics.available, { hidden })}` : ''}
          </AppText>
        </View>
        {updated ? (
          <View style={styles.footerItem}>
            <Icon name="clock.fill" size={12} color={colors.textTertiary} />
            <AppText variant="caption" color="textTertiary" numberOfLines={1}>
              Actualizada el {formatShortDate(updated.slice(0, 10))}
            </AppText>
          </View>
        ) : null}
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
  amount: { flexShrink: 0, maxWidth: '45%', alignItems: 'flex-end' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, gap: 6 },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  flex: { flex: 1 },
});
