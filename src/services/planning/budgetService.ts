/**
 * Presupuestos. Lecturas con RLS (lo gastado lo calcula la vista budget_status);
 * crear, editar, archivar y borrar SOLO por funciones RPC.
 */
import type { Money } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { financeFailure } from '@/services/finance/errors';
import type { Budget, BudgetAlert, BudgetPeriod, BudgetPeriodTotal } from '@/types/planning';

import { mapBudget, mapBudgetAlert } from './mappers';

export async function fetchBudgets(): Promise<Budget[]> {
  const [budgets, status] = await Promise.all([
    supabase.from('budgets').select('*').order('created_at', { ascending: true }),
    supabase.from('budget_status').select('*'),
  ]);
  if (budgets.error) throw financeFailure('budgets.fetch', budgets.error);
  if (status.error) throw financeFailure('budgets.fetchStatus', status.error);
  const byId = new Map(status.data.map((row) => [row.budget_id, row]));
  return budgets.data.map((row) => mapBudget(row, byId.get(row.id)));
}

/** Avisos de los últimos 60 días (los más recientes primero). */
export async function fetchBudgetAlerts(): Promise<BudgetAlert[]> {
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('budget_alerts')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw financeFailure('budgets.alerts', error);
  return data.map(mapBudgetAlert);
}

export async function fetchBudgetHistory(budgetId: string, periods = 6): Promise<BudgetPeriodTotal[]> {
  const { data, error } = await supabase.rpc('budget_history', { p_budget_id: budgetId, p_periods: periods });
  if (error) throw financeFailure('budgets.history', error);
  return (data ?? []).map((row) => ({
    periodStart: row.period_start,
    periodEnd: row.period_end,
    spent: Number(row.spent),
    limit: Number(row.limit_amount),
    percentUsed: Number(row.percent_used),
  }));
}

export type BudgetInput = {
  /** null = presupuesto general. */
  categoryId: string | null;
  limit: Money;
  period: BudgetPeriod;
  startDate: string;
  endDate: string | null;
  name?: string | null;
  thresholds: number[];
};

function budgetArgs(input: BudgetInput) {
  return {
    p_category_id: input.categoryId,
    p_limit_amount: input.limit,
    p_period: input.period,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_name: input.name?.trim() || null,
    p_alert_thresholds: input.thresholds,
  };
}

export async function createBudget(input: BudgetInput, requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_budget', { ...budgetArgs(input), p_request_id: requestId });
  if (error) throw financeFailure('budgets.create', error);
  return data;
}

export async function updateBudget(budgetId: string, input: BudgetInput): Promise<void> {
  const { error } = await supabase.rpc('update_budget', { p_budget_id: budgetId, ...budgetArgs(input) });
  if (error) throw financeFailure('budgets.update', error);
}

export async function setBudgetArchived(budgetId: string, archived: boolean): Promise<void> {
  const { error } = await supabase.rpc('archive_budget', { p_budget_id: budgetId, p_archived: archived });
  if (error) throw financeFailure('budgets.archive', error);
}

/** Borra el presupuesto y sus avisos. Los movimientos no se tocan. */
export async function deleteBudget(budgetId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_budget', { p_budget_id: budgetId });
  if (error) throw financeFailure('budgets.delete', error);
}

export async function markAlertsSeen(alertIds: string[]): Promise<void> {
  if (alertIds.length === 0) return;
  const { error } = await supabase.from('budget_alerts').update({ seen_at: new Date().toISOString() }).in('id', alertIds);
  if (error) throw financeFailure('budgets.alertsSeen', error);
}
