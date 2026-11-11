import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand/LogoMark';
import { AmountText } from '@/components/finance/AmountText';
import { ProgressBar } from '@/components/finance/Progress';
import { ScreenHeader } from '@/components/layout/Headers';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/Buttons';
import { DemoNotice } from '@/components/ui/DemoNotice';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { InfoRow } from '@/components/ui/Rows';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { DEMO_CARDS } from '@/features/demo/data';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { formatLongDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { palette, useAppTheme } from '@/theme';

export default function CardsScreen() {
  const { colors, spacing, radius } = useAppTheme();
  const { hidden } = usePrivacy();

  return (
    <Screen header={<ScreenHeader title="Tarjetas de crédito" />}>
      {DEMO_CARDS.map((card) => {
        const available = card.limit - card.used;
        const ratio = card.used / card.limit;
        return (
          <View key={card.id} style={{ gap: spacing.xl }}>
            <View
              accessible
              accessibilityLabel={`${card.name}, terminada en ${card.lastFour}`}
              style={[styles.card, { backgroundColor: palette.forest, borderRadius: radius.xl }]}
            >
              <View style={styles.cardWatermark} pointerEvents="none">
                <LogoMark size={210} color="rgba(244,241,232,0.06)" coinColor="rgba(198,166,106,0.18)" />
              </View>
              <View style={styles.cardTop}>
                <AppText variant="subhead" style={{ color: palette.ivory }}>
                  {card.name}
                </AppText>
                <View style={[styles.chip, { backgroundColor: palette.gold }]} />
              </View>
              <AppText style={styles.number}>•••• •••• •••• {card.lastFour}</AppText>
              <View style={styles.cardBottom}>
                <View>
                  <AppText variant="caption" style={{ color: 'rgba(244,241,232,0.65)' }}>
                    Usado
                  </AppText>
                  <AmountText amount={card.used} variant="amountM" color="onBrand" />
                </View>
                <AppText style={styles.network}>{card.network}</AppText>
              </View>
            </View>

            <FinancialCard padding={spacing.lg}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <AppText variant="caption" color="textSecondary">
                    Cupo disponible
                  </AppText>
                  <AmountText amount={available} variant="amountL" fit />
                </View>
                <View style={styles.right}>
                  <AppText variant="caption" color="textSecondary">
                    Cupo total
                  </AppText>
                  <AmountText amount={card.limit} variant="amountS" />
                </View>
              </View>
              <View style={{ marginTop: spacing.md }}>
                <ProgressBar ratio={ratio} color={ratio > 0.7 ? colors.warningGraphic : colors.primary} height={8} />
              </View>
            </FinancialCard>

            <FinancialCard padding={spacing.lg} style={styles.info}>
              <InfoRow label="Fecha de corte" value={`Día ${card.cutoffDay} de cada mes`} showDivider={false} />
              <InfoRow label="Fecha límite de pago" value={formatLongDate(card.dueDate)} />
              <InfoRow label="Pago mínimo" value={formatMoney(card.minimumPayment, { hidden })} />
              <InfoRow label="Pago total" value={formatMoney(card.used, { hidden })} />
            </FinancialCard>

            <View>
              <SectionHeader title="Compras a cuotas" />
              <FinancialCard padding={spacing.lg} style={styles.info}>
                {card.installments.map((item, index) => (
                  <View key={item.description} style={[styles.installment, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong">{item.description}</AppText>
                      <AppText variant="footnote" color="textSecondary">
                        Cuota {item.current} de {item.total}
                      </AppText>
                      <View style={{ marginTop: 6 }}>
                        <ProgressBar ratio={item.current / item.total} color={colors.accent} height={5} />
                      </View>
                    </View>
                    <AmountText amount={item.amount} variant="amount" />
                  </View>
                ))}
              </FinancialCard>
            </View>

            <PrimaryButton
              label="Registrar pago de la tarjeta"
              icon="arrow.left.arrow.right"
              size="large"
              onPress={() => router.push({ pathname: '/transaction/new', params: { type: 'transfer', toAccountId: card.accountId } })}
            />
            <AppText variant="footnote" color="textSecondary">
              El pago se registra como transferencia hacia la tarjeta: las compras ya se contaron como gasto, así nada se cuenta dos veces.
            </AppText>
          </View>
        );
      })}
      <DemoNotice text="Tarjeta de demostración. Nunca se guarda el número completo de una tarjeta." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { aspectRatio: 1.586, padding: 22, justifyContent: 'space-between', overflow: 'hidden', borderCurve: 'continuous' },
  cardWatermark: { position: 'absolute', right: -40, top: -30 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { width: 38, height: 28, borderRadius: 6, opacity: 0.9 },
  number: { fontFamily: 'Inter_500Medium', fontSize: 19, letterSpacing: 2, color: palette.ivory, fontVariant: ['tabular-nums'] },
  cardBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  network: { fontFamily: 'Inter_600SemiBold', fontSize: 15, letterSpacing: 1, color: 'rgba(244,241,232,0.8)' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end' },
  info: { paddingVertical: 4 },
  installment: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
});
