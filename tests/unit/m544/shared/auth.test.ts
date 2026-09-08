/**
 * shared/auth — guards used by every route handler.
 *
 * Contract:
 *  - requireBearerSecret(request, envName): ok when `Authorization: Bearer <secret>`
 *    matches the (non-placeholder) env value; 401 otherwise; EnvError when env missing.
 *  - requireCronSecret(request)     = requireBearerSecret(request, 'CRON_SECRET')
 *  - requireWebhookSecret(request)  = requireBearerSecret(request, 'CLOUDFLARE_EMAIL_WEBHOOK_SECRET')
 *  - requireUser(deps): { user, supabase } or 401 response
 *  - requireAdmin(deps): user whose email is in ADMIN_EMAILS (comma separated,
 *    case-insensitive); 401 when not logged in, 403 when logged in but not admin;
 *    EnvError when ADMIN_EMAILS is missing in production; dev fallback list allowed
 *    outside production.
 *  All guards return a discriminated union { ok: true, ... } | { ok: false, response }.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import {
  requireBearerSecret,
  requireCronSecret,
  requireWebhookSecret,
  requireUser,
  requireAdmin,
} from '@m544/shared/auth';
import { EnvError } from '@m544/shared/env';

function req(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/x', { method: 'POST', headers });
}

const savedEnv = { ...process.env };
afterEach(() => {
  for (const k of ['CRON_SECRET', 'CLOUDFLARE_EMAIL_WEBHOOK_SECRET', 'ADMIN_EMAILS', 'VERCEL_ENV', 'NODE_ENV']) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});
beforeEach(() => {
  delete process.env.CRON_SECRET;
  delete process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET;
  delete process.env.ADMIN_EMAILS;
  delete process.env.VERCEL_ENV;
});

describe('requireBearerSecret', () => {
  it('accepts a matching bearer token', () => {
    process.env.CRON_SECRET = 'real-secret-123';
    const r = requireBearerSecret(req({ authorization: 'Bearer real-secret-123' }), 'CRON_SECRET');
    expect(r.ok).toBe(true);
  });

  it('rejects a wrong token with 401', async () => {
    process.env.CRON_SECRET = 'real-secret-123';
    const r = requireBearerSecret(req({ authorization: 'Bearer nope' }), 'CRON_SECRET');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it('rejects a missing header with 401', () => {
    process.env.CRON_SECRET = 'real-secret-123';
    const r = requireBearerSecret(req(), 'CRON_SECRET');
    expect(r.ok).toBe(false);
  });

  it('throws EnvError when the secret is not configured (never fails open)', () => {
    expect(() => requireBearerSecret(req({ authorization: 'Bearer anything' }), 'CRON_SECRET')).toThrow(EnvError);
  });

  it('throws EnvError when the secret is a placeholder', () => {
    process.env.CRON_SECRET = 'placeholder';
    expect(() => requireBearerSecret(req({ authorization: 'Bearer placeholder' }), 'CRON_SECRET')).toThrow(EnvError);
  });

  it('is not fooled by a token that is a prefix of the secret', () => {
    process.env.CRON_SECRET = 'real-secret-123';
    const r = requireBearerSecret(req({ authorization: 'Bearer real-secret' }), 'CRON_SECRET');
    expect(r.ok).toBe(false);
  });
});

describe('requireCronSecret / requireWebhookSecret', () => {
  it('bind to the right variables', () => {
    process.env.CRON_SECRET = 'cron-abc';
    process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET = 'hook-xyz';
    expect(requireCronSecret(req({ authorization: 'Bearer cron-abc' })).ok).toBe(true);
    expect(requireCronSecret(req({ authorization: 'Bearer hook-xyz' })).ok).toBe(false);
    expect(requireWebhookSecret(req({ authorization: 'Bearer hook-xyz' })).ok).toBe(true);
  });
});

const alice = { id: 'u1', email: 'Alice@Example.ro' } as User;

function fakeSupabase(user: User | null) {
  return {
    auth: { getUser: async () => ({ data: { user }, error: user ? null : { message: 'no session' } }) },
  };
}

describe('requireUser', () => {
  it('returns the user and client when logged in', async () => {
    const r = await requireUser({ createClient: async () => fakeSupabase(alice) });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.user.id).toBe('u1');
      expect(r.supabase).toBeDefined();
    }
  });

  it('returns 401 when not logged in', async () => {
    const r = await requireUser({ createClient: async () => fakeSupabase(null) });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(401);
      expect(await r.response.json()).toEqual({ error: 'Neautorizat' });
    }
  });
});

describe('requireAdmin', () => {
  it('accepts a listed admin, case-insensitively', async () => {
    process.env.ADMIN_EMAILS = 'boss@example.ro, alice@example.ro';
    const r = await requireAdmin({ createClient: async () => fakeSupabase(alice) });
    expect(r.ok).toBe(true);
  });

  it('returns 403 for a logged-in non-admin', async () => {
    process.env.ADMIN_EMAILS = 'boss@example.ro';
    const r = await requireAdmin({ createClient: async () => fakeSupabase(alice) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(403);
  });

  it('returns 401 when not logged in', async () => {
    process.env.ADMIN_EMAILS = 'alice@example.ro';
    const r = await requireAdmin({ createClient: async () => fakeSupabase(null) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it('throws EnvError in production when ADMIN_EMAILS is missing', async () => {
    process.env.VERCEL_ENV = 'production';
    await expect(requireAdmin({ createClient: async () => fakeSupabase(alice) })).rejects.toThrow(EnvError);
  });

  it('outside production falls back to the dev admin list when ADMIN_EMAILS is missing', async () => {
    const r = await requireAdmin({
      createClient: async () => fakeSupabase({ id: 'dev', email: 'lishhop@protonmail.com' } as User),
    });
    expect(r.ok).toBe(true);
  });
});
