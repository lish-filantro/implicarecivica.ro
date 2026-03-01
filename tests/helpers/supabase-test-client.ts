/**
 * Supabase Test Client — service role client for test operations
 *
 * Uses service role key to bypass RLS (same as webhook/cron handlers).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getTestSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }
    _client = createClient(url, key);
  }
  return _client;
}

/** Fixed test user ID — reused across all tests (valid UUIDv4) */
export const TEST_USER_ID = 'a0000000-e2e0-4000-a000-000000000001';
export const TEST_CITIZEN_EMAIL = 'test-cetatean@implicarecivica.ro';
export const TEST_INSTITUTION_EMAIL = 'test-institutie@primaria-test.ro';
export const TEST_INSTITUTION_NAME = 'Primăria Test (E2E)';
