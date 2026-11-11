import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/finance/AmountText';
import { ProgressBar } from '@/components/finance/Progress';
import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { DemoNotice } from '@/components/ui/DemoNotice';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { Icon } from '@/components/ui/Icon';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DEMO_DEBTS } from '@/features/demo/data';
import { formatShortDate } from '@/lib/dates';
import { formatPercent } from '@/lib/money';
import { useAppTheme } from '@/theme';
import { LiveGate } from '@/features/data/ComingSoon';
import type { Debt, IconName } from '@/types/finance';

const KIND: Record<Debt['kind'], { label: string; icon: IconName }> = {
  credit_card: { label: 'Tarjeta de crédito', icon: 'creditcard.fill' },
  loan: { label: 'Préstamo', icon: 'building.columns.fill' },
  installments: { label: 'Compra a cuotas', icon: 'calendar' },
  personal: { label: 'Deuda personal', icon: 'person.2.fill' },
};

type Strategy = 'avalanche' | 'snowball';

const STRATEGY_TEXT: Record<Strategy, string> = {
  avalanche: 'Pagas el mínimo en todas y el dinero extra va a la deuda con la tasa más alta. Es la opción que menos intereses te cobra.',
  snowball: 'Pagas el mínimo en todas y el dinero extra va a la deuda más pequeña. Cierras deudas antes y ganas impulso.',
};

function DebtsScreen() {
  const { colors, spacing } = useAppTheme();
  const [strategy, setStrategy] = useState<Strategy>('avalanche');
  const total = DEMO_DEBTS.reduce((acc, debt) => acc + debt.balance, 0);
  const monthly = DEMO_DEBTS.reduce((acc, debt) => acc + debt.monthlyPayment, 0);
  const order = [...DEMO_DEBTS].sort((a, b) =>
    strategy === 'avalanche' ? b.annualRate - a.annualRate : a.balance - b.balance,
  );

  return (
    <Screen header={<ScreenHeader title="Deudas" />}>
      <FinancialCard padding={spacing.xl}>
        <AppText variant="overline" color="textSecondary">
          Deuda total
        </AppText>
        <AmountText amount={total} variant="amountXL" fit style={{ marginTop: spacing.xs }} />
        <View style={[styles.row, { marginTop: spacing.md }]}>
          <View style={styles.flex}>
            <AppText variant="caption" color="textSecondary">
              Cuotas del mes
            </AppText>
            <AmountText amount={monthly} variant="amountS" />
          </View>
          <View style={styles.flex}>
            <AppText variant="caption" color="textSecondary">
              Deudas activas
            </AppText>
            <AppText variant="amountS">{DEMO_DEBTS.length}</AppText>
          </View>
        </View>
      </FinancialCard>

      <View style={{ gap: spacing.md }}>
        <SectionHeader title="Tus deudas" />
        {DEMO_DEBTS.map((debt) => {
          const paid = debt.original > 0 ? (debt.original - debt.balance) / debt.original : 0;
          return (
            <FinancialCard key={debt.id} padding={spacing.lg}>
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: colors.negativeSoft }]}>
                  <Icon name={KIND[debt.kind].icon} size={16} color={colors.negative} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="headline" numberOfLines={1}>
                    {debt.name}
                  </AppText>
                  <AppText variant="footnote" color="textSecondary" numberOfLines={1}>
                    {KIND[debt.kind].label} · {debt.lender}
                  </AppText>
                </View>
                <AmountText amount={debt.balance} variant="amount" />
              </View>
              {debt.original > debt.balance ? (
                <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
                  <ProgressBar ratio={paid} color={colors.positiveGraphic} height={6} />
                  <AppText variant="caption" color="textSecondary">
                    Pagado {formatPercent(paid * 100, { digits: 0 })} de <AmountText amount={debt.original} variant="caption" color="textSecondary" />
                  </AppText>
                </View>
              ) : null}
              <View style={[styles.facts, { borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.md }]}>
                <Fact label="Tasa" value={debt.annualRate > 0 ? `${formatPercent(debt.annualRate)} E.A.` : 'Sin interés'} />
                <Fact label="Cuota" amount={debt.monthlyPayment} />
                <Fact label="Próximo pago" value={formatShortDate(debt.nextDue)} />
              </View>
            </FinancialCard>
          );
        })}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeader title="Estrategia de pago" subtitle="Simulador completo en la Fase 7" />
        <SegmentedControl
          options={[
            { value: 'avalanche', label: 'Avalancha' },
            { value: 'snowball', label: 'Bola de nieve' },
          ]}
          value={strategy}
          onChange={setStrategy}
          accessibilityLabel="Estrategia de pago"
        />
        <FinancialCard padding={spacing.lg}>
          <AppText variant="callout" color="textSecondary">
            {STRATEGY_TEXT[strategy]}
          </AppText>
          <View style={{ marginTop: spacing.md }}>
            {order.map((debt, index) => (
              <View key={debt.id} style={[styles.orderRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <View style={[styles.step, { backgroundColor: index === 0 ? colors.primary : colors.surfaceMuted }]}>
                  <AppText variant="label" color={index === 0 ? 'onPrimary' : 'textSecondary'}>
                    {index + 1}
                  </AppText>
                </View>
                <AppText variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                  {debt.name}
                </AppText>
                <AppText variant="footnote" color="textSecondary">
                  {strategy === 'avalanche' ? `${formatPercent(debt.annualRate)} E.A.` : ''}
                </AppText>
                {strategy === 'snowball' ? <AmountText amount={debt.balance} variant="footnote" color="textSecondary" /> : null}
              </View>
            ))}
          </View>
        </FinancialCard>
      </View>

      <DemoNotice />
    </Screen>
  );
}

function Fact({ label, value, amount }: { label: string; value?: string; amount?: number }) {
  return (
    <View style={styles.fact}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      {amount !== undefined ? <AmountText amount={amount} variant="amountS" /> : <AppText variant="amountS">{value}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  facts: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  fact: { flex: 1, gap: 2 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  step: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});

export default function DebtsRoute() {
  return (
    <LiveGate
      title="Deudas"
      phase="Fase 7"
      description="Préstamos, créditos y compras a cuotas, con simulador de avalancha y bola de nieve."
      icon="banknote.fill"
      layout="stack"
      demo={<DebtsScreen />}
    />
  );
}
