/**
 * Crear o editar un presupuesto: categoría de gasto (o general), límite,
 * período, fechas y avisos. Se guarda por RPC; el servidor valida todo otra vez.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/finance/Badges';
import { MoneyInput } from '@/components/finance/MoneyInput';
import { AppText } from '@/components/ui/AppText';
import { FinancialCard } from '@/components/ui/FinancialCard';
import { FilterChip, SelectField, TextField } from '@/components/ui/FormField';
import { Icon } from '@/components/ui/Icon';
import { OptionSheet } from '@/components/ui/OptionSheet';
import { ListRow } from '@/components/ui/Rows';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SuccessView } from '@/components/ui/SuccessView';
import { useFinanceData } from '@/features/data/FinanceDataProvider';
import { haptics } from '@/lib/haptics';
import { newRequestId } from '@/lib/ids';
import { nowInBogota } from '@/lib/dates';
import { errorMessage, isFinanceError } from '@/services/finance/errors';
import { useAppTheme } from '@/theme';
import type { Budget, BudgetPeriod } from '@/types/planning';

import { BUDGET_PERIOD_LABEL, DEFAULT_THRESHOLDS, THRESHOLD_OPTIONS } from './labels';
import { DateSheet, FormShell, Note, dateLabel } from './ui';
import { validateBudgetDraft, type BudgetDraft, type BudgetErrors } from './validation';

const PERIODS: { value: BudgetPeriod; label: string }[] = [
  { value: 'weekly', label: 'Semana' },
  { value: 'monthly', label: 'Mes' },
  { value: 'yearly', label: 'Año' },
  { value: 'custom', label: 'Fechas' },
];

type Sheet = 'category' | 'start' | 'end' | null;

export function BudgetForm({ budget, initialCategoryId }: { budget?: Budget; initialCategoryId?: string }) {
  const { colors, spacing } = useAppTheme();
  const today = nowInBogota().date;
  const { categories, getCategory, budgets, createBudget, updateBudget } = useFinanceData();
  const [requestId] = useState(newRequestId);
  const [categoryId, setCategoryId] = useState<string | null>(budget ? budget.categoryId : (initialCategoryId ?? null));
  const [draft, setDraft] = useState<BudgetDraft>(() => ({
    limit: budget?.limit ?? 0,
    period: budget?.period ?? 'monthly',
    startDate: budget?.startDate ?? today,
    endDate: budget?.endDate ?? null,
    thresholds: budget?.thresholds ?? DEFAULT_THRESHOLDS,
    name: budget?.name ?? '',
  }));
  const [errors, setErrors] = useState<BudgetErrors>({});
  const [sheet, setSheet] = useState<Sheet>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const update = <K extends keyof BudgetDraft>(key: K, value: BudgetDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    if (errors[key as keyof BudgetErrors]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const expenseCategories = categories.filter((c) => c.kind === 'expense' && (!c.archivedAt || c.id === budget?.categoryId));
  const category = categoryId ? getCategory(categoryId) : undefined;
  // Otro presupuesto activo igual (el servidor también lo impide).
  const duplicate =
    draft.period !== 'custom' &&
    budgets.some((b) => b.id !== budget?.id && !b.archivedAt && b.period === draft.period && b.categoryId === categoryId);

  const toggleThreshold = (value: number) => {
    haptics.selection();
    const next = draft.thresholds.includes(value) ? draft.thresholds.filter((t) => t !== value) : [...draft.thresholds, value];
    update('thresholds', next.sort((a, b) => a - b));
  };

  const save = async () => {
    const found = validateBudgetDraft(draft);
    setErrors(found);
    setSubmitError(null);
    if (Object.values(found).some(Boolean)) {
      haptics.error();
      return;
    }
    const input = { ...draft, categoryId, endDate: draft.endDate };
    setSubmitting(true);
    try {
      if (budget) await updateBudget(budget.id, input);
      else await createBudget(input, requestId);
    } catch (error) {
      haptics.error();
      setSubmitError(
        isFinanceError(error, 'duplicate_budget')
          ? 'Ya tienes un presupuesto activo para esa categoría y período. Edítalo o archívalo primero.'
          : errorMessage(error, 'No pudimos guardar el presupuesto.'),
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
        title={budget ? 'Presupuesto actualizado' : 'Presupuesto creado'}
        message="Lo gastado se calcula con tus movimientos reales."
      />
    );
  }

  return (
    <FormShell
      title={budget ? 'Editar presupuesto' : 'Nuevo presupuesto'}
      submitLabel={budget ? 'Guardar cambios' : 'Crear presupuesto'}
      submitting={submitting}
      onSubmit={save}
      error={submitError}
    >
      <FinancialCard padding={spacing.lg} style={styles.fields}>
        <SelectField
          label="Categoría"
          placeholder="Elegir categoría"
          value={category ? category.name : 'General · todos los gastos'}
          leading={
            category ? (
              <CategoryIcon category={category} size={34} />
            ) : (
              <View style={[styles.generalIcon, { backgroundColor: colors.primarySoft }]}>
                <Icon name="chart.pie.fill" size={16} color={colors.primary} />
              </View>
            )
          }
          onPress={() => setSheet('category')}
        />
        <TextField
          label="Nombre (opcional)"
          placeholder={category ? category.name : 'Presupuesto general'}
          value={draft.name}
          onChangeText={(text) => update('name', text)}
          maxLength={60}
          error={errors.name}
          showDivider
        />
      </FinancialCard>

      <MoneyInput label="Límite" value={draft.limit} onChange={(value) => update('limit', value)} error={errors.limit} />

      <View style={{ gap: spacing.md }}>
        <AppText variant="overline" color="textSecondary">
          Período
        </AppText>
        <SegmentedControl options={PERIODS} value={draft.period} onChange={(value) => update('period', value)} accessibilityLabel="Período" />
        <AppText variant="footnote" color="textSecondary">
          {draft.period === 'weekly'
            ? 'De lunes a domingo. Se reinicia cada semana.'
            : draft.period === 'monthly'
              ? 'Mes calendario. Se reinicia el día 1.'
              : draft.period === 'yearly'
                ? 'Año calendario, de enero a diciembre.'
                : 'Un solo período entre dos fechas (un viaje, una temporada).'}
        </AppText>
        <FinancialCard padding={spacing.lg} style={styles.fields}>
          <SelectField label="Empieza" placeholder="Elegir fecha" value={dateLabel(draft.startDate, today)} onPress={() => setSheet('start')} />
          <SelectField
            label={draft.period === 'custom' ? 'Termina' : 'Termina (opcional)'}
            value={draft.endDate ? dateLabel(draft.endDate, today) : undefined}
            placeholder={draft.period === 'custom' ? 'Elegir fecha' : 'Sin fecha final'}
            onPress={() => setSheet('end')}
            error={errors.endDate}
            showDivider
          />
        </FinancialCard>
      </View>

      <View style={{ gap: spacing.md }}>
        <AppText variant="overline" color="textSecondary">
          Avisarme al llegar a
        </AppText>
        <View style={styles.chips}>
          {THRESHOLD_OPTIONS.map((value) => (
            <FilterChip key={value} label={`${value} %`} selected={draft.thresholds.includes(value)} onPress={() => toggleThreshold(value)} />
          ))}
        </View>
        {errors.thresholds ? (
          <AppText variant="footnote" color="negative">
            {errors.thresholds}
          </AppText>
        ) : null}
        <AppText variant="footnote" color="textSecondary">
          Cada aviso llega una sola vez por período. Si superas el límite también te avisamos.
        </AppText>
      </View>

      {duplicate ? (
        <Note icon="exclamationmark.triangle">
          Ya tienes un presupuesto {BUDGET_PERIOD_LABEL[draft.period].toLowerCase()} activo para{' '}
          {category ? category.name : 'todos los gastos'}.
        </Note>
      ) : null}
      <Note>Solo cuentan los gastos reales. Las transferencias, los ingresos, los pagos de tarjeta y los movimientos anulados no.</Note>

      <OptionSheet visible={sheet === 'category'} title="Categoría" onClose={() => setSheet(null)}>
        <ListRow
          title="General"
          subtitle="Todos tus gastos"
          icon="chart.pie.fill"
          right={categoryId === null ? <Icon name="checkmark" size={16} color={colors.primary} weight="bold" /> : undefined}
          onPress={() => {
            setCategoryId(null);
            setSheet(null);
          }}
        />
        {expenseCategories.map((option) => (
          <ListRow
            key={option.id}
            title={option.name}
            icon={option.icon}
            tone={option.tone}
            showDivider
            right={categoryId === option.id ? <Icon name="checkmark" size={16} color={colors.primary} weight="bold" /> : undefined}
            onPress={() => {
              setCategoryId(option.id);
              setSheet(null);
            }}
          />
        ))}
      </OptionSheet>
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
        visible={sheet === 'end'}
        title="Termina"
        value={draft.endDate}
        today={today}
        onClose={() => setSheet(null)}
        onSelect={(date) => {
          update('endDate', date);
          setSheet(null);
        }}
        onClear={
          draft.period === 'custom'
            ? undefined
            : () => {
                update('endDate', null);
                setSheet(null);
              }
        }
        clearLabel="Sin fecha final"
      />
    </FormShell>
  );
}

const styles = StyleSheet.create({
  fields: { paddingVertical: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  generalIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
