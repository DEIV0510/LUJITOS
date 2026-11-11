import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { CategoryIcon, InstitutionBadge } from '@/components/finance/Badges';
import { MoneyInput } from '@/components/finance/MoneyInput';
import { ScreenHeader } from '@/components/layout/Headers';
import { AppText } from '@/components/ui/AppText';
import { IconButton, PrimaryButton } from '@/components/ui/Buttons';
import { FormMessage } from '@/features/auth/components';
import { DemoNotice } from '@/components/ui/DemoNotice';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { FilterChip, SelectField, TextField } from '@/components/ui/FormField';
import { Icon } from '@/components/ui/Icon';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { ListRow } from '@/components/ui/Rows';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { getInstitution } from '@/features/demo/selectors';
import { usePrivacy } from '@/features/privacy/PrivacyProvider';
import { addDays, formatMonthYear, formatWeekdayDate, nowInBogota, parseISO, type ISODate } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { formatMoney, type Money } from '@/lib/money';
import { screenPadding, useAppTheme } from '@/theme';
import type { TransactionType } from '@/types/finance';

const TYPES: { value: TransactionType; label: string }[] = [
  { value: 'income', label: 'Ingreso' },
  { value: 'expense', label: 'Gasto' },
  { value: 'transfer', label: 'Transferencia' },
];

const SAVE_LABEL: Record<TransactionType, string> = {
  income: 'Guardar ingreso',
  expense: 'Guardar gasto',
  transfer: 'Guardar transferencia',
};

type Draft = {
  type: TransactionType;
  amount: Money;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  description: string;
  date: ISODate;
  notes: string;
};

type Errors = Partial<Record<'amount' | 'accountId' | 'toAccountId' | 'categoryId', string>>;

/** Reglas mínimas antes de guardar. En la Fase 5 se reemplazan por esquemas Zod compartidos. */
export function validateDraft(draft: Draft): Errors {
  const errors: Errors = {};
  if (draft.amount <= 0) errors.amount = 'Escribe un valor mayor que cero.';
  if (!draft.accountId) errors.accountId = draft.type === 'transfer' ? 'Elige la cuenta de origen.' : 'Elige la cuenta.';
  if (draft.type === 'transfer') {
    if (!draft.toAccountId) errors.toAccountId = 'Elige la cuenta de destino.';
    else if (draft.toAccountId === draft.accountId) errors.toAccountId = 'El origen y el destino deben ser cuentas distintas.';
  } else if (!draft.categoryId) {
    errors.categoryId = 'Elige una categoría.';
  }
  return errors;
}

type Sheet = 'account' | 'toAccount' | 'category' | 'date' | null;

type Props = { initialType?: TransactionType; initialAccountId?: string; initialToAccountId?: string };

export function TransactionForm({ initialType = 'expense', initialAccountId, initialToAccountId }: Props) {
  const { colors, spacing } = useAppTheme();
  const { hidden } = usePrivacy();
  const insets = useSafeAreaInsets();
  const amountRef = useRef<ComponentRef<typeof TextInput>>(null);
  const today = nowInBogota().date;
  const { mode, accounts: allAccounts, categories, getAccount, getCategory, createTransaction } = useFinanceData();
  const accounts = allAccounts.filter((item) => item.isActive !== false);
  const isDemo = mode === 'demo';
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft>({
    type: initialType,
    amount: 0,
    accountId: initialAccountId ?? null,
    toAccountId: initialToAccountId ?? null,
    categoryId: null,
    description: '',
    date: today,
    notes: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [sheet, setSheet] = useState<Sheet>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => parseISO(today));
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    // El error se limpia al corregir el campo (no al salir de él).
    const errorKey = key as keyof Errors;
    if (errors[errorKey]) setErrors((current) => ({ ...current, [errorKey]: undefined }));
  };

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => router.back(), 1300);
    return () => clearTimeout(timer);
  }, [saved]);

  const changeType = (type: TransactionType) => {
    setDraft((current) => ({ ...current, type, categoryId: null, toAccountId: type === 'transfer' ? current.toAccountId : null }));
    setErrors({});
  };

  const save = async () => {
    const found = validateDraft(draft);
    setErrors(found);
    setSubmitError(null);
    if (Object.values(found).some(Boolean)) {
      haptics.error();
      return;
    }
    if (!isDemo && draft.accountId) {
      setSubmitting(true);
      try {
        await createTransaction({
          type: draft.type,
          amount: draft.amount,
          accountId: draft.accountId,
          toAccountId: draft.toAccountId,
          categoryId: draft.categoryId,
          description: draft.description,
          date: draft.date,
          notes: draft.notes,
        });
      } catch (error) {
        haptics.error();
        setSubmitError(error instanceof Error ? error.message : 'No pudimos guardar el movimiento.');
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
    }
    haptics.success();
    setSaved(true);
  };

  const account = getAccount(draft.accountId ?? undefined);
  const target = getAccount(draft.toAccountId ?? undefined);
  const category = draft.categoryId ? getCategory(draft.categoryId) : null;
  const isTransfer = draft.type === 'transfer';
  const dateLabel = draft.date === today ? 'Hoy' : draft.date === addDays(today, -1) ? 'Ayer' : formatWeekdayDate(draft.date);

  if (saved) {
    return (
      <View style={[styles.root, styles.saved, { backgroundColor: colors.background }]}>
        <Animated.View entering={ZoomIn.springify().damping(14)} style={[styles.check, { backgroundColor: colors.positiveSoft }]}>
          <Icon name="checkmark" size={34} color={colors.positive} weight="bold" />
        </Animated.View>
        <Animated.View entering={FadeIn.delay(150)} style={{ alignItems: 'center', gap: spacing.xs }}>
          <AppText variant="title" align="center">
            {isDemo ? 'Movimiento validado' : 'Movimiento guardado'}
          </AppText>
          <AppText variant="callout" color="textSecondary" align="center" style={styles.savedText}>
            {isDemo
              ? 'Modo demostración: no se guardó nada.'
              : 'Ya cuenta en el saldo de tus cuentas.'}
          </AppText>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader modal leading="close" title="Nuevo movimiento" />
      <KeyboardAvoidingView behavior="padding" style={styles.root} keyboardVerticalOffset={0}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ paddingHorizontal: screenPadding, paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.xl }}
        >
          <SegmentedControl options={TYPES} value={draft.type} onChange={changeType} accessibilityLabel="Tipo de movimiento" />

          <MoneyInput
            ref={amountRef}
            variant="hero"
            label={isTransfer ? 'Valor a transferir' : draft.type === 'income' ? 'Valor recibido' : 'Valor gastado'}
            value={draft.amount}
            onChange={(value) => update('amount', value)}
            autoFocus
            error={errors.amount}
            tint={draft.type === 'income' ? 'positive' : 'text'}
          />

          <FinancialCard padding={spacing.lg} style={styles.fields}>
            <SelectField
              label={isTransfer ? 'Desde' : 'Cuenta'}
              placeholder="Elegir cuenta"
              value={account?.name}
              leading={account ? <InstitutionBadge institution={getInstitution(account)} size={34} /> : <EmptyIcon icon="creditcard" />}
              onPress={() => setSheet('account')}
              error={errors.accountId}
            />
            {isTransfer ? (
              <SelectField
                label="Hacia"
                placeholder="Elegir cuenta de destino"
                value={target?.name}
                leading={target ? <InstitutionBadge institution={getInstitution(target)} size={34} /> : <EmptyIcon icon="arrow.left.arrow.right" />}
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
            <TextField
              label="Descripción"
              placeholder={isTransfer ? 'Ej.: Recarga a Nequi' : 'Ej.: Mercado de la semana'}
              value={draft.description}
              onChangeText={(text) => update('description', text)}
              maxLength={80}
              returnKeyType="done"
              showDivider
            />
            <SelectField
              label="Fecha"
              placeholder="Elegir fecha"
              value={dateLabel}
              leading={<EmptyIcon icon="calendar" />}
              onPress={() => setSheet('date')}
              showDivider
            />
            <TextField
              label="Notas (opcional)"
              placeholder="Agrega un detalle"
              value={draft.notes}
              onChangeText={(text) => update('notes', text)}
              multiline
              maxLength={240}
              showDivider
            />
          </FinancialCard>

          {isTransfer ? (
            <AppText variant="footnote" color="textSecondary">
              Una transferencia entre tus cuentas no cuenta como ingreso ni como gasto. Si pagas una tarjeta de crédito, regístralo
              como transferencia hacia la tarjeta: las compras ya se contaron como gasto.
            </AppText>
          ) : null}

          <FormMessage message={submitError} />
          {isDemo ? <DemoNotice text="Modo demostración: el movimiento se valida pero no se guarda." /> : null}
          {!isDemo && accounts.length === 0 ? (
            <DemoNotice text="Primero agrega una cuenta: todo movimiento sale o entra de una cuenta." />
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg), borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <PrimaryButton label={SAVE_LABEL[draft.type]} size="large" loading={submitting} onPress={save} />
        </View>
      </KeyboardAvoidingView>

      <OptionSheet visible={sheet === 'account' || sheet === 'toAccount'} title={sheet === 'toAccount' ? 'Cuenta de destino' : 'Elegir cuenta'} onClose={() => setSheet(null)}>
        {accounts.map((option, index) => (
          <ListRow
            key={option.id}
            title={option.name}
            subtitle={formatMoney(option.balance, { hidden })}
            showDivider={index > 0}
            right={<InstitutionBadge institution={getInstitution(option)} size={30} />}
            onPress={() => {
              update(sheet === 'toAccount' ? 'toAccountId' : 'accountId', option.id);
              setSheet(null);
            }}
          />
        ))}
      </OptionSheet>

      <OptionSheet visible={sheet === 'category'} title={draft.type === 'income' ? 'Categoría del ingreso' : 'Categoría del gasto'} onClose={() => setSheet(null)}>
        <View style={styles.categoryGrid}>
          {categories.filter((item) => item.kind === (draft.type === 'income' ? 'income' : 'expense')).map((option) => {
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

function EmptyIcon({ icon }: { icon: 'creditcard' | 'arrow.left.arrow.right' | 'square.grid.2x2.fill' | 'calendar' }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
      <Icon name={icon} size={15} color={colors.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fields: { paddingVertical: 4 },
  footer: { paddingHorizontal: screenPadding, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  categoryCell: { width: '33.333%', padding: 4 },
  categoryCard: { alignItems: 'center', minHeight: 92, justifyContent: 'center' },
  quickDates: { flexDirection: 'row', gap: 8 },
  calendarNav: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  emptyIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saved: { alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 32 },
  check: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  savedText: { maxWidth: 300 },
});
