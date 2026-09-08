/**
 * Browser-side profile queries (moved 1:1 from lib/supabase/profile-queries.ts).
 * The client is injectable for tests; components use the default browser client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@m544/shared/db/clients';
import type { Profile, ProfileUpdate } from '@m544/shared/types/profile';

export async function getProfile(sb: SupabaseClient = createBrowserClient()): Promise<Profile | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).single();
  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw error;
  }
  return data as Profile;
}

export async function updateProfile(
  updates: ProfileUpdate,
  sb: SupabaseClient = createBrowserClient(),
): Promise<Profile> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await sb.from('profiles').update(updates).eq('id', user.id).select().single();
  if (error) throw error;
  return data as Profile;
}
