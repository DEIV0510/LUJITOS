import { Alert, StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/finance/AmountText';
import { CategoryIcon } from '@/components/finance/Badges';
import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { SecondaryButton } from '@/components/ui/Buttons';
import { DemoNotice } from '@/components/ui/DemoNotice';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { getCategory } from '@/constants/categories';
import { DEMO_RECURRING } from '@/features/demo/data';
import { getAccount } from '@/features/demo/selectors';
import { formatShortDate } from '@/lib/dates';
import { useAppTheme } from '@/theme';
import { LiveGate } from '@/features/data/ComingSoon';
import type { RecurringPayment } from '@/types/finance';

const GROUPS: { title: string; filter: (item: RecurringPayment) => boolean }[] = [
  { title: 'Ingresos', filter: (item) => item.type === 'income' },
  { title: 'Gastos fijos', filter: (item) => item.type === 'expense' && item.categoryId !== 'subscriptions' },
  { title: 'Suscripciones', filter: (item) => item.categoryId === 'subscriptions' },
];

function RecurringScreen() {
  const { colors, spacing } = useAppTheme();
  const expenses = DEMO_RECURRING.filter((item) => item.type === 'expense').reduce((acc, item) => acc + item.amount, 0);
  const income = DEMO_RECURRING.filter((item) => item.type === 'income').reduce((acc, item) => acc + item.amount, 0);

  return (
    <Screen header={<ScreenHeader title="Pagos recurrentes" />}>
      <FinancialCard padding={spacing.xl}>
        <AppText variant="overline" color="textSecondary">
          Compromisos fijos al mes
        </AppText>
        <AmountText amount={expenses} variant="amountXL" fit style={{ marginTop: spacing.xs }} />
        <AppText variant="callout" color="textSecondary">
          Ingresos fijos: <AmountText amount={income} variant="callout" color="positive" /> · quedan libres{' '}
          <AmountText amount={income - expenses} variant="callout" color="text" />
        </AppText>
      </FinancialCard>

      {GROUPS.map((group) => {
        const items = DEMO_RECURRING.filter(group.filter);
        if (items.length === 0) return null;
        return (
          <View key={group.title}>
            <SectionHeader title={group.title} />
            <FinancialCard padding={spacing.lg} style={styles.list}>
              {items.map((item, index) => (
                <View key={item.id} style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                  <CategoryIcon category={getCategory(item.categoryId)} size={40} />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {item.name}
                    </AppText>
                    <AppText variant="footnote" color="textSecondary" numberOfLines={1}>
                      {item.frequency} · día {item.dayOfMonth} · {getAccount(item.accountId)?.name}
                    </AppText>
                    <AppText variant="caption" color="textTertiary">
                      Próximo: {formatShortDate(item.nextDate)}
                      {item.variable ? ' · valor aproximado' : ''}
                    </AppText>
                  </View>
                  <AmountText
                    amount={item.type === 'income' ? item.amount : -item.amount}
                    sign="always"
                    variant="amount"
                    color={item.type === 'income' ? 'positive' : 'text'}
                  />
                </View>
              ))}
            </FinancialCard>
          </View>
        );
      })}

      <DemoNotice />
      <SecondaryButton
        label="Agregar pago recurrente"
        icon="plus"
        onPress={() => Alert.alert('Pago recurrente', 'Crear pagos recurrentes con recordatorio se activa en la Fase 7.')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  flex: { flex: 1, minWidth: 0, gap: 1 },
});

export default function RecurringRoute() {
  return (
    <LiveGate
      title="Pagos recurrentes"
      phase="Fase 7"
      description="Suscripciones, servicios y obligaciones que se repiten cada mes."
      icon="repeat"
      layout="stack"
      demo={<RecurringScreen />}
    />
  );
}
