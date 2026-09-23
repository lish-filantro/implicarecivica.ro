/**
 * GET /auth/callback — exchanges the Supabase PKCE `code` for a session and
 * redirects to `next`. `next` is only honoured when it is a same-origin
 * relative path; anything else (absolute URL, protocol-relative "//host",
 * "/\host") falls back to the dashboard (POST_LOGIN_PATH, same as a plain
 * login) so the callback cannot be used as an open redirect.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { withErrorBoundary } from '@m544/shared/http';
import { createServerClient } from '@m544/shared/db/clients';
import { POST_LOGIN_PATH } from '@m544/shared/auth/middleware';
import { isSafeRelativePath } from '@m544/shared/auth/safe-path';

export const DEFAULT_NEXT = POST_LOGIN_PATH;
export const CALLBACK_ERROR_PATH = '/login?error=auth_callback_failed';

/** Structural subset of SupabaseClient used by the callback (keeps tests free of the real client). */
export interface CallbackClient {
  auth: {
    exchangeCodeForSession(code: string): Promise<{ error: unknown }>;
  };
}

export interface CallbackDeps {
  createClient: () => Promise<CallbackClient>;
}

const defaultDeps = (): CallbackDeps => ({ createClient: () => createServerClient() });

/** A relative same-origin path, or the fallback when `next` could leave the site. */
export function safeNextPath(next: string | null | undefined, fallback = DEFAULT_NEXT): string {
  return isSafeRelativePath(next) ? next : fallback;
}

export function createAuthCallbackHandler(getDeps: () => CallbackDeps = defaultDeps) {
  return withErrorBoundary(async (request: NextRequest) => {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = safeNextPath(searchParams.get('next'));

    if (code) {
      const supabase = await getDeps().createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(`${origin}${CALLBACK_ERROR_PATH}`);
  }, 'auth/callback');
}
