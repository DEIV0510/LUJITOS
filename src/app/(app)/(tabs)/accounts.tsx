import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AccountCard } from '@/components/finance/AccountCard';
import { AmountText } from '@/components/finance/AmountText';
import { TabHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { IconButton, SecondaryButton } from '@/components/ui/Buttons';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { ListRow } from '@/components/ui/Rows';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { ACCOUNT_GROUP_LABEL } from '@/constants/institutions';
import { DemoModeBanner } from '@/features/data/DemoModeBanner';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { groupAccounts } from '@/features/data/summaries';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { formatMoney, type Money } from '@/lib/money';
import { useAppTheme } from '@/theme';

/** Mis cuentas: totales calculados en el servidor y una tarjeta por cuenta. */
export default function AccountsScreen() {
  const { spacing } = useAppTheme();
  const { hidden, toggle } = usePrivacy();
  const { mode, accounts, activeAccounts, summary, status, error, reload } = useFinanceData();
  const [showArchived, setShowArchived] = useState(false);
  const archived = accounts.filter((account) => account.isActive === false);
  const groups = groupAccounts(activeAccounts);
  const count = activeAccounts.length;

  const header = (
    <TabHeader
      title="Mis cuentas"
      subtitle={count === 0 ? 'Registro manual' : `${count} ${count === 1 ? 'cuenta activa' : 'cuentas activas'}`}
      right={
        <View style={styles.headerActions}>
          <IconButton icon={hidden ? 'eye.slash.fill' : 'eye.fill'} variant="plain" accessibilityLabel={hidden ? 'Mostrar saldos' : 'Ocultar saldos'} onPress={toggle} />
          <IconButton icon="plus" accessibilityLabel="Agregar cuenta" onPress={() => router.push('/account/new')} />
        </View>
      }
    />
  );

  if (mode === 'live' && (status === 'loading' || status === 'idle')) {
    return (
      <Screen inTabs withFab>
        {header}
        <FinancialCard padding={spacing.xl}>
          <LoadingState rows={3} label="Cargando tus cuentas" />
        </FinancialCard>
      </Screen>
    );
  }
  if (mode === 'live' && status === 'error') {
    return (
      <Screen inTabs withFab>
        {header}
        <FinancialCard>
          <EmptyState icon="wifi" title="No pudimos cargar tus cuentas" message={error ?? 'Revisa tu conexión.'} actionLabel="Reintentar" onAction={() => void reload()} />
        </FinancialCard>
      </Screen>
    );
  }

  return (
    <Screen inTabs withFab>
      {header}
      {count === 0 ? (
        <FinancialCard>
          <EmptyState
            icon="creditcard.fill"
            title="Todavía no tienes cuentas"
            message="Agrega tu banco, billetera digital, efectivo, tarjeta o inversión con el saldo que tiene hoy."
            actionLabel="Agregar mi primera cuenta"
            onAction={() => router.push('/account/new')}
          />
        </FinancialCard>
      ) : summary ? (
        <Animated.View entering={FadeInDown.duration(380)} style={{ gap: spacing.md }}>
          <FinancialCard tone="brand" padding={spacing.xl}>
            <AppText variant="overline" color="onBrandSecondary">
              Saldo total de cuentas
            </AppText>
            <AmountText amount={summary.available + summary.invested + summary.other} variant="display" color="onBrand" fit style={{ marginTop: spacing.xs }} />
            <AppText variant="footnote" color="onBrandSecondary" style={{ marginTop: spacing.xs }}>
              Lo que tienes en cuentas activas, sin restar deudas. El cupo de las tarjetas no se suma.
            </AppText>
            <View style={[styles.grid, { marginTop: spacing.lg, rowGap: spacing.md }]}>
              <Figure label="Dinero disponible" amount={summary.available} />
              <Figure label="Total en bancos" amount={summary.banks} />
              <Figure label="Billeteras digitales" amount={summary.wallets} />
              <Figure label="Efectivo" amount={summary.cash} />
              <Figure label="Total invertido" amount={summary.invested} />
              <Figure label="Deuda en tarjetas" amount={-summary.cardDebt} />
            </View>
          </FinancialCard>
          <DemoModeBanner />
        </Animated.View>
      ) : null}

      {groups.map((entry) => (
        <View key={entry.group}>
          <SectionHeader
            title={ACCOUNT_GROUP_LABEL[entry.group]}
            subtitle={`${entry.accounts.length} ${entry.accounts.length === 1 ? 'cuenta' : 'cuentas'} · ${formatMoney(entry.group === 'credit' ? -entry.total : entry.total, { hidden })}${entry.group === 'credit' ? ' de deuda' : ''}`}
          />
          <View style={{ gap: spacing.md }}>
            {entry.accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </View>
        </View>
      ))}

      {archived.length > 0 ? (
        <View>
          <SectionHeader
            title="Archivadas"
            subtitle={`${archived.length} · no suman en tus totales`}
            actionLabel={showArchived ? 'Ocultar' : 'Ver'}
            onAction={() => setShowArchived((value) => !value)}
          />
          {showArchived ? (
            <View style={{ gap: spacing.md }}>
              {archived.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {count > 0 ? (
        <>
          <FinancialCard padding={spacing.lg} style={styles.links}>
            <ListRow icon="creditcard.fill" tone="gold" title="Tarjetas de crédito" subtitle="Cupo, deuda, corte y pago" onPress={() => router.push('/cards')} />
            <ListRow icon="square.grid.2x2.fill" tone="sage" title="Categorías" subtitle="Crea, edita y archiva las tuyas" onPress={() => router.push('/categories')} showDivider />
            <ListRow icon="banknote.fill" tone="clay" title="Deudas" subtitle="Préstamos, cuotas y pagos" onPress={() => router.push('/debts')} showDivider />
          </FinancialCard>
          <SecondaryButton label="Agregar cuenta" icon="plus" size="large" onPress={() => router.push('/account/new')} />
        </>
      ) : null}
    </Screen>
  );
}

function Figure({ label, amount }: { label: string; amount: Money }) {
  return (
    <View style={styles.figure}>
      <AppText variant="caption" color="onBrandSecondary" numberOfLines={1}>
        {label}
      </AppText>
      <AmountText amount={amount} variant="amountS" color="onBrand" fit />
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  figure: { width: '50%', paddingRight: 12, gap: 2 },
  links: { paddingVertical: 4 },
});
