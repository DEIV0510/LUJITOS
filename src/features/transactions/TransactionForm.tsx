/**
 * Registrar o editar un movimiento: ingreso, gasto, transferencia o ajuste de
 * saldo. Pensado para hacerlo en segundos y con una mano: el monto se escribe
 * primero, la cuenta y la categoría se eligen con un toque.
 *
 * Todo se guarda con las funciones RPC del motor financiero. Si el servidor
 * advierte (saldo negativo, cupo, transferencia repetida) se pregunta al usuario.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { CategoryIcon, InstitutionBadge } from '@/components/finance/Badges';
import { MoneyInput } from '@/components/finance/MoneyInput';
import { ScreenHeader } from '@/components/layout/Headers';
import { AppText } from '@/components/ui/AppText';
import { IconButton, PrimaryButton, SecondaryButton } from '@/components/ui/Buttons';
import { DemoNotice } from '@/components/ui/DemoNotice';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { FilterChip, SelectField, TextField } from '@/components/ui/FormField';
import { Icon } from '@/components/ui/Icon';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { ListRow } from '@/components/ui/Rows';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SuccessView } from '@/components/ui/SuccessView';
import { institutionOf, isCreditCard } from '@/features/accounts/display';
import { FormMessage } from '@/features/auth/components';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { runWithConfirmations } from '@/features/finance/confirmations';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { addDays, formatMonthYear, formatWeekdayDate, nowInBogota, parseISO } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { newRequestId } from '@/lib/ids';
import { errorMessage } from '@/services/finance/errors';
import { screenPadding, useAppTheme } from '@/theme';
import type { Transaction, TransactionType } from '@/types/finance';

import { accountBalanceLabel, EmptyIcon } from './parts';
import { ReconcileForm } from './ReconcileForm';
import { validateTransactionDraft, type TransactionDraft, type TransactionErrors } from './validation';

export type FormType = TransactionType | 'adjustment';

const TYPES: { value: FormType; label: string }[] = [
  { value: 'income', label: 'Ingreso' },
  { value: 'expense', label: 'Gasto' },
  { value: 'transfer', label: 'Transferir' },
  { value: 'adjustment', label: 'Ajuste' },
];

const SAVE_LABEL: Record<TransactionType, string> = {
  income: 'Guardar ingreso',
  expense: 'Guardar gasto',
  transfer: 'Guardar transferencia',
};

const TITLE: Record<TransactionType, string> = {
  income: 'Editar ingreso',
  expense: 'Editar gasto',
  transfer: 'Editar transferencia',
};

type Sheet = 'account' | 'toAccount' | 'category' | 'date' | null;

type Props = {
  initialType?: FormType;
  initialAccountId?: string;
  initialToAccountId?: string;
  /** Si llega, el formulario edita este movimiento (el tipo no cambia). */
  transaction?: Transaction;
};

export function TransactionForm({ initialType = 'expense', initialAccountId, initialToAccountId, transaction }: Props) {
  const [type, setType] = useState<FormType>(transaction?.type === 'adjustment' ? 'adjustment' : (transaction?.type ?? initialType));
  // El monto escrito se conserva si se cambia de tipo (por ejemplo, de gasto a ingreso).
  const [carriedAmount, setCarriedAmount] = useState(0);
  const { colors, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();

  if (type === 'adjustment') {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScreenHeader modal leading="close" title="Ajustar saldo" />
        {transaction ? null : (
          <View style={{ paddingHorizontal: screenPadding, paddingTop: spacing.sm }}>
            <SegmentedControl options={TYPES} value={type} onChange={setType} accessibilityLabel="Tipo de movimiento" />
          </View>
        )}
        <ReconcileForm initialAccountId={initialAccountId} bottomInset={insets.bottom} />
      </View>
    );
  }
  return (
    <MovementForm
      key={type}
      type={type}
      onChangeType={transaction ? undefined : setType}
      initialAmount={carriedAmount}
      onAmountChange={setCarriedAmount}
      initialAccountId={initialAccountId}
      initialToAccountId={initialToAccountId}
      transaction={transaction}
    />
  );
}

function MovementForm({
  type,
  onChangeType,
  initialAmount = 0,
  onAmountChange,
  initialAccountId,
  initialToAccountId,
  transaction,
}: {
  type: TransactionType;
  onChangeType?: (type: FormType) => void;
  initialAmount?: number;
  onAmountChange?: (amount: number) => void;
  initialAccountId?: string;
  initialToAccountId?: string;
  transaction?: Transaction;
}) {
  const { colors, spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const insets = useSafeAreaInsets();
  const today = nowInBogota().date;
  const { mode, activeAccounts, categories, getAccount, getCategory, createTransaction, updateTransaction } = useFinanceData();
  const isDemo = mode === 'demo';
  const editing = Boolean(transaction);
  const [requestId] = useState(newRequestId);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<TransactionErrors>({});
  const [sheet, setSheet] = useState<Sheet>(null);

  // Al pagar una tarjeta, el origen sugerido es la primera cuenta de dinero.
  const suggestedSource =
    initialAccountId ??
    (initialToAccountId ? activeAccounts.find((a) => !isCreditCard(a) && a.id !== initialToAccountId)?.id : activeAccounts[0]?.id) ??
    null;

  const [draft, setDraft] = useState<TransactionDraft>(() => ({
    type,
    amount: transaction?.amount ?? initialAmount,
    accountId: transaction?.accountId ?? suggestedSource,
    toAccountId: transaction?.toAccountId ?? initialToAccountId ?? null,
    categoryId: transaction?.categoryId ?? null,
    description: transaction?.description ?? '',
    counterparty: transaction?.counterparty ?? '',
    date: transaction?.date ?? today,
    notes: transaction?.notes ?? '',
  }));
  const [calendarMonth, setCalendarMonth] = useState(() => parseISO(draft.date));

  const update = <K extends keyof TransactionDraft>(key: K, value: TransactionDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    const errorKey = key as keyof TransactionErrors;
    if (errors[errorKey]) setErrors((current) => ({ ...current, [errorKey]: undefined }));
  };

  // Al editar se muestran también la cuenta y la categoría actuales aunque estén archivadas.
  const accountOptions = useMemo(() => {
    const list = [...activeAccounts];
    for (const id of [transaction?.accountId, transaction?.toAccountId]) {
      const current = getAccount(id);
      if (current && !list.some((a) => a.id === current.id)) list.push(current);
    }
    return list;
  }, [activeAccounts, transaction, getAccount]);
  const categoryOptions = categories.filter(
    (item) => item.kind === (type === 'income' ? 'income' : 'expense') && (!item.archivedAt || item.id === transaction?.categoryId),
  );

  const account = getAccount(draft.accountId ?? undefined);
  const target = getAccount(draft.toAccountId ?? undefined);
  const category = draft.categoryId ? getCategory(draft.categoryId) : null;
  const isTransfer = type === 'transfer';
  const dateLabel = draft.date === today ? 'Hoy' : draft.date === addDays(today, -1) ? 'Ayer' : formatWeekdayDate(draft.date);

  const save = async () => {
    const found = validateTransactionDraft(draft, today);
    setErrors(found);
    setSubmitError(null);
    if (Object.values(found).some(Boolean) || !draft.accountId) {
      haptics.error();
      return;
    }
    if (isDemo) {
      haptics.success();
      setSaved(true);
      return;
    }
    const input = {
      type,
      amount: draft.amount,
      accountId: draft.accountId,
      toAccountId: draft.toAccountId,
      categoryId: draft.categoryId,
      date: draft.date,
      description: draft.description,
      counterparty: draft.counterparty,
      notes: draft.notes,
    };
    setSubmitting(true);
    try {
      const result = await runWithConfirmations((options) =>
        transaction ? updateTransaction(transaction.id, input, options).then(() => transaction.id) : createTransaction(input, requestId, options),
      );
      if (result === null) {
        setSubmitting(false);
        return;
      }
    } catch (error) {
      haptics.error();
      setSubmitError(errorMessage(error, 'No pudimos guardar el movimiento.'));
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    haptics.success();
    setSaved(true);
  };

  if (saved) {
    const message = isDemo
      ? 'Modo demostración: no se guardó nada.'
      : editing
        ? 'Los saldos se recalcularon con el nuevo valor.'
        : isTransfer
          ? `Se movió de ${account?.name ?? 'la cuenta'} a ${target?.name ?? 'la otra cuenta'}. No cuenta como ingreso ni gasto.`
          : type === 'income'
            ? `Ya suma en el saldo de ${account?.name ?? 'la cuenta'}.`
            : account && isCreditCard(account)
              ? `La deuda de ${account.name} aumentó.`
              : `Ya se descontó de ${account?.name ?? 'la cuenta'}.`;
    return <SuccessView title={editing ? 'Movimiento actualizado' : 'Movimiento guardado'} message={message} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader modal leading="close" title={editing ? TITLE[type] : 'Nuevo movimiento'} />
      <KeyboardAvoidingView behavior="padding" style={styles.root} keyboardVerticalOffset={0}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ paddingHorizontal: screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.xl }}
        >
          {onChangeType ? (
            <SegmentedControl options={TYPES} value={type} onChange={onChangeType} accessibilityLabel="Tipo de movimiento" />
          ) : null}

          <MoneyInput
            variant="hero"
            label={isTransfer ? 'Valor a transferir' : type === 'income' ? 'Valor recibido' : 'Valor gastado'}
            value={draft.amount}
            onChange={(value) => {
              update('amount', value);
              onAmountChange?.(value);
            }}
            autoFocus={!editing}
            error={errors.amount}
            tint={type === 'income' ? 'positive' : 'text'}
          />

          <FinancialCard padding={spacing.lg} style={styles.fields}>
            <SelectField
              label={isTransfer ? 'Desde' : type === 'income' ? 'Cuenta de destino' : 'Pagado desde'}
              placeholder="Elegir cuenta"
              value={account?.name}
              leading={account ? <InstitutionBadge institution={institutionOf(account)} size={34} /> : <EmptyIcon icon="creditcard" />}
              onPress={() => setSheet('account')}
              error={errors.accountId}
            />
            {isTransfer ? (
              <SelectField
                label="Hacia"
                placeholder="Elegir cuenta de destino"
                value={target?.name}
                leading={target ? <InstitutionBadge institution={institutionOf(target)} size={34} /> : <EmptyIcon icon="arrow.left.arrow.right" />}
                onPress={() => setSheet('toAccount')}
                error={errors.toAccountId}
                showDivider
              />
            ) : (
              <SelectField
                label="Categoría"
                placeholder="Elegir categoría"
                value={category?.name}
                leading={category ? <CategoryIcon category={category} size={34} /> : <EmptyIcon icon="square.grid.2x2.fill" />}
                onPress={() => setSheet('category')}
                error={errors.categoryId}
                showDivider
              />
            )}
            <SelectField
              label="Fecha"
              placeholder="Elegir fecha"
              value={dateLabel}
              leading={<EmptyIcon icon="calendar" />}
              onPress={() => setSheet('date')}
              error={errors.date}
              showDivider
            />
            {isTransfer ? null : (
              <TextField
                label={type === 'income' ? 'Persona o empresa de origen (opcional)' : 'Comercio (opcional)'}
                placeholder={type === 'income' ? 'Ej.: Empresa S.A.S.' : 'Ej.: Supermercado'}
                value={draft.counterparty}
                onChangeText={(text) => update('counterparty', text)}
                maxLength={80}
                showDivider
              />
            )}
            <TextField
              label="Descripción"
              placeholder={isTransfer ? 'Ej.: Recarga a Nequi' : type === 'income' ? 'Ej.: Nómina de noviembre' : 'Ej.: Mercado de la semana'}
              value={draft.description}
              onChangeText={(text) => update('description', text)}
              maxLength={120}
              returnKeyType="done"
              showDivider
            />
            <TextField
              label="Notas (opcional)"
              placeholder="Agrega un detalle"
              value={draft.notes}
              onChangeText={(text) => update('notes', text)}
              multiline
              maxLength={500}
              showDivider
            />
          </FinancialCard>

          {isTransfer && target && isCreditCard(target) ? (
            <Hint
              icon="creditcard.fill"
              text="Pago de tarjeta: reduce la deuda de la tarjeta y descuenta el dinero de la cuenta de origen. No es un gasto nuevo: las compras ya se contaron cuando las hiciste."
            />
          ) : isTransfer ? (
            <Hint icon="arrow.left.arrow.right" text="Una transferencia entre tus cuentas no cuenta como ingreso ni como gasto: tu total no cambia." />
          ) : type === 'expense' && account && isCreditCard(account) ? (
            <Hint icon="creditcard.fill" text="Una compra con tarjeta aumenta su deuda. Cuando pagues la tarjeta, regístralo como transferencia hacia ella." />
          ) : null}

          <FormMessage message={submitError} />
          {isDemo ? <DemoNotice text="Modo demostración: el movimiento se valida pero no se guarda." /> : null}
          {!isDemo && activeAccounts.length === 0 ? (
            <DemoNotice text="Primero agrega una cuenta: todo movimiento sale o entra de una cuenta." />
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg), borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <PrimaryButton label={editing ? 'Guardar cambios' : SAVE_LABEL[type]} size="large" loading={submitting} onPress={save} />
        </View>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={sheet === 'account' || sheet === 'toAccount'}
        title={sheet === 'toAccount' ? 'Cuenta de destino' : isTransfer ? 'Cuenta de origen' : 'Elegir cuenta'}
        onClose={() => setSheet(null)}
      >
        {accountOptions.length === 0 ? (
          <SecondaryButton label="Agregar una cuenta" icon="plus" onPress={() => { setSheet(null); router.push('/account/new'); }} />
        ) : (
          accountOptions
            .filter((option) => (sheet === 'toAccount' ? option.id !== draft.accountId : option.id !== draft.toAccountId))
            .map((option, index) => (
              <ListRow
                key={option.id}
                title={option.name}
                subtitle={accountBalanceLabel(option, hidden)}
                showDivider={index > 0}
                right={<InstitutionBadge institution={institutionOf(option)} size={30} />}
                onPress={() => {
                  update(sheet === 'toAccount' ? 'toAccountId' : 'accountId', option.id);
                  setSheet(null);
                }}
              />
            ))
        )}
      </OptionSheet>

      <OptionSheet visible={sheet === 'category'} title={type === 'income' ? 'Categoría del ingreso' : 'Categoría del gasto'} onClose={() => setSheet(null)}>
        <View style={styles.categoryGrid}>
          {categoryOptions.map((option) => {
            const selected = option.id === draft.categoryId;
            return (
              <View key={option.id} style={styles.categoryCell}>
                <FinancialCard
                  tone={selected ? 'muted' : 'surface'}
                  padding={spacing.sm}
                  onPress={() => {
                    update('categoryId', option.id);
                    setSheet(null);
                  }}
                  accessibilityLabel={option.name}
                  style={[styles.categoryCard, selected && { borderWidth: 1.5, borderColor: colors.primary }]}
                >
                  <CategoryIcon category={option} size={38} />
                  <AppText variant="caption" align="center" numberOfLines={2} style={{ marginTop: 6 }}>
                    {option.name}
                  </AppText>
                </FinancialCard>
              </View>
            );
          })}
        </View>
        {isDemo ? null : (
          <SecondaryButton
            label="Crear categoría"
            icon="plus"
            style={{ marginTop: spacing.md }}
            onPress={() => {
              setSheet(null);
              router.push({ pathname: '/category/edit', params: { kind: type === 'income' ? 'income' : 'expense' } });
            }}
          />
        )}
      </OptionSheet>

      <OptionSheet visible={sheet === 'date'} title="Fecha del movimiento" onClose={() => setSheet(null)}>
        <View style={[styles.quickDates, { marginBottom: spacing.lg }]}>
          <FilterChip label="Hoy" selected={draft.date === today} onPress={() => { update('date', today); setSheet(null); }} />
          <FilterChip label="Ayer" selected={draft.date === addDays(today, -1)} onPress={() => { update('date', addDays(today, -1)); setSheet(null); }} />
        </View>
        <View style={styles.calendarNav}>
          <IconButton
            icon="chevron.left"
            variant="plain"
            accessibilityLabel="Mes anterior"
            onPress={() =>
              setCalendarMonth((current) =>
                current.month === 1 ? { ...current, year: current.year - 1, month: 12 } : { ...current, month: current.month - 1 },
              )
            }
          />
          <AppText variant="headline" align="center" style={styles.root}>
            {formatMonthYear(calendarMonth.year, calendarMonth.month)}
          </AppText>
          <IconButton
            icon="chevron.right"
            variant="plain"
            accessibilityLabel="Mes siguiente"
            onPress={() =>
              setCalendarMonth((current) =>
                current.month === 12 ? { ...current, year: current.year + 1, month: 1 } : { ...current, month: current.month + 1 },
              )
            }
          />
        </View>
        <CalendarGrid
          year={calendarMonth.year}
          month={calendarMonth.month}
          selected={draft.date}
          today={today}
          maxDate={today}
          onSelect={(date) => {
            update('date', date);
            setSheet(null);
          }}
        />
      </OptionSheet>
    </View>
  );
}

function Hint({ icon, text }: { icon: 'creditcard.fill' | 'arrow.left.arrow.right'; text: string }) {
  const { colors, spacing, radius } = useAppTheme();
  return (
    <View style={[styles.hint, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }]}>
      <Icon name={icon} size={15} color={colors.textSecondary} />
      <AppText variant="footnote" color="textSecondary" style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  fields: { paddingVertical: 4 },
  footer: { paddingHorizontal: screenPadding, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  categoryCell: { width: '33.333%', padding: 4 },
  categoryCard: { alignItems: 'center', minHeight: 92, justifyContent: 'center' },
  quickDates: { flexDirection: 'row', gap: 8 },
  calendarNav: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  hint: { flexDirection: 'row', alignItems: 'flex-start' },
});
