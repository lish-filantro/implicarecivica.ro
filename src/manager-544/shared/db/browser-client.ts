/**
 * Browser-side Supabase client for React components.
 * Kept in its own module: it must never import `next/headers`, which the
 * server/service clients in ./clients.ts need.
 */
import { createBrowserClient as createSsrBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createBrowserClient(): SupabaseClient {
  // NEXT_PUBLIC_* values are inlined at build time; keep direct access for the bundle.
  return createSsrBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
