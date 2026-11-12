/** Planificación: promedios, flujos por mes y gasto por categoría (calculados en PostgreSQL). */
import { fromDb } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { financeFailure } from '@/services/finance/errors';
import type { CategorySpending, MonthlyFlow, PlanningSnapshot } from '@/types/planning';

import { parsePlanning } from './mappers';

export async function fetchPlanningSnapshot(): Promise<PlanningSnapshot> {
  const { data, error } = await supabase.rpc('planning_snapshot', {});
  if (error) throw financeFailure('planning.snapshot', error);
  return parsePlanning((data ?? {}) as Record<string, unknown>);
}

/** Últimos meses (incluye el actual), del más antiguo al más reciente. */
export async function fetchMonthlyFlows(months = 6): Promise<MonthlyFlow[]> {
  const { data, error } = await supabase.rpc('monthly_flows', { p_months: months });
  if (error) throw financeFailure('planning.flows', error);
  return (data ?? []).map((row) => ({
    monthStart: row.month_start,
    income: fromDb(row.income),
    expense: fromDb(row.expense),
    fixedExpense: fromDb(row.fixed_expense),
    essentialExpense: fromDb(row.essential_expense),
    movements: Number(row.movements),
  }));
}

/** Gasto por categoría en el rango, el mayor primero. */
export async function fetchSpendingByCategory(from: string, to: string): Promise<CategorySpending[]> {
  const { data, error } = await supabase.rpc('spending_by_category', { p_from: from, p_to: to });
  if (error) throw financeFailure('planning.spending', error);
  return (data ?? []).map((row) => ({ categoryId: row.category_id, total: fromDb(row.total), movements: Number(row.movements) }));
}
