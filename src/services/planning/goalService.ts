/**
 * Metas de ahorro. Lo ahorrado lo calcula la vista savings_goal_progress.
 * Un aporte sin cuenta es una asignación (no crea dinero); con cuenta, el
 * servidor registra además una transferencia real entre cuentas propias.
 */
import type { Money } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { financeFailure } from '@/services/finance/errors';
import type { WriteOptions } from '@/services/transactions/transactionService';
import type { Goal, GoalKind, GoalMovement, GoalMovementKind } from '@/types/planning';

import { mapGoal, mapGoalMovement } from './mappers';

export async function fetchGoals(): Promise<Goal[]> {
  const [goals, progress] = await Promise.all([
    supabase.from('savings_goals').select('*').order('created_at', { ascending: true }),
    supabase.from('savings_goal_progress').select('*'),
  ]);
  if (goals.error) throw financeFailure('goals.fetch', goals.error);
  if (progress.error) throw financeFailure('goals.fetchProgress', progress.error);
  const byId = new Map(progress.data.map((row) => [row.goal_id, row]));
  return goals.data.map((row) => mapGoal(row, byId.get(row.id)));
}

/** Aportes y retiros (también los revertidos), del más reciente al más antiguo. */
export async function fetchGoalMovements(): Promise<GoalMovement[]> {
  const { data, error } = await supabase
    .from('savings_goal_movements')
    .select('*')
    .order('movement_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) throw financeFailure('goals.movements', error);
  return data.map(mapGoalMovement);
}

export type GoalInput = {
  name: string;
  target: Money;
  initialSaved: Money;
  startDate: string;
  targetDate: string | null;
  kind: GoalKind;
  accountId: string | null;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
};

export async function createGoal(input: GoalInput, requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_savings_goal', {
    p_name: input.name.trim(),
    p_target_amount: input.target,
    p_initial_saved: input.initialSaved,
    p_target_date: input.targetDate,
    p_start_date: input.startDate,
    p_kind: input.kind,
    p_account_id: input.accountId,
    p_description: input.description?.trim() || null,
    p_color: input.color ?? null,
    p_icon: input.icon ?? null,
    p_request_id: requestId,
  });
  if (error) throw financeFailure('goals.create', error);
  return data;
}

export async function updateGoal(goalId: string, input: GoalInput): Promise<void> {
  const { error } = await supabase.rpc('update_savings_goal', {
    p_goal_id: goalId,
    p_name: input.name.trim(),
    p_target_amount: input.target,
    p_initial_saved: input.initialSaved,
    p_target_date: input.targetDate,
    p_start_date: input.startDate,
    p_kind: input.kind,
    p_account_id: input.accountId,
    p_description: input.description?.trim() || null,
    p_color: input.color ?? null,
    p_icon: input.icon ?? null,
  });
  if (error) throw financeFailure('goals.update', error);
}

export async function setGoalArchived(goalId: string, archived: boolean): Promise<void> {
  const { error } = await supabase.rpc('archive_savings_goal', { p_goal_id: goalId, p_archived: archived });
  if (error) throw financeFailure('goals.archive', error);
}

/** Solo metas sin aportes; con historial, el servidor pide archivarla. */
export async function deleteGoal(goalId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_savings_goal', { p_goal_id: goalId });
  if (error) throw financeFailure('goals.delete', error);
}

export type GoalMovementInput = {
  goalId: string;
  kind: GoalMovementKind;
  amount: Money;
  date: string;
  note?: string | null;
  /** Cuenta desde la que sale (aporte) o a la que vuelve (retiro) el dinero. */
  accountId?: string | null;
};

export async function addGoalMovement(input: GoalMovementInput, requestId: string, options: WriteOptions = {}): Promise<string> {
  const { data, error } = await supabase.rpc('add_goal_movement', {
    p_goal_id: input.goalId,
    p_kind: input.kind,
    p_amount: input.amount,
    p_movement_date: input.date,
    p_note: input.note?.trim() || null,
    p_account_id: input.accountId ?? null,
    p_request_id: requestId,
    p_allow_negative: options.allowNegative ?? false,
  });
  if (error) throw financeFailure('goals.addMovement', error);
  return data;
}

export async function updateGoalMovement(
  movementId: string,
  input: { amount: Money; date: string; note?: string | null },
  options: WriteOptions = {},
): Promise<void> {
  const { error } = await supabase.rpc('update_goal_movement', {
    p_movement_id: movementId,
    p_amount: input.amount,
    p_movement_date: input.date,
    p_note: input.note?.trim() || null,
    p_allow_negative: options.allowNegative ?? false,
  });
  if (error) throw financeFailure('goals.updateMovement', error);
}

/** Revierte el aporte o retiro (y anula su transferencia, si la hubo). */
export async function voidGoalMovement(movementId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('void_goal_movement', { p_movement_id: movementId, p_reason: reason?.trim() || null });
  if (error) throw financeFailure('goals.voidMovement', error);
}
