/**
 * shared/auth/callback — GET /auth/callback (Supabase PKCE code exchange).
 *
 * Contract:
 *  - ?code=... exchanged successfully → 307 to `${origin}${next}` (default /dashboard, like a login)
 *  - missing code or exchange error → 307 to /login?error=auth_callback_failed
 *  - `next` must be a same-origin relative path ("/..." but not "//..."),
 *    otherwise it falls back to /dashboard (open-redirect fix).
 */
import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { createAuthCallbackHandler, safeNextPath } from '@m544/shared/auth/callback';

function client(exchangeError: unknown = null) {
  const calls: string[] = [];
  return {
    calls,
    createClient: async () => ({
      auth: {
        exchangeCodeForSession: async (code: string) => {
          calls.push(code);
          return { error: exchangeError };
        },
      },
    }),
  };
}

const ORIGIN = 'https://implicarecivica.ro';
const req = (qs: string) => new NextRequest(`${ORIGIN}/auth/callback${qs}`);

describe('safeNextPath', () => {
  it('accepts same-origin relative paths', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard');
    expect(safeNextPath('/reset-password/confirm?x=1')).toBe('/reset-password/confirm?x=1');
    expect(safeNextPath('/')).toBe('/');
  });

  it('falls back to /dashboard for missing, external or protocol-relative values', () => {
    expect(safeNextPath(null)).toBe('/dashboard');
    expect(safeNextPath('')).toBe('/dashboard');
    expect(safeNextPath('https://evil.example')).toBe('/dashboard');
    expect(safeNextPath('//evil.example/x')).toBe('/dashboard');
    expect(safeNextPath('/\\evil.example')).toBe('/dashboard');
    expect(safeNextPath('javascript:alert(1)')).toBe('/dashboard');
    expect(safeNextPath('dashboard')).toBe('/dashboard');
  });
});

describe('GET /auth/callback', () => {
  it('exchanges the code and redirects to next', async () => {
    const c = client();
    const res = await createAuthCallbackHandler(() => c)(req('?code=abc123&next=/emails'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/emails`);
    expect(c.calls).toEqual(['abc123']);
  });

  it('defaults next to /dashboard', async () => {
    const res = await createAuthCallbackHandler(() => client())(req('?code=abc123'));
    expect(res.headers.get('location')).toBe(`${ORIGIN}/dashboard`);
  });

  it('redirects to login with an error when the exchange fails', async () => {
    const res = await createAuthCallbackHandler(() => client({ message: 'bad code' }))(req('?code=abc123'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGIN}/login?error=auth_callback_failed`);
  });

  it('redirects to login with an error when no code is present, without touching Supabase', async () => {
    const c = client();
    const res = await createAuthCallbackHandler(() => c)(req(''));
    expect(res.headers.get('location')).toBe(`${ORIGIN}/login?error=auth_callback_failed`);
    expect(c.calls).toEqual([]);
  });

  it('rejects an external next and lands on /dashboard instead', async () => {
    const res = await createAuthCallbackHandler(() => client())(req('?code=abc123&next=https://evil.example/phish'));
    expect(res.headers.get('location')).toBe(`${ORIGIN}/dashboard`);
    const res2 = await createAuthCallbackHandler(() => client())(req('?code=abc123&next=//evil.example'));
    expect(res2.headers.get('location')).toBe(`${ORIGIN}/dashboard`);
  });
});
