/**
 * Pagar una deuda: cuota (con la parte de intereses, si la sabes), abono extra
 * o registrar un interés. El pago es una transferencia desde tu cuenta: no es
 * un gasto ni cambia tu patrimonio. El interés sí es un gasto.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { InstitutionBadge } from '@/components/finance/Badges';
import { MoneyInput } from '@/components/finance/MoneyInput';
import { AppText } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { SelectField, TextField } from '@/components/ui/FormField';
import { InfoRow } from '@/components/ui/Rows';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SuccessView } from '@/components/ui/SuccessView';
import { institutionOf } from '@/features/accounts/display';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { runWithConfirmations } from '@/features/finance/confirmations';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { haptics } from '@/lib/haptics';
import { newRequestId } from '@/lib/ids';
import { nowInBogota } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { errorMessage } from '@/services/finance/errors';
import { useAppTheme } from '@/theme';
import type { DebtPaymentKind, DebtRecord } from '@/types/planning';

import { PAYMENT_KIND_LABEL } from './labels';
import { AccountSheet, DateSheet, FormShell, Note, dateLabel } from './ui';
import { validateInterestPortion, validatePaymentAmount } from './validation';

const KINDS: { value: DebtPaymentKind; label: string }[] = [
  { value: 'installment', label: 'Cuota' },
  { value: 'extra', label: 'Abono' },
  { value: 'interest', label: 'Interés' },
];

type Sheet = 'account' | 'date' | null;

export function DebtPaymentForm({ debt, initialKind = 'installment' }: { debt: DebtRecord; initialKind?: DebtPaymentKind }) {
  const { spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const today = nowInBogota().date;
  const { activeAccounts, getAccount, registerDebtPayment } = useFinanceData();
  const [requestId, setRequestId] = useState(newRequestId);
  const [kind, setKindState] = useState<DebtPaymentKind>(initialKind);
  const [amount, setAmount] = useState(initialKind === 'installment' ? (debt.installment ?? 0) : 0);
  const [interest, setInterest] = useState(0);
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [accountId, setAccountId] = useState<string | null>(debt.paymentAccountId ?? activeAccounts[0]?.id ?? null);
  const [errors, setErrors] = useState<{ amount?: string; interest?: string; account?: string }>({});
  const [sheet, setSheet] = useState<Sheet>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const account = accountId ? getAccount(accountId) : undefined;
  const setKind = (next: DebtPaymentKind) => {
    setKindState(next);
    setErrors({});
    // Cada tipo es una operación distinta: nueva clave de idempotencia.
    setRequestId(newRequestId());
    if (next === 'installment' && amount === 0 && debt.installment) setAmount(debt.installment);
  };
  const capital = kind === 'installment' ? amount - interest : amount;
  const after = kind === 'interest' ? debt.outstanding + amount : debt.outstanding - capital;

  const save = async () => {
    const found = {
      amount: validatePaymentAmount(amount),
      interest: kind === 'installment' ? validateInterestPortion(interest, amount) : undefined,
      account: kind !== 'interest' && !accountId ? 'Elige la cuenta con la que pagas.' : undefined,
    };
    setErrors(found);
    setSubmitError(null);
    if (found.amount || found.interest || found.account) {
      haptics.error();
      return;
    }
    setSubmitting(true);
    try {
      const done = await runWithConfirmations((options) =>
        registerDebtPayment(
          { debtId: debt.id, kind, amount, accountId, interestPortion: interest, date, notes },
          requestId,
          options,
        ),
      );
      if (done === null) {
        setSubmitting(false);
        return;
      }
    } catch (error) {
      haptics.error();
      setSubmitError(errorMessage(error, 'No pudimos registrar el pago.'));
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    haptics.success();
    setSaved(true);
  };

  if (saved) {
    return (
      <SuccessView
        title={kind === 'interest' ? 'Interés registrado' : 'Pago registrado'}
        message={kind === 'interest' ? 'La deuda aumentó en ese valor.' : `Se descontó de ${account?.name ?? 'tu cuenta'}.`}
      />
    );
  }

  return (
    <FormShell
      title={debt.name}
      submitLabel={kind === 'interest' ? 'Registrar interés' : `Registrar ${PAYMENT_KIND_LABEL[kind].toLowerCase()}`}
      submitting={submitting}
      onSubmit={save}
      error={submitError}
    >
      <SegmentedControl options={KINDS} value={kind} onChange={setKind} accessibilityLabel="Tipo de pago" />

      <MoneyInput
        variant="hero"
        label={kind === 'interest' ? 'Valor del interés' : kind === 'installment' ? 'Valor de la cuota' : 'Valor del abono'}
        value={amount}
        onChange={(value) => {
          setAmount(value);
          if (errors.amount) setErrors((c) => ({ ...c, amount: undefined }));
        }}
        autoFocus={kind !== 'installment' || !debt.installment}
        error={errors.amount}
        tint={kind === 'interest' ? 'negative' : 'text'}
      />

      {kind === 'installment' ? (
        <View style={{ gap: spacing.sm }}>
          <MoneyInput
            label="De esta cuota, intereses (opcional)"
            value={interest}
            onChange={(value) => {
              setInterest(value);
              if (errors.interest) setErrors((c) => ({ ...c, interest: undefined }));
            }}
            error={errors.interest}
          />
          <AppText variant="footnote" color="textSecondary">
            Si tu extracto separa capital e intereses, escribe los intereses: así la deuda baja solo por el capital.
          </AppText>
        </View>
      ) : null}

      <FinancialCard padding={spacing.lg} style={styles.fields}>
        {kind === 'interest' ? null : (
          <SelectField
            label="Pagas desde"
            placeholder="Elegir cuenta"
            value={account?.name}
            leading={account ? <InstitutionBadge institution={institutionOf(account)} size={34} /> : undefined}
            onPress={() => setSheet('account')}
            error={errors.account}
          />
        )}
        <SelectField
          label="Fecha"
          placeholder="Elegir fecha"
          value={dateLabel(date, today)}
          onPress={() => setSheet('date')}
          showDivider={kind !== 'interest'}
        />
        <TextField label="Nota (opcional)" placeholder="Ej.: Cuota 12 de 48" value={notes} onChangeText={setNotes} maxLength={500} showDivider />
      </FinancialCard>

      <FinancialCard padding={spacing.lg} style={styles.fields}>
        <InfoRow label="Debes hoy" value={formatMoney(debt.outstanding, { hidden })} showDivider={false} />
        {amount > 0 ? (
          <InfoRow
            label={after < 0 ? 'Saldo a favor después' : 'Deberás después'}
            value={formatMoney(Math.abs(after), { hidden })}
            valueColor={after < 0 ? 'positive' : 'text'}
          />
        ) : null}
      </FinancialCard>

      <Note>
        {kind === 'interest'
          ? 'El interés aumenta lo que debes y cuenta como gasto en «Intereses y comisiones».'
          : 'El pago sale de tu cuenta y reduce la deuda: es una transferencia, no un gasto nuevo. Tu patrimonio no cambia.'}
      </Note>

      <AccountSheet
        visible={sheet === 'account'}
        title="Pagas desde"
        accounts={activeAccounts}
        value={accountId}
        onClose={() => setSheet(null)}
        onSelect={(id) => {
          setAccountId(id);
          if (errors.account) setErrors((c) => ({ ...c, account: undefined }));
          setSheet(null);
        }}
      />
      <DateSheet
        visible={sheet === 'date'}
        title="Fecha del pago"
        value={date}
        today={today}
        maxDate={today}
        onClose={() => setSheet(null)}
        onSelect={(value) => {
          setDate(value);
          setSheet(null);
        }}
      />
    </FormShell>
  );
}

const styles = StyleSheet.create({
  fields: { paddingVertical: 4 },
});
