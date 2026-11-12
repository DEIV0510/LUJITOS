/**
 * Aporte o retiro de una meta (crear o editar). Sin cuenta: solo se asigna
 * dinero que ya tienes. Con cuenta: además se mueve dinero real entre tus
 * cuentas (transferencia), sin crear dinero ni cambiar el patrimonio.
 */
import { useState } from 'react';
import { StyleSheet } from 'react-native';

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
import { errorMessage, isFinanceError } from '@/services/finance/errors';
import { useAppTheme } from '@/theme';
import type { Goal, GoalMovement, GoalMovementKind } from '@/types/planning';

import { AccountSheet, DateSheet, FormShell, Note, dateLabel } from './ui';
import { validatePaymentAmount } from './validation';

const KINDS: { value: GoalMovementKind; label: string }[] = [
  { value: 'contribution', label: 'Aporte' },
  { value: 'withdrawal', label: 'Retiro' },
];

type Sheet = 'account' | 'date' | null;

export function GoalMovementForm({
  goal,
  movement,
  initialKind = 'contribution',
}: {
  goal: Goal;
  movement?: GoalMovement;
  initialKind?: GoalMovementKind;
}) {
  const { spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const today = nowInBogota().date;
  const { activeAccounts, getAccount, getTransaction, addGoalMovement, updateGoalMovement } = useFinanceData();
  const [requestId] = useState(newRequestId);
  const [kind, setKind] = useState<GoalMovementKind>(movement?.kind ?? initialKind);
  const [amount, setAmount] = useState(movement?.amount ?? 0);
  const [date, setDate] = useState(movement?.date ?? today);
  const [note, setNote] = useState(movement?.note ?? '');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string>();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const goalAccount = goal.accountId ? getAccount(goal.accountId) : undefined;
  const otherAccounts = activeAccounts.filter((a) => a.id !== goal.accountId && a.kind !== 'credit_card');
  const linked = movement?.transactionId ? getTransaction(movement.transactionId) : undefined;
  const linkedOther = linked ? getAccount(kind === 'contribution' ? linked.accountId : linked.toAccountId) : undefined;
  const chosen = accountId ? getAccount(accountId) : undefined;
  const maxWithdrawal = kind === 'withdrawal' ? goal.saved + (movement?.kind === 'withdrawal' ? movement.amount : 0) : null;

  const save = async () => {
    const error = validatePaymentAmount(amount);
    setAmountError(error);
    setSubmitError(null);
    if (error) {
      haptics.error();
      return;
    }
    setSubmitting(true);
    try {
      const done = await runWithConfirmations((options) =>
        movement
          ? updateGoalMovement(movement.id, { amount, date, note }, options).then(() => movement.id)
          : addGoalMovement({ goalId: goal.id, kind, amount, date, note, accountId }, requestId, options),
      );
      if (done === null) {
        setSubmitting(false);
        return;
      }
    } catch (cause) {
      haptics.error();
      setSubmitError(
        isFinanceError(cause, 'goal_below_zero')
          ? `${errorMessage(cause)}${cause.detailAmount !== null ? ` Tienes ${formatMoney(cause.detailAmount)} ahorrados.` : ''}`
          : errorMessage(cause, 'No pudimos guardar el movimiento.'),
      );
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
        title={kind === 'contribution' ? (movement ? 'Aporte actualizado' : 'Aporte registrado') : movement ? 'Retiro actualizado' : 'Retiro registrado'}
        message={`La meta «${goal.name}» ya está al día.`}
      />
    );
  }

  return (
    <FormShell
      title={movement ? 'Editar movimiento' : kind === 'contribution' ? 'Aportar a la meta' : 'Retirar de la meta'}
      submitLabel={movement ? 'Guardar cambios' : kind === 'contribution' ? 'Registrar aporte' : 'Registrar retiro'}
      submitting={submitting}
      onSubmit={save}
      error={submitError}
    >
      {movement ? null : <SegmentedControl options={KINDS} value={kind} onChange={setKind} accessibilityLabel="Tipo de movimiento" />}

      <MoneyInput
        variant="hero"
        label={kind === 'contribution' ? 'Valor del aporte' : 'Valor del retiro'}
        value={amount}
        onChange={(value) => {
          setAmount(value);
          if (amountError) setAmountError(undefined);
        }}
        autoFocus={!movement}
        error={amountError}
        tint={kind === 'contribution' ? 'positive' : 'text'}
      />

      <FinancialCard padding={spacing.lg} style={styles.fields}>
        <InfoRow label="Meta" value={goal.name} showDivider={false} />
        <InfoRow label="Ahorrado hoy" value={formatMoney(goal.saved, { hidden })} />
        {maxWithdrawal !== null ? <InfoRow label="Puedes retirar hasta" value={formatMoney(maxWithdrawal, { hidden })} /> : null}
        <SelectField label="Fecha" placeholder="Elegir fecha" value={dateLabel(date, today)} onPress={() => setSheet('date')} showDivider />
        {movement ? (
          linked ? (
            <InfoRow
              label={kind === 'contribution' ? 'Salió de' : 'Volvió a'}
              value={linkedOther?.name ?? 'Otra cuenta'}
            />
          ) : null
        ) : goalAccount ? (
          <SelectField
            label={kind === 'contribution' ? 'Mover dinero desde (opcional)' : 'Mover el dinero a (opcional)'}
            placeholder="No mover dinero"
            value={chosen?.name}
            leading={chosen ? <InstitutionBadge institution={institutionOf(chosen)} size={34} /> : undefined}
            onPress={() => setSheet('account')}
            showDivider
          />
        ) : null}
        <TextField
          label="Nota (opcional)"
          placeholder="Ej.: Prima de diciembre"
          value={note}
          onChangeText={setNote}
          maxLength={200}
          showDivider
        />
      </FinancialCard>

      {movement ? (
        linked ? (
          <Note>Este movimiento movió dinero entre tus cuentas: al editarlo también se corrige esa transferencia.</Note>
        ) : null
      ) : goalAccount ? (
        <Note>
          {accountId
            ? kind === 'contribution'
              ? `Se registrará una transferencia de ${chosen?.name ?? 'esa cuenta'} a ${goalAccount.name}. No es un gasto y tu patrimonio no cambia.`
              : `Se registrará una transferencia de ${goalAccount.name} a ${chosen?.name ?? 'esa cuenta'}.`
            : `El dinero ya está en ${goalAccount.name}: solo se separa para la meta.`}
        </Note>
      ) : (
        <Note>Esta meta no tiene cuenta asignada: el aporte solo separa dinero que ya tienes. No crea dinero nuevo.</Note>
      )}

      <AccountSheet
        visible={sheet === 'account'}
        title={kind === 'contribution' ? 'Mover desde' : 'Mover a'}
        accounts={otherAccounts}
        value={accountId}
        noneLabel="No mover dinero"
        noneSubtitle="Solo separar para la meta"
        onClose={() => setSheet(null)}
        onSelect={(id) => {
          setAccountId(id);
          setSheet(null);
        }}
      />
      <DateSheet
        visible={sheet === 'date'}
        title="Fecha"
        value={date}
        today={today}
        maxDate={today}
        onClose={() => setSheet(null)}
        onSelect={(value) => {
          setDate(value);
          setSheet(null);
        }}
      />
      {kind === 'contribution' ? (
        <AppText variant="caption" color="textTertiary">
          Puedes aportar más que el objetivo: la meta mostrará cuánto la superaste.
        </AppText>
      ) : null}
    </FormShell>
  );
}

const styles = StyleSheet.create({
  fields: { paddingVertical: 4 },
});
