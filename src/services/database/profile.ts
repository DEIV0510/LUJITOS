import { supabase } from '@/lib/supabase';
import type { ProfileRow, UserPreferencesRow } from '@/types/database';

import { dbFailure } from './errors';

export type Profile = ProfileRow;

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw dbFailure('profile.fetchProfile', error);
  return data;
}

type ProfilePatch = Partial<
  Pick<
    ProfileRow,
    'first_name' | 'last_name' | 'avatar_url' | 'currency' | 'country' | 'timezone' | 'onboarding_completed_at'
  >
>;

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select('*').single();
  if (error) throw dbFailure('profile.updateProfile', error);
  return data;
}

export async function completeOnboarding(
  userId: string,
  input: { firstName: string; lastName: string; country: string; currency: string; timezone: string },
): Promise<Profile> {
  return updateProfile(userId, {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    country: input.country,
    currency: input.currency,
    timezone: input.timezone,
    onboarding_completed_at: new Date().toISOString(),
  });
}

export async function fetchPreferences(userId: string): Promise<UserPreferencesRow | null> {
  const { data, error } = await supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw dbFailure('profile.fetchPreferences', error);
  return data;
}

export async function updatePreferences(
  userId: string,
  patch: Partial<Pick<UserPreferencesRow, 'theme' | 'notifications_enabled' | 'biometric_enabled' | 'hide_amounts'>>,
): Promise<void> {
  const { error } = await supabase.from('user_preferences').update(patch).eq('user_id', userId);
  if (error) throw dbFailure('profile.updatePreferences', error);
}
