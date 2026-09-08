/**
 * Supabase clients.
 *
 *  - createServerClient(): per-request client bound to the Next.js cookie store
 *    (Server Components, route handlers). Respects RLS as the logged-in user.
 *  - createBrowserClient(): client-side singleton-per-call for React components.
 *  - createServiceClient(): service-role client that bypasses RLS. Only for
 *    webhooks, cron and admin routes; never send it to the browser.
 */

import { createServerClient as createSsrServerClient, createBrowserClient as createSsrBrowserClient } from '@supabase/ssr';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { CookieOptions } from '@supabase/ssr';
import { requireEnv } from '@m544/shared/env';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

function publicConfig() {
  return {
    url: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  };
}

export async function createServerClient(): Promise<SupabaseClient> {
  const { url, anonKey } = publicConfig();
  const cookieStore = await cookies();

  return createSsrServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there and the
          // middleware refreshes the session instead.
        }
      },
    },
  });
}

export function createBrowserClient(): SupabaseClient {
  // NEXT_PUBLIC_* values are inlined at build time; keep direct access for the bundle.
  return createSsrBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export function createServiceClient(): SupabaseClient {
  return createSupabaseClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
