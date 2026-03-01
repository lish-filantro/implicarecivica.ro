import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase server client with cookie handling.
 * Used internally by admin auth functions.
 */
async function getSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component context
          }
        },
      },
    }
  );
}

/**
 * Verifies that the current request has a valid Supabase Auth session.
 * Any authenticated user has admin access to campaigns.
 */
export async function verifyAdminSession(): Promise<boolean> {
  try {
    const supabase = await getSupabaseServer();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    return !authError && !!user;
  } catch {
    return false;
  }
}

/**
 * Gets the current user if authenticated (admin or not).
 */
export async function getCurrentUser() {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}
