/**
 * Route guards. Every guard returns a discriminated union so handlers can
 * `if (!guard.ok) return guard.response;` and otherwise use the typed payload.
 *
 * Secrets are read through shared/env: a missing or placeholder secret throws
 * EnvError (caught by withErrorBoundary as 500 "misconfigured"). Guards never
 * fail open.
 */

import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { httpError } from '@m544/shared/http';
import { requireSecret, optionalEnv, isProduction, EnvError } from '@m544/shared/env';
import { createServerClient } from '@m544/shared/db/clients';

export type GuardFailure = { ok: false; response: NextResponse };

/** Structural subset of SupabaseClient needed by the auth guards (keeps tests free of the real client). */
export interface AuthClient {
  auth: {
    getUser(): Promise<{ data: { user: User | null }; error: unknown }>;
  };
}

export interface AuthDeps<C extends AuthClient = AuthClient> {
  createClient: () => Promise<C>;
}

const defaultDeps: AuthDeps = { createClient: () => createServerClient() };

// ─── Shared-secret guards (cron, webhooks) ───────────────────────────────────

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export type SecretGuard = { ok: true } | GuardFailure;

export function requireBearerSecret(request: NextRequest, envName: string): SecretGuard {
  const expected = requireSecret(envName); // throws EnvError when missing/placeholder
  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!provided || !secretsMatch(provided, expected)) {
    return { ok: false, response: httpError(401, 'Unauthorized') };
  }
  return { ok: true };
}

export const requireCronSecret = (request: NextRequest): SecretGuard => requireBearerSecret(request, 'CRON_SECRET');

export const requireWebhookSecret = (request: NextRequest): SecretGuard =>
  requireBearerSecret(request, 'CLOUDFLARE_EMAIL_WEBHOOK_SECRET');

// ─── Session guards ──────────────────────────────────────────────────────────

export type UserGuard<C extends AuthClient> = { ok: true; user: User; supabase: C } | GuardFailure;

export async function requireUser<C extends AuthClient = AuthClient>(
  deps: AuthDeps<C> = defaultDeps as AuthDeps<C>,
): Promise<UserGuard<C>> {
  const supabase = await deps.createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, response: httpError(401, 'Neautorizat') };
  return { ok: true, user: data.user, supabase };
}

/** Admins used before ADMIN_EMAILS existed; only honoured outside production. */
const DEV_ADMIN_EMAILS = ['lishhop@protonmail.com'];

export function adminEmails(): string[] {
  const raw = optionalEnv('ADMIN_EMAILS');
  if (raw) return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (isProduction()) throw new EnvError('ADMIN_EMAILS', 'is required in production');
  return DEV_ADMIN_EMAILS;
}

export async function requireAdmin<C extends AuthClient = AuthClient>(
  deps: AuthDeps<C> = defaultDeps as AuthDeps<C>,
): Promise<UserGuard<C>> {
  const admins = adminEmails(); // throws before touching the session when misconfigured
  const guard = await requireUser(deps);
  if (!guard.ok) return guard;
  const email = guard.user.email?.toLowerCase();
  if (!email || !admins.includes(email)) {
    return { ok: false, response: httpError(403, 'Acces interzis') };
  }
  return guard;
}
