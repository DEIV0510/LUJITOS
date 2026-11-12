/**
 * Crear o editar una cuenta. Entidad de la lista o escrita a mano, tipo, saldo
 * inicial (o deuda inicial y cupo en tarjetas), color, ícono y descripción.
 * Se guarda con las funciones RPC: el servidor valida todo otra vez.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InstitutionBadge } from '@/components/finance/Badges';
import { MoneyInput } from '@/components/finance/MoneyInput';
import { ScreenHeader } from '@/components/layout/Headers';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/Buttons';
import { DemoNotice } from '@/components/ui/DemoNotice';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { FilterChip, SelectField, TextField } from '@/components/ui/FormField';
import { Icon } from '@/components/ui/Icon';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { DayGrid, IconGrid, ToneSwatches } from '@/components/ui/Pickers';
import { InfoRow, ListRow } from '@/components/ui/Rows';
import { SuccessView } from '@/components/ui/SuccessView';
import {
  ACCOUNT_ICONS,
  ACCOUNT_KIND_ICON,
  ACCOUNT_KIND_LABEL,
  ACCOUNT_KINDS,
  ACCOUNT_PRESETS,
  ACCOUNT_TONES,
  INSTITUTION_GROUPS,
  INSTITUTIONS,
  type AccountPreset,
} from '@/constants/institutions';
import { FormMessage } from '@/features/auth/components';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { haptics } from '@/lib/haptics';
import { newRequestId } from '@/lib/ids';
import { formatMoney, type Money } from '@/lib/money';
import { errorMessage } from '@/services/finance/errors';
import { isTone } from '@/services/finance/mappers';
import { screenPadding, useAppTheme, type Tone } from '@/theme';
import type { Account, AccountKind, IconName, InstitutionId } from '@/types/finance';

import { institutionOf } from './display';
import { validateAccountDraft, type AccountDraft, type AccountErrors } from './validation';

type Sheet = 'institution' | 'kind' | 'statement' | 'due' | null;

export function AccountForm({ account }: { account?: Account }) {
  const { colors, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { mode, createAccount, updateAccount, transactions, voidedTransactions } = useFinanceData();
  const isDemo = mode === 'demo';
  const editing = Boolean(account);
  // Cualquier movimiento (también anulado) fija el saldo inicial y la naturaleza de la cuenta.
  const hasMovements =
    account !== undefined &&
    [...transactions, ...voidedTransactions].some((t) => t.accountId === account.id || t.toAccountId === account.id);
  const [requestId] = useState(newRequestId);

  const [draft, setDraft] = useState<AccountDraft>(() => ({
    name: account?.name ?? '',
    institution: account?.institutionId ?? null,
    institutionName: account?.institutionName ?? '',
    kind: account?.kind ?? null,
    initial: account ? (account.kind === 'credit_card' ? -account.initialBalance : account.initialBalance) : 0,
    creditLimit: account?.creditLimit ?? 0,
    statementDay: account?.statementDay ?? null,
    paymentDueDay: account?.paymentDueDay ?? null,
    lastFour: account?.lastFour ?? '',
    description: account?.description ?? '',
  }));
  const [tone, setTone] = useState<Tone | null>(isTone(account?.color) ? account.color : null);
  const [icon, setIcon] = useState<IconName | null>((account?.icon as IconName | null | undefined) ?? null);
  const [errors, setErrors] = useState<AccountErrors>({});
  const [sheet, setSheet] = useState<Sheet>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof AccountDraft>(key: K, value: AccountDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    const errorKey = key as keyof AccountErrors;
    if (errors[errorKey]) setErrors((current) => ({ ...current, [errorKey]: undefined }));
  };

  const applyPreset = (preset: AccountPreset) => {
    haptics.selection();
    setDraft((current) => ({ ...current, name: preset.name, institution: preset.institution, kind: preset.kind }));
    setErrors({});
  };

  const isCard = draft.kind === 'credit_card';
  const preview = institutionOf({
    institutionId: draft.institution ?? 'custom',
    institutionName: draft.institutionName,
    color: tone,
    icon,
  });
  const baseTone = INSTITUTIONS[draft.institution ?? 'custom'].tone;

  const save = async () => {
    const found = validateAccountDraft(draft);
    setErrors(found);
    setSubmitError(null);
    if (Object.values(found).some(Boolean) || !draft.kind || !draft.institution) {
      haptics.error();
      return;
    }
    if (isDemo) {
      haptics.success();
      setSaved(true);
      return;
    }
    const input = {
      name: draft.name,
      kind: draft.kind,
      institution: draft.institution,
      institutionName: draft.institution === 'custom' ? draft.institutionName : null,
      // Una tarjeta guarda su deuda como saldo negativo.
      initialBalance: isCard ? -Math.abs(draft.initial) : draft.initial,
      creditLimit: isCard ? draft.creditLimit : null,
      lastFour: draft.lastFour || null,
      color: tone,
      icon,
      description: draft.description,
      statementDay: isCard ? draft.statementDay : null,
      paymentDueDay: isCard ? draft.paymentDueDay : null,
    };
    setSubmitting(true);
    try {
      if (account) await updateAccount(account.id, input);
      else await createAccount(input, requestId);
    } catch (error) {
      haptics.error();
      setSubmitError(errorMessage(error, 'No pudimos guardar la cuenta.'));
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
        title={isDemo ? 'Cuenta validada' : editing ? 'Cuenta actualizada' : 'Cuenta creada'}
        message={isDemo ? 'Modo demostración: no se guardó nada.' : editing ? 'Los cambios ya se ven en tus cuentas.' : 'Ya aparece en tu panel y en Mis cuentas.'}
      />
    );
  }

  const kindOptions = hasMovements
    ? ACCOUNT_KINDS.filter((kind) => (kind === 'credit_card') === (account?.kind === 'credit_card'))
    : ACCOUNT_KINDS;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader modal leading="close" title={editing ? 'Editar cuenta' : 'Nueva cuenta'} />
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ paddingHorizontal: screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.xl }}
        >
          <View style={[styles.preview, { gap: spacing.md }]}>
            <InstitutionBadge institution={preview} size={52} />
            <View style={styles.flex}>
              <AppText variant="headline" numberOfLines={2}>
                {draft.name.trim() || 'Nueva cuenta'}
              </AppText>
              <AppText variant="footnote" color="textSecondary" numberOfLines={2}>
                {preview.name}
                {draft.kind ? ` · ${ACCOUNT_KIND_LABEL[draft.kind]}` : ''}
              </AppText>
            </View>
          </View>

          {editing ? null : (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="overline" color="textSecondary">
                Ejemplos rápidos
              </AppText>
              <View style={styles.chips}>
                {ACCOUNT_PRESETS.map((preset) => (
                  <FilterChip key={preset.key} label={preset.label} onPress={() => applyPreset(preset)} />
                ))}
              </View>
            </View>
          )}

          <FinancialCard padding={spacing.lg} style={styles.fields}>
            <TextField
              label="Nombre de la cuenta"
              placeholder="Ej.: Ahorros nómina"
              value={draft.name}
              onChangeText={(text) => update('name', text)}
              maxLength={60}
              error={errors.name}
            />
            <SelectField
              label="Entidad financiera"
              placeholder="Elegir entidad"
              value={draft.institution ? preview.name : undefined}
              leading={draft.institution ? <InstitutionBadge institution={preview} size={34} /> : undefined}
              onPress={() => setSheet('institution')}
              error={errors.institution}
              showDivider
            />
            {draft.institution === 'custom' ? (
              <TextField
                label="Nombre de la entidad"
                placeholder="Ej.: Banco Popular, Cooperativa…"
                value={draft.institutionName}
                onChangeText={(text) => update('institutionName', text)}
                maxLength={60}
                error={errors.institutionName}
                showDivider
              />
            ) : null}
            <SelectField
              label="Tipo de cuenta"
              placeholder="Elegir tipo"
              value={draft.kind ? ACCOUNT_KIND_LABEL[draft.kind] : undefined}
              onPress={() => setSheet('kind')}
              error={errors.kind}
              showDivider
            />
            <TextField
              label="Últimos 4 dígitos (opcional)"
              placeholder="0000"
              value={draft.lastFour}
              onChangeText={(text) => update('lastFour', text.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              error={errors.lastFour}
              showDivider
            />
            <InfoRow label="Moneda" value="COP · peso colombiano" />
          </FinancialCard>

          {hasMovements ? (
            <FinancialCard padding={spacing.lg} style={styles.fields}>
              <InfoRow
                label={isCard ? 'Deuda inicial' : 'Saldo inicial'}
                value={formatMoney(isCard ? -(account?.initialBalance ?? 0) : (account?.initialBalance ?? 0))}
                showDivider={false}
              />
              <AppText variant="footnote" color="textSecondary" style={{ paddingVertical: spacing.sm }}>
                La cuenta ya tiene movimientos: el saldo inicial no se cambia para no alterar tu historial. Si el saldo no coincide
                con el real, usa «Ajustar saldo» en la cuenta.
              </AppText>
            </FinancialCard>
          ) : (
            <View style={{ gap: spacing.sm }}>
              <MoneyInput
                label={isCard ? 'Deuda actual de la tarjeta' : 'Saldo inicial'}
                value={draft.initial}
                onChange={(value) => update('initial', value)}
                error={errors.initial}
              />
              <AppText variant="footnote" color="textSecondary">
                {isCard
                  ? 'Lo que debes hoy en esta tarjeta, al empezar a usar LUJITOS. Puede ser cero. Desde aquí, cada compra aumenta la deuda y cada pago la reduce.'
                  : 'El dinero que tienes hoy en esta cuenta, al empezar a usar LUJITOS. Puede ser cero. Desde aquí se suman tus ingresos y se restan tus gastos.'}
              </AppText>
            </View>
          )}

          {isCard ? (
            <View style={{ gap: spacing.md }}>
              <MoneyInput label="Cupo total" value={draft.creditLimit} onChange={(value: Money) => update('creditLimit', value)} error={errors.creditLimit} />
              <FinancialCard padding={spacing.lg} style={styles.fields}>
                <SelectField
                  label="Día de corte"
                  placeholder="Elegir día (opcional)"
                  value={draft.statementDay ? `Día ${draft.statementDay} de cada mes` : undefined}
                  onPress={() => setSheet('statement')}
                />
                <SelectField
                  label="Día límite de pago"
                  placeholder="Elegir día (opcional)"
                  value={draft.paymentDueDay ? `Día ${draft.paymentDueDay} de cada mes` : undefined}
                  onPress={() => setSheet('due')}
                  showDivider
                />
              </FinancialCard>
            </View>
          ) : null}

          <View style={{ gap: spacing.md }}>
            <AppText variant="overline" color="textSecondary">
              Color identificador
            </AppText>
            <ToneSwatches value={tone ?? baseTone} options={ACCOUNT_TONES} onChange={setTone} />
            <AppText variant="overline" color="textSecondary" style={{ marginTop: spacing.sm }}>
              Ícono
            </AppText>
            <IconGrid value={icon} options={ACCOUNT_ICONS} tone={tone ?? baseTone} onChange={setIcon} noneLabel="Iniciales de la entidad" />
          </View>

          <FinancialCard padding={spacing.lg} style={styles.fields}>
            <TextField
              label="Descripción (opcional)"
              placeholder="Ej.: Cuenta donde me pagan la nómina"
              value={draft.description}
              onChangeText={(text) => update('description', text)}
              maxLength={140}
              multiline
              error={errors.description}
            />
          </FinancialCard>

          <FormMessage message={submitError} />
          {isDemo ? <DemoNotice text="Modo demostración: la cuenta se valida pero no se guarda." /> : null}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg), borderTopColor: colors.border }]}>
          <PrimaryButton label={editing ? 'Guardar cambios' : 'Guardar cuenta'} size="large" loading={submitting} onPress={save} />
        </View>
      </KeyboardAvoidingView>

      <OptionSheet visible={sheet === 'institution'} title="Entidad financiera" onClose={() => setSheet(null)}>
        {INSTITUTION_GROUPS.map((group) => (
          <View key={group.title} style={{ marginBottom: spacing.md }}>
            <AppText variant="overline" color="textSecondary" style={{ marginBottom: spacing.xs }}>
              {group.title}
            </AppText>
            {group.ids.map((id: InstitutionId, index) => (
              <ListRow
                key={id}
                title={INSTITUTIONS[id].name}
                subtitle={id === 'custom' ? 'Escribe el nombre de cualquier entidad' : undefined}
                showDivider={index > 0}
                right={<InstitutionBadge institution={INSTITUTIONS[id]} size={30} />}
                onPress={() => {
                  update('institution', id);
                  setSheet(null);
                }}
              />
            ))}
          </View>
        ))}
      </OptionSheet>

      <OptionSheet visible={sheet === 'kind'} title="Tipo de cuenta" onClose={() => setSheet(null)}>
        {kindOptions.map((option: AccountKind, index) => (
          <ListRow
            key={option}
            title={ACCOUNT_KIND_LABEL[option]}
            icon={ACCOUNT_KIND_ICON[option]}
            showDivider={index > 0}
            right={draft.kind === option ? <Icon name="checkmark" size={16} color={colors.primary} weight="bold" /> : undefined}
            onPress={() => {
              update('kind', option);
              setSheet(null);
            }}
          />
        ))}
      </OptionSheet>

      <OptionSheet visible={sheet === 'statement' || sheet === 'due'} title={sheet === 'due' ? 'Día límite de pago' : 'Día de corte'} onClose={() => setSheet(null)}>
        <DayGrid
          value={sheet === 'due' ? draft.paymentDueDay : draft.statementDay}
          onChange={(day) => {
            update(sheet === 'due' ? 'paymentDueDay' : 'statementDay', day);
            setSheet(null);
          }}
        />
      </OptionSheet>
    </View>
  );
}

/** Abre el formulario de cuenta para crear (sin id) o editar. */
export function openAccountForm(accountId?: string) {
  if (accountId) router.push({ pathname: '/account/edit', params: { id: accountId } });
  else router.push('/account/new');
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  preview: { flexDirection: 'row', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fields: { paddingVertical: 4 },
  footer: { paddingHorizontal: screenPadding, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
