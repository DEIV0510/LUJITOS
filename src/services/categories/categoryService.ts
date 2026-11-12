/**
 * Categorías: las del sistema son de todos y nadie las modifica; las propias se
 * crean, editan, archivan o borran (con movimientos, solo reasignándolos).
 */
import { supabase } from '@/lib/supabase';
import { financeFailure } from '@/services/finance/errors';
import { mapCategory } from '@/services/finance/mappers';
import type { Tone } from '@/theme';
import type { Category, CategoryKind, IconName } from '@/types/finance';

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw financeFailure('categories.fetch', error);
  return data.map(mapCategory);
}

export type CategoryInput = { name: string; kind: CategoryKind; icon: IconName; tone: Tone };

export async function createCategory(userId: string, input: CategoryInput): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ user_id: userId, name: input.name.trim(), type: input.kind, icon: input.icon, color: input.tone, is_default: false })
    .select('*')
    .single();
  if (error) throw financeFailure('categories.create', error);
  return mapCategory(data);
}

/** El tipo (ingreso/gasto) no cambia: sus movimientos dependen de él. */
export async function updateCategory(categoryId: string, input: Omit<CategoryInput, 'kind'>): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ name: input.name.trim(), icon: input.icon, color: input.tone })
    .eq('id', categoryId);
  if (error) throw financeFailure('categories.update', error);
}

export async function setCategoryArchived(categoryId: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from('categories')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', categoryId);
  if (error) throw financeFailure('categories.archive', error);
}

/** Con movimientos, exige a qué categoría pasan (si no, el servidor responde «category_in_use»). */
export async function deleteCategory(categoryId: string, reassignTo?: string | null): Promise<void> {
  const { error } = await supabase.rpc('delete_category', { p_category_id: categoryId, p_reassign_to: reassignTo ?? null });
  if (error) throw financeFailure('categories.delete', error);
}
