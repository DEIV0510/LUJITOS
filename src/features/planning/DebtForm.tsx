/**
 * Crear o editar una deuda (préstamo, crédito, deuda con alguien). Las tarjetas
 * de crédito NO se crean aquí: son las cuentas de la Fase 4.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { InstitutionBadge } from '@/components/finance/Badges';
import { MoneyInput } from '@/components/finance/MoneyInput';
import { AppText } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { SelectField, TextField } from '@/components/ui/FormField';
import { Icon } from '@/components/ui/Icon';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { ToneSwatches } from '@/components/ui/Pickers';
import { InfoRow, ListRow } from '@/components/ui/Rows';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SuccessView } from '@/components/ui/SuccessView';
import { ACCOUNT_TONES } from '@/constants/institutions';
import { institutionOf } from '@/features/accounts/display';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { haptics } from '@/lib/haptics';
import { newRequestId } from '@/lib/ids';
import { nowInBogota } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { errorMessage } from '@/services/finance/errors';
import { isTone } from '@/services/finance/mappers';
import { LOAN_KINDS, PAYMENT_FREQUENCIES } from '@/services/planning/mappers';
import { useAppTheme, type Tone } from '@/theme';
import type { DebtRecord, InterestPeriod, LoanKind, PaymentFrequency } from '@/types/planning';

import { FREQUENCY_LABEL, LOAN_KIND_ICON, LOAN_KIND_LABEL } from './labels';
import { AccountSheet, DateSheet, FormShell, Note, dateLabel } from './ui';
import { parseRate, validateDebtDraft, type DebtDraft, type DebtErrors } from './validation';

const RATE_PERIODS: { value: InterestPeriod; label: string }[] = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'annual', label: 'Anual (E.A.)' },
];

type Sheet = 'kind' | 'frequency' | 'account' | 'start' | 'due' | 'first' | null;

function rateToText(rate: number | null): string {
  return rate === null ? '' : String(rate).replace('.', ',');
}

export function DebtForm({ debt }: { debt?: DebtRecord }) {
  const { colors, spacing } = useAppTheme();
  const today = nowInBogota().date;
  const { activeAccounts, getAccount, transactions, voidedTransactions, createDebt, updateDebt } = useFinanceData();
  const [requestId] = useState(newRequestId);
  // Con movimientos, el saldo inicial ya no cambia (se corrige con «Corregir saldo»).
  const hasMovements =
    debt !== undefined &&
    [...transactions, ...voidedTransactions].some((t) => t.accountId === debt.accountId || t.toAccountId === debt.accountId);
  const [draft, setDraft] = useState<DebtDraft>(() => ({
    name: debt?.name ?? '',
    creditor: debt?.creditor ?? '',
    originalAmount: debt?.originalAmount ?? 0,
    outstanding: debt?.initialOutstanding ?? 0,
    rateText: rateToText(debt?.interestRate ?? null),
    ratePeriod: debt?.interestPeriod ?? 'monthly',
    startDate: debt?.startDate ?? today,
    dueDate: debt?.dueDate ?? null,
    frequency: debt?.frequency ?? 'monthly',
    installment: debt?.installment ?? 0,
    firstPaymentDate: debt?.firstPaymentDate ?? null,
    description: debt?.description ?? '',
  }));
  const [kind, setKind] = useState<LoanKind>(debt?.kind ?? 'bank_loan');
  const [paymentAccountId, setPaymentAccountId] = useState<string | null>(debt?.paymentAccountId ?? null);
  const [tone, setTone] = useState<Tone>(isTone(debt?.color) ? debt.color : 'rose');
  const [errors, setErrors] = useState<DebtErrors>({});
  const [sheet, setSheet] = useState<Sheet>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof DebtDraft>(key: K, value: DebtDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    const errorKey = (key === 'rateText' ? 'rate' : key) as keyof DebtErrors;
    if (errors[errorKey]) setErrors((current) => ({ ...current, [errorKey]: undefined }));
  };
  const paymentAccount = paymentAccountId ? getAccount(paymentAccountId) : undefined;
  const scheduled = draft.frequency !== 'none';

  const save = async () => {
    const found = validateDebtDraft(draft);
    setErrors(found);
    setSubmitError(null);
    if (Object.values(found).some(Boolean)) {
      haptics.error();
      return;
    }
    const rate = parseRate(draft.rateText);
    const input = {
      name: draft.name,
      kind,
      creditor: draft.creditor,
      originalAmount: draft.originalAmount,
      outstanding: draft.outstanding,
      interestRate: rate,
      interestPeriod: rate === null ? null : draft.ratePeriod,
      startDate: draft.startDate,
      dueDate: draft.dueDate,
      installment: scheduled ? draft.installment : draft.installment || null,
      frequency: draft.frequency,
      firstPaymentDate: scheduled ? draft.firstPaymentDate : null,
      paymentAccountId,
      description: draft.description,
      color: tone,
    };
    setSubmitting(true);
    try {
      if (debt) await updateDebt(debt.id, input);
      else await createDebt(input, requestId);
    } catch (error) {
      haptics.error();
      setSubmitError(errorMessage(error, 'No pudimos guardar la deuda.'));
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
        title={debt ? 'Deuda actualizada' : 'Deuda registrada'}
        message={debt ? 'Los cambios ya se ven en Deudas.' : 'Ya cuenta en tus pasivos y en tu patrimonio.'}
      />
    );
  }

  return (
    <FormShell
      title={debt ? 'Editar deuda' : 'Nueva deuda'}
      submitLabel={debt ? 'Guardar cambios' : 'Registrar deuda'}
      submitting={submitting}
      onSubmit={save}
      error={submitError}
    >
      <FinancialCard padding={spacing.lg} style={styles.fields}>
        <TextField
          label="Nombre"
          placeholder="Ej.: Crédito del carro"
          value={draft.name}
          onChangeText={(text) => update('name', text)}
          maxLength={60}
          error={errors.name}
        />
        <SelectField label="Tipo" placeholder="Elegir tipo" value={LOAN_KIND_LABEL[kind]} onPress={() => setSheet('kind')} showDivider />
        <TextField
          label="A quién le debes (opcional)"
          placeholder="Ej.: Banco de Bogotá, mi hermana"
          value={draft.creditor}
          onChangeText={(text) => update('creditor', text)}
          maxLength={60}
          error={errors.creditor}
          showDivider
        />
      </FinancialCard>

      <MoneyInput
        label="Valor que te prestaron"
        value={draft.originalAmount}
        onChange={(value) => update('originalAmount', value)}
        error={errors.originalAmount}
      />
      {hasMovements ? (
        <FinancialCard padding={spacing.lg} style={styles.fields}>
          <InfoRow label="Saldo al registrarla" value={formatMoney(draft.outstanding)} showDivider={false} />
          <AppText variant="footnote" color="textSecondary" style={{ paddingVertical: spacing.sm }}>
            La deuda ya tiene movimientos: este saldo no cambia para no alterar tu historial. Si no coincide con lo que debes,
            usa «Corregir saldo» en la deuda.
          </AppText>
        </FinancialCard>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <MoneyInput
            label="¿Cuánto debes hoy?"
            value={draft.outstanding}
            onChange={(value) => update('outstanding', value)}
            error={errors.outstanding}
          />
          <AppText variant="footnote" color="textSecondary">
            Lo que te falta pagar hoy. Desde aquí, cada pago lo reduce y cada interés registrado lo aumenta.
          </AppText>
        </View>
      )}

      <View style={{ gap: spacing.md }}>
        <AppText variant="overline" color="textSecondary">
          Interés (opcional)
        </AppText>
        <FinancialCard padding={spacing.lg} style={styles.fields}>
          <TextField
            label="Tasa (%)"
            placeholder="Ej.: 1,8 · vacío si no cobra interés"
            value={draft.rateText}
            onChangeText={(text) => update('rateText', text.replace(/[^\d.,]/g, '').slice(0, 9))}
            keyboardType="decimal-pad"
            error={errors.rate}
          />
        </FinancialCard>
        {draft.rateText.trim() ? (
          <SegmentedControl options={RATE_PERIODS} value={draft.ratePeriod} onChange={(value) => update('ratePeriod', value)} accessibilityLabel="Periodo de la tasa" />
        ) : null}
      </View>

      <View style={{ gap: spacing.md }}>
        <AppText variant="overline" color="textSecondary">
          Pagos
        </AppText>
        <FinancialCard padding={spacing.lg} style={styles.fields}>
          <SelectField label="Frecuencia" placeholder="Elegir" value={FREQUENCY_LABEL[draft.frequency]} onPress={() => setSheet('frequency')} />
          {scheduled ? (
            <SelectField
              label="Próximo pago"
              placeholder="Elegir fecha"
              value={draft.firstPaymentDate ? dateLabel(draft.firstPaymentDate, today) : undefined}
              onPress={() => setSheet('first')}
              error={errors.firstPaymentDate}
              showDivider
            />
          ) : null}
          <SelectField
            label="Cuenta con la que pagas (opcional)"
            placeholder="Elegir al pagar"
            value={paymentAccount?.name}
            leading={paymentAccount ? <InstitutionBadge institution={institutionOf(paymentAccount)} size={34} /> : undefined}
            onPress={() => setSheet('account')}
            showDivider
          />
          <SelectField label="Inicio" placeholder="Elegir fecha" value={dateLabel(draft.startDate, today)} onPress={() => setSheet('start')} showDivider />
          <SelectField
            label="Fecha límite (opcional)"
            placeholder="Sin fecha límite"
            value={draft.dueDate ? dateLabel(draft.dueDate, today) : undefined}
            onPress={() => setSheet('due')}
            error={errors.dueDate}
            showDivider
          />
        </FinancialCard>
        {scheduled ? (
          <MoneyInput label="Valor de la cuota" value={draft.installment} onChange={(value) => update('installment', value)} error={errors.installment} />
        ) : null}
        {debt && scheduled ? (
          <Note>Las cuotas siguientes se calculan desde la fecha del próximo pago y las cuotas que registres.</Note>
        ) : null}
      </View>

      <View style={{ gap: spacing.md }}>
        <AppText variant="overline" color="textSecondary">
          Color
        </AppText>
        <ToneSwatches value={tone} options={ACCOUNT_TONES} onChange={setTone} />
      </View>

      <FinancialCard padding={spacing.lg} style={styles.fields}>
        <TextField
          label="Descripción (opcional)"
          placeholder="Ej.: 48 cuotas, placa ABC123"
          value={draft.description}
          onChangeText={(text) => update('description', text)}
          maxLength={280}
          multiline
          error={errors.description}
        />
      </FinancialCard>

      <Note>Una tarjeta de crédito no se registra aquí: créala como cuenta. Sus deudas ya cuentan en tus totales.</Note>

      <OptionSheet visible={sheet === 'kind'} title="Tipo de deuda" onClose={() => setSheet(null)}>
        {LOAN_KINDS.map((option, index) => (
          <ListRow
            key={option}
            title={LOAN_KIND_LABEL[option]}
            icon={LOAN_KIND_ICON[option]}
            showDivider={index > 0}
            right={kind === option ? <Icon name="checkmark" size={16} color={colors.primary} weight="bold" /> : undefined}
            onPress={() => {
              setKind(option);
              setSheet(null);
            }}
          />
        ))}
      </OptionSheet>
      <OptionSheet visible={sheet === 'frequency'} title="¿Cada cuánto pagas?" onClose={() => setSheet(null)}>
        {PAYMENT_FREQUENCIES.map((option: PaymentFrequency, index) => (
          <ListRow
            key={option}
            title={FREQUENCY_LABEL[option]}
            subtitle={option === 'none' ? 'Pagas cuando puedes (por ejemplo, a un familiar)' : undefined}
            showDivider={index > 0}
            right={draft.frequency === option ? <Icon name="checkmark" size={16} color={colors.primary} weight="bold" /> : undefined}
            onPress={() => {
              update('frequency', option);
              setSheet(null);
            }}
          />
        ))}
      </OptionSheet>
      <AccountSheet
        visible={sheet === 'account'}
        title="Cuenta de pago"
        accounts={activeAccounts}
        value={paymentAccountId}
        noneLabel="Elegir al pagar"
        onClose={() => setSheet(null)}
        onSelect={(id) => {
          setPaymentAccountId(id);
          setSheet(null);
        }}
      />
      {(['start', 'due', 'first'] as const).map((key) => (
        <DateSheet
          key={key}
          visible={sheet === key}
          title={key === 'start' ? 'Inicio' : key === 'due' ? 'Fecha límite' : 'Próximo pago'}
          value={key === 'start' ? draft.startDate : key === 'due' ? draft.dueDate : draft.firstPaymentDate}
          today={today}
          onClose={() => setSheet(null)}
          onSelect={(date) => {
            update(key === 'start' ? 'startDate' : key === 'due' ? 'dueDate' : 'firstPaymentDate', date);
            setSheet(null);
          }}
          onClear={
            key === 'due'
              ? () => {
                  update('dueDate', null);
                  setSheet(null);
                }
              : undefined
          }
          clearLabel="Sin fecha límite"
        />
      ))}
    </FormShell>
  );
}

const styles = StyleSheet.create({
  fields: { paddingVertical: 4 },
});
