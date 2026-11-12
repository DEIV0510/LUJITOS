/**
 * Crear o editar una meta de ahorro: nombre, objetivo, lo ya ahorrado, fechas,
 * tipo, cuenta donde está el dinero (opcional), color, ícono y descripción.
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
import { IconGrid, ToneSwatches } from '@/components/ui/Pickers';
import { ListRow } from '@/components/ui/Rows';
import { SuccessView } from '@/components/ui/SuccessView';
import { ACCOUNT_TONES } from '@/constants/institutions';
import { institutionOf } from '@/features/accounts/display';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { haptics } from '@/lib/haptics';
import { newRequestId } from '@/lib/ids';
import { nowInBogota } from '@/lib/dates';
import { errorMessage } from '@/services/finance/errors';
import { isTone } from '@/services/finance/mappers';
import { GOAL_KINDS } from '@/services/planning/mappers';
import { useAppTheme, type Tone } from '@/theme';
import type { IconName } from '@/types/finance';
import type { Goal, GoalKind } from '@/types/planning';

import { GOAL_KIND_ICON, GOAL_KIND_LABEL } from './labels';
import { AccountSheet, DateSheet, FormShell, Note, dateLabel } from './ui';
import { validateGoalDraft, type GoalDraft, type GoalErrors } from './validation';

const GOAL_ICONS: IconName[] = [
  'target',
  'airplane',
  'house.fill',
  'car.fill',
  'graduationcap.fill',
  'cross.case.fill',
  'leaf.fill',
  'bag.fill',
  'gift.fill',
  'laptopcomputer',
  'heart.fill',
  'star.fill',
];

type Sheet = 'kind' | 'account' | 'start' | 'target' | null;

export function GoalForm({ goal }: { goal?: Goal }) {
  const { colors, spacing } = useAppTheme();
  const today = nowInBogota().date;
  const { activeAccounts, getAccount, createGoal, updateGoal } = useFinanceData();
  const [requestId] = useState(newRequestId);
  const [draft, setDraft] = useState<GoalDraft>(() => ({
    name: goal?.name ?? '',
    target: goal?.target ?? 0,
    initialSaved: goal?.initialSaved ?? 0,
    startDate: goal?.startDate ?? today,
    targetDate: goal?.targetDate ?? null,
    description: goal?.description ?? '',
  }));
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? 'other');
  const [accountId, setAccountId] = useState<string | null>(goal?.accountId ?? null);
  const [tone, setTone] = useState<Tone>(isTone(goal?.color) ? goal.color : 'gold');
  const [icon, setIcon] = useState<IconName | null>((goal?.icon as IconName | null) ?? null);
  const [errors, setErrors] = useState<GoalErrors>({});
  const [sheet, setSheet] = useState<Sheet>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof GoalDraft>(key: K, value: GoalDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (errors[key as keyof GoalErrors]) setErrors((current) => ({ ...current, [key]: undefined }));
  };
  // Solo cuentas con dinero (no tarjetas): el dinero de una meta no está en un cupo.
  const moneyAccounts = activeAccounts.filter((a) => a.kind !== 'credit_card');
  const account = accountId ? getAccount(accountId) : undefined;

  const save = async () => {
    const found = validateGoalDraft(draft);
    setErrors(found);
    setSubmitError(null);
    if (Object.values(found).some(Boolean)) {
      haptics.error();
      return;
    }
    const input = { ...draft, kind, accountId, color: tone, icon };
    setSubmitting(true);
    try {
      if (goal) await updateGoal(goal.id, input);
      else await createGoal(input, requestId);
    } catch (error) {
      haptics.error();
      setSubmitError(errorMessage(error, 'No pudimos guardar la meta.'));
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    haptics.success();
    setSaved(true);
  };

  if (saved) {
    return <SuccessView title={goal ? 'Meta actualizada' : 'Meta creada'} message="Registra tus aportes desde la meta." />;
  }

  return (
    <FormShell
      title={goal ? 'Editar meta' : 'Nueva meta'}
      submitLabel={goal ? 'Guardar cambios' : 'Crear meta'}
      submitting={submitting}
      onSubmit={save}
      error={submitError}
    >
      <FinancialCard padding={spacing.lg} style={styles.fields}>
        <TextField
          label="Nombre"
          placeholder="Ej.: Viaje a Cartagena"
          value={draft.name}
          onChangeText={(text) => update('name', text)}
          maxLength={60}
          error={errors.name}
        />
        <SelectField
          label="Tipo de meta"
          placeholder="Elegir tipo"
          value={GOAL_KIND_LABEL[kind]}
          onPress={() => setSheet('kind')}
          showDivider
        />
      </FinancialCard>

      <MoneyInput label="¿Cuánto quieres ahorrar?" value={draft.target} onChange={(value) => update('target', value)} error={errors.target} />
      <View style={{ gap: spacing.sm }}>
        <MoneyInput
          label="Lo que ya tienes ahorrado para esta meta"
          value={draft.initialSaved}
          onChange={(value) => update('initialSaved', value)}
          error={errors.initialSaved}
        />
        <AppText variant="footnote" color="textSecondary">
          Es dinero que ya tienes en tus cuentas: no se suma otra vez a tu patrimonio. Puede ser cero.
        </AppText>
      </View>

      <FinancialCard padding={spacing.lg} style={styles.fields}>
        <SelectField label="Empieza" placeholder="Elegir fecha" value={dateLabel(draft.startDate, today)} onPress={() => setSheet('start')} />
        <SelectField
          label="Fecha objetivo (opcional)"
          placeholder="Sin fecha"
          value={draft.targetDate ? dateLabel(draft.targetDate, today) : undefined}
          onPress={() => setSheet('target')}
          error={errors.targetDate}
          showDivider
        />
        <SelectField
          label="Cuenta donde está el dinero (opcional)"
          placeholder="Sin cuenta asignada"
          value={account?.name}
          leading={account ? <InstitutionBadge institution={institutionOf(account)} size={34} /> : undefined}
          onPress={() => setSheet('account')}
          showDivider
        />
      </FinancialCard>
      {accountId ? null : (
        <Note>Sin cuenta, la meta lleva la cuenta de lo que separas. Con cuenta, puedes mover dinero real hacia ella al aportar.</Note>
      )}

      <View style={{ gap: spacing.md }}>
        <AppText variant="overline" color="textSecondary">
          Color
        </AppText>
        <ToneSwatches value={tone} options={ACCOUNT_TONES} onChange={setTone} />
        <AppText variant="overline" color="textSecondary" style={{ marginTop: spacing.sm }}>
          Ícono
        </AppText>
        <IconGrid value={icon} options={GOAL_ICONS} tone={tone} onChange={setIcon} noneLabel="Según el tipo" />
      </View>

      <FinancialCard padding={spacing.lg} style={styles.fields}>
        <TextField
          label="Descripción (opcional)"
          placeholder="Ej.: Tiquetes y hotel para diciembre"
          value={draft.description}
          onChangeText={(text) => update('description', text)}
          maxLength={280}
          multiline
          error={errors.description}
        />
      </FinancialCard>

      <OptionSheet visible={sheet === 'kind'} title="Tipo de meta" onClose={() => setSheet(null)}>
        {GOAL_KINDS.map((option, index) => (
          <ListRow
            key={option}
            title={GOAL_KIND_LABEL[option]}
            icon={GOAL_KIND_ICON[option]}
            showDivider={index > 0}
            right={kind === option ? <Icon name="checkmark" size={16} color={colors.primary} weight="bold" /> : undefined}
            onPress={() => {
              setKind(option);
              setSheet(null);
            }}
          />
        ))}
      </OptionSheet>
      <AccountSheet
        visible={sheet === 'account'}
        title="Cuenta de la meta"
        accounts={moneyAccounts}
        value={accountId}
        noneLabel="Sin cuenta asignada"
        noneSubtitle="Solo llevar la cuenta de lo separado"
        onClose={() => setSheet(null)}
        onSelect={(id) => {
          setAccountId(id);
          setSheet(null);
        }}
      />
      <DateSheet
        visible={sheet === 'start'}
        title="Empieza"
        value={draft.startDate}
        today={today}
        onClose={() => setSheet(null)}
        onSelect={(date) => {
          update('startDate', date);
          setSheet(null);
        }}
      />
      <DateSheet
        visible={sheet === 'target'}
        title="Fecha objetivo"
        value={draft.targetDate}
        today={today}
        onClose={() => setSheet(null)}
        onSelect={(date) => {
          update('targetDate', date);
          setSheet(null);
        }}
        onClear={() => {
          update('targetDate', null);
          setSheet(null);
        }}
      />
    </FormShell>
  );
}

const styles = StyleSheet.create({
  fields: { paddingVertical: 4 },
});
