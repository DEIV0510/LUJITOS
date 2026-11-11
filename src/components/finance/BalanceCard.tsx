import { StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand/LogoMark';
import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { formatMoney, formatPercent, percentChange, type Money } from '@/lib/money';
import { palette, useAppTheme } from '@/theme';

import { AmountText } from './AmountText';

type Props = {
  netWorth: Money;
  /** Sin histórico todavía (datos reales nuevos): se oculta la variación. */
  netWorthChange?: Money;
  previousNetWorth?: Money;
  available: Money;
  investments: Money;
  debts: Money;
};

/**
 * Tarjeta principal: patrimonio neto (lo que tienes menos lo que debes) separado
 * del dinero disponible (lo que puedes usar hoy).
 */
export function BalanceCard({ netWorth, netWorthChange, previousNetWorth, available, investments, debts }: Props) {
  const { colors, spacing } = useAppTheme();
  const { hidden, toggle } = usePrivacy();
  const change = previousNetWorth === undefined ? null : percentChange(netWorth, previousNetWorth);
  const up = (netWorthChange ?? 0) >= 0;
  const changeColor = up ? palette.sage : '#F2A7A7';

  return (
    <FinancialCard tone="brand" padding={spacing.xl} style={styles.card}>
      <View style={styles.watermark} pointerEvents="none">
        <LogoMark size={210} color={colors.brandLine} coinColor="transparent" />
      </View>

      <View style={styles.top}>
        <AppText variant="overline" color="onBrandSecondary">
          Patrimonio neto
        </AppText>
        <IconButton
          icon={hidden ? 'eye.slash.fill' : 'eye.fill'}
          variant="onBrand"
          size={36}
          accessibilityLabel={hidden ? 'Mostrar valores' : 'Ocultar valores'}
          onPress={toggle}
        />
      </View>

      <AmountText amount={netWorth} variant="display" color="onBrand" fit style={{ marginTop: spacing.xs }} />

      {netWorthChange === undefined ? null : (
      <View style={[styles.change, { marginTop: spacing.sm }]}>
        <Icon name={up ? 'arrow.up.right' : 'arrow.down.right'} size={13} color={changeColor} weight="bold" />
        <AppText variant="subhead" style={{ color: changeColor, flexShrink: 1 }} numberOfLines={2}>
          {hidden ? '••••' : formatMoney(netWorthChange, { sign: 'always' })}
          {change !== null && !hidden ? ` (${formatPercent(change, { sign: true })})` : ''} este mes
        </AppText>
      </View>
      )}

      <View style={[styles.divider, { backgroundColor: colors.brandLine, marginVertical: spacing.lg }]} />

      <View style={{ gap: spacing.sm }}>
        <View style={styles.line}>
          <View style={styles.lineLabel}>
            <Icon name="banknote.fill" size={14} color={palette.sage} />
            <AppText variant="callout" color="onBrand">
              Dinero disponible
            </AppText>
          </View>
          <AmountText amount={available} variant="amount" color="onBrand" />
        </View>
        <View style={styles.line}>
          <AppText variant="footnote" color="onBrandSecondary" style={styles.indent}>
            Inversiones
          </AppText>
          <AmountText amount={investments} variant="amountS" color="onBrandSecondary" />
        </View>
        <View style={styles.line}>
          <AppText variant="footnote" color="onBrandSecondary" style={styles.indent}>
            Deudas
          </AppText>
          <AmountText amount={-debts} variant="amountS" color="onBrandSecondary" />
        </View>
      </View>
    </FinancialCard>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  watermark: { position: 'absolute', right: -64, bottom: -70, opacity: 0.45 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { height: StyleSheet.hairlineWidth },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  lineLabel: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  indent: { paddingLeft: 22 },
});
