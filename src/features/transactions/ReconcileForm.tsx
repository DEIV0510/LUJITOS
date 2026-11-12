/**
 * Ajuste de saldo: cuando el saldo de LUJITOS no coincide con el real.
 * Se escribe el saldo (o la deuda) real, se ve la diferencia con el calculado,
 * se escribe el motivo y, al confirmar, se registra UN movimiento de ajuste.
 * El historial nunca se modifica en silencio.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AmountText } from '@/components/finance/AmountText';
import { InstitutionBadge } from '@/components/finance/Badges';
import { MoneyInput } from '@/components/finance/MoneyInput';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { DemoNotice } from '@/components/ui/DemoNotice';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { FilterChip, SelectField, TextField } from '@/components/ui/FormField';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { InfoRow, ListRow } from '@/components/ui/Rows';
import { SuccessView } from '@/components/ui/SuccessView';
import { cardDebt, institutionOf, isLiability } from '@/features/accounts/display';
import { FormMessage } from '@/features/auth/components';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { haptics } from '@/lib/haptics';
import { newRequestId } from '@/lib/ids';
import { formatMoney, type Money } from '@/lib/money';
import { errorMessage, isFinanceError } from '@/services/finance/errors';
import { screenPadding, useAppTheme } from '@/theme';

import { accountBalanceLabel, EmptyIcon } from './parts';
import { reconcileDifference } from './validation';

const REASONS = ['Intereses o rendimientos', 'Cuota de manejo o comisión', 'Movimiento que no registré', 'Corrección'];

export function ReconcileForm({ initialAccountId, bottomInset }: { initialAccountId?: string; bottomInset: number }) {
  const { colors, spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const { mode, activeAccounts, getAccount, reconcileAccount, reload } = useFinanceData();
  const isDemo = mode === 'demo';
  const [requestId] = useState(newRequestId);
  const [accountId, setAccountId] = useState<string | null>(initialAccountId ?? activeAccounts[0]?.id ?? null);
  const [observed, setObserved] = useState<Money>(0);
  const [negative, setNegative] = useState(false);
  const [touched, setTouched] = useState(false);
  const [reason, setReason] = useState('');
  const [sheet, setSheet] = useState(false);
  const [errors, setErrors] = useState<{ account?: string; reason?: string; amount?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState<Money | null>(null);

  const account = getAccount(accountId ?? undefined);
  const isCard = account ? isLiability(account) : false;
  // En tarjetas se escribe la deuda real; el saldo es su negativo.
  const observedBalance: Money = isCard ? -observed : negative ? -observed : observed;
  const difference = account ? reconcileDifference(observedBalance, account.balance) : 0;

  const submit = () => {
    const found = {
      account: account ? undefined : 'Elige la cuenta.',
      amount: touched ? undefined : isCard ? 'Escribe la deuda real.' : 'Escribe el saldo real de la cuenta.',
      reason: reason.trim().length === 0 ? 'Escribe el motivo del ajuste.' : undefined,
    };
    setErrors(found);
    setSubmitError(null);
    if (Object.values(found).some(Boolean) || !account) {
      haptics.error();
      return;
    }
    if (difference === 0) {
      setSubmitError('El saldo real coincide con el de LUJITOS: no hace falta ajustar.');
      return;
    }
    if (isDemo) {
      setSaved(difference);
      return;
    }
    const effect = isCard
      ? difference > 0
        ? `la deuda baja ${formatMoney(difference)}`
        : `la deuda sube ${formatMoney(-difference)}`
      : `el saldo ${difference > 0 ? 'sube' : 'baja'} ${formatMoney(Math.abs(difference))}`;
    Alert.alert(
      '¿Registrar el ajuste?',
      `En «${account.name}» ${effect}. Quedará un movimiento de ajuste con tu motivo; el historial no se modifica.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Registrar ajuste',
          onPress: async () => {
            setSubmitting(true);
            try {
              const result = await reconcileAccount(
                { accountId: account.id, observedBalance, expectedBalance: account.balance, reason },
                requestId,
              );
              haptics.success();
              setSaved(result.difference);
            } catch (error) {
              haptics.error();
              if (isFinanceError(error, 'stale_balance')) {
                await reload();
                setSubmitError('El saldo cambió mientras ajustabas (por ejemplo, otro movimiento). Revisa la diferencia y vuelve a confirmar.');
              } else {
                setSubmitError(errorMessage(error, 'No pudimos registrar el ajuste.'));
              }
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  if (saved !== null) {
    return (
      <SuccessView
        title={isDemo ? 'Ajuste validado' : 'Saldo ajustado'}
        message={isDemo ? 'Modo demostración: no se guardó nada.' : `Se registró un ajuste de ${formatMoney(saved, { sign: 'always' })}.`}
      />
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ paddingHorizontal: screenPadding, paddingTop: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl }}
      >
        <AppText variant="callout" color="textSecondary">
          Úsalo cuando el saldo de LUJITOS no coincida con el real (por ejemplo, por intereses o una cuota de manejo). Se compara
          con el saldo calculado y la diferencia queda registrada como ajuste.
        </AppText>

        <FinancialCard padding={spacing.lg} style={styles.fields}>
          <SelectField
            label="Cuenta"
            placeholder="Elegir cuenta"
            value={account?.name}
            leading={account ? <InstitutionBadge institution={institutionOf(account)} size={34} /> : <EmptyIcon icon="creditcard" />}
            onPress={() => setSheet(true)}
            error={errors.account}
          />
          {account ? (
            <InfoRow
              label={isCard ? 'Deuda según LUJITOS' : 'Saldo según LUJITOS'}
              value={formatMoney(isCard ? cardDebt(account) : account.balance, { hidden })}
            />
          ) : null}
        </FinancialCard>

        <View style={{ gap: spacing.sm }}>
          <MoneyInput
            label={isCard ? 'Deuda real hoy' : 'Saldo real hoy'}
            value={observed}
            onChange={(value) => {
              setObserved(value);
              setTouched(true);
              if (errors.amount) setErrors((current) => ({ ...current, amount: undefined }));
            }}
            error={errors.amount}
          />
          {isCard ? null : (
            <View style={styles.switchRow}>
              <AppText variant="subhead" style={styles.flex}>
                El saldo real es negativo (sobregiro)
              </AppText>
              <Switch
                value={negative}
                onValueChange={(value) => {
                  setNegative(value);
                  setTouched(true);
                }}
                trackColor={{ true: colors.primary, false: colors.surfaceMuted }}
                accessibilityLabel="El saldo real es negativo"
              />
            </View>
          )}
        </View>

        {account && touched ? (
          <FinancialCard tone="muted" padding={spacing.lg} style={{ gap: spacing.xs }}>
            <AppText variant="overline" color="textSecondary">
              Diferencia
            </AppText>
            {difference === 0 ? (
              <AppText variant="headline">Coincide: no hace falta ajustar</AppText>
            ) : (
              <>
                <AmountText amount={difference} sign="always" variant="amountL" color={difference > 0 ? 'positive' : 'negative'} />
                <AppText variant="footnote" color="textSecondary">
                  {isCard
                    ? difference > 0
                      ? 'La deuda en LUJITOS bajará a la deuda real.'
                      : 'La deuda en LUJITOS subirá a la deuda real.'
                    : difference > 0
                      ? 'El saldo en LUJITOS subirá al saldo real.'
                      : 'El saldo en LUJITOS bajará al saldo real.'}
                </AppText>
              </>
            )}
          </FinancialCard>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <View style={styles.chips}>
            {REASONS.map((option) => (
              <FilterChip key={option} label={option} selected={reason === option} onPress={() => setReason(option)} />
            ))}
          </View>
          <FinancialCard padding={spacing.lg} style={styles.fields}>
            <TextField
              label="Motivo del ajuste"
              placeholder="Ej.: Cuota de manejo de noviembre"
              value={reason}
              onChangeText={(text) => {
                setReason(text);
                if (errors.reason) setErrors((current) => ({ ...current, reason: undefined }));
              }}
              maxLength={200}
              error={errors.reason}
            />
          </FinancialCard>
        </View>

        <FormMessage message={submitError} />
        {isDemo ? <DemoNotice text="Modo demostración: el ajuste se valida pero no se guarda." /> : null}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(bottomInset, spacing.lg), borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <PrimaryButton label="Registrar ajuste" size="large" loading={submitting} onPress={submit} />
      </View>

      <OptionSheet visible={sheet} title="Cuenta a ajustar" onClose={() => setSheet(false)}>
        {activeAccounts.length === 0 ? (
          <SecondaryButton label="Agregar una cuenta" icon="plus" onPress={() => { setSheet(false); router.push('/account/new'); }} />
        ) : (
          activeAccounts.map((option, index) => (
            <ListRow
              key={option.id}
              title={option.name}
              subtitle={accountBalanceLabel(option, hidden)}
              showDivider={index > 0}
              right={<InstitutionBadge institution={institutionOf(option)} size={30} />}
              onPress={() => {
                setAccountId(option.id);
                setSheet(false);
              }}
            />
          ))
        )}
      </OptionSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  fields: { paddingVertical: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footer: { paddingHorizontal: screenPadding, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
