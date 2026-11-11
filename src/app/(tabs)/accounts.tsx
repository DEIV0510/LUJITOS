import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AccountCard } from '@/components/finance/AccountCard';
import { AmountText } from '@/components/finance/AmountText';
import { TabHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { IconButton, SecondaryButton } from '@/components/ui/Buttons';
import { DemoNotice } from '@/components/ui/DemoNotice';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { ListRow } from '@/components/ui/Rows';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ACCOUNT_GROUP_LABEL } from '@/constants/institutions';
import { getAccountGroups, getAccounts, getBalanceOverview } from '@/features/demo/selectors';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { formatMoney } from '@/lib/money';
import { useAppTheme } from '@/theme';

export default function AccountsScreen() {
  const { spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const overview = getBalanceOverview();
  const groups = getAccountGroups();
  const count = getAccounts().length;

  return (
    <Screen inTabs withFab>
      <TabHeader
        title="Mis cuentas"
        subtitle={`${count} cuentas · registro manual`}
        right={<IconButton icon="plus" accessibilityLabel="Agregar cuenta" onPress={() => router.push('/account/new')} />}
      />

      <Animated.View entering={FadeInDown.duration(380)} style={{ gap: spacing.md }}>
        <FinancialCard tone="brand" padding={spacing.xl}>
          <AppText variant="overline" color="onBrandSecondary">
            Saldo consolidado
          </AppText>
          <AmountText amount={overview.available} variant="display" color="onBrand" fit style={{ marginTop: spacing.xs }} />
          <AppText variant="footnote" color="onBrandSecondary" style={{ marginTop: spacing.xs }}>
            Bancos, billeteras, efectivo y otras cuentas. Las inversiones y las tarjetas se muestran aparte.
          </AppText>
          <View style={[styles.split, { marginTop: spacing.lg }]}>
            <View style={styles.flex}>
              <AppText variant="caption" color="onBrandSecondary">
                Inversiones
              </AppText>
              <AmountText amount={overview.investments} variant="amountS" color="onBrand" />
            </View>
            <View style={styles.flex}>
              <AppText variant="caption" color="onBrandSecondary">
                Deudas totales
              </AppText>
              <AmountText amount={-overview.debts} variant="amountS" color="onBrand" />
            </View>
          </View>
        </FinancialCard>
        <DemoNotice />
      </Animated.View>

      {groups.map((entry) => (
        <View key={entry.group}>
          <SectionHeader
            title={ACCOUNT_GROUP_LABEL[entry.group]}
            subtitle={`${entry.accounts.length} ${entry.accounts.length === 1 ? 'cuenta' : 'cuentas'} · ${formatMoney(entry.total, { hidden })}`}
          />
          <View style={{ gap: spacing.md }}>
            {entry.accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </View>
        </View>
      ))}

      <FinancialCard padding={spacing.lg} style={styles.links}>
        <ListRow icon="creditcard.fill" tone="gold" title="Tarjetas de crédito" subtitle="Cupo, cortes y pagos" onPress={() => router.push('/cards')} />
        <ListRow icon="banknote.fill" tone="clay" title="Deudas" subtitle="Préstamos, cuotas y estrategias" onPress={() => router.push('/debts')} showDivider />
      </FinancialCard>

      <SecondaryButton label="Agregar cuenta" icon="plus" size="large" onPress={() => router.push('/account/new')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: 'row', gap: 16 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  links: { paddingVertical: 4 },
});
