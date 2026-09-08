/**
 * shared/auth/middleware — pure routing decision used by middleware.ts.
 *
 * Rules (in order):
 *  1. /campanii*          → redirect '/'
 *  2. /chatbot*           → redirect same path with /chatbot → /chat
 *  3. protected & no user → /login?redirectedFrom=<path>
 *  4. user on protected or /pending-approval: approval gate
 *     - not approved (including NO profile row) & not pending page → /pending-approval
 *     - approved & pending page → /dashboard
 *  5. auth routes (except /reset-password/confirm) & user → /dashboard
 *  6. /admin* & no user   → /login?redirectedFrom=<path>
 *  7. otherwise next
 *
 * Plus: needsProfileLookup(pathname, user) says when middleware must query
 * profiles; shouldBypassAuth(env) allows the "no Supabase configured" skip
 * only outside production.
 */
import { describe, it, expect } from 'vitest';
import {
  decideRoute,
  needsProfileLookup,
  shouldBypassAuth,
  PROTECTED_ROUTES,
  AUTH_ROUTES,
  type RouteDecision,
} from '@m544/shared/auth/middleware';

const ORIGIN = 'https://implicarecivica.ro';
const user = { id: 'u1' };
const approved = { approved: true };
const unapproved = { approved: false };

function decide(pathname: string, u: { id: string } | null, profile?: { approved: boolean } | null, search = '') {
  return decideRoute({ pathname, user: u, profile, url: new URL(`${ORIGIN}${pathname}${search}`) });
}
const redirect = (to: string): RouteDecision => ({ action: 'redirect', to });
const NEXT: RouteDecision = { action: 'next' };

describe('route constants', () => {
  it('cover the same routes as the legacy middleware', () => {
    expect(PROTECTED_ROUTES).toEqual(['/chat', '/dashboard', '/requests', '/emails', '/settings', '/feedback']);
    expect(AUTH_ROUTES).toEqual(['/login', '/register', '/verify', '/reset-password']);
  });
});

describe('campanii and chatbot redirects (regardless of session)', () => {
  it.each([null, user])('/campanii* → / (user=%o)', (u) => {
    expect(decide('/campanii', u, approved)).toEqual(redirect(`${ORIGIN}/`));
    expect(decide('/campanii/admin/login', u, approved)).toEqual(redirect(`${ORIGIN}/`));
    expect(decide('/campanii/abc?x=1', u, approved)).toEqual(redirect(`${ORIGIN}/`));
  });

  it.each([null, user])('/chatbot* → /chat*, keeping the query (user=%o)', (u) => {
    expect(decide('/chatbot', u, approved)).toEqual(redirect(`${ORIGIN}/chat`));
    expect(decide('/chatbot/x', u, approved, '?q=1')).toEqual(redirect(`${ORIGIN}/chat/x?q=1`));
  });
});

describe('protected routes', () => {
  it.each(PROTECTED_ROUTES)('%s without user → login with redirectedFrom', (route) => {
    const path = `${route}/sub`;
    expect(decide(path, null)).toEqual(redirect(`${ORIGIN}/login?redirectedFrom=${encodeURIComponent(path)}`));
  });

  it('keeps the existing query when redirecting to login', () => {
    expect(decide('/dashboard', null, undefined, '?tab=2')).toEqual(
      redirect(`${ORIGIN}/login?tab=2&redirectedFrom=%2Fdashboard`),
    );
  });

  it.each(PROTECTED_ROUTES)('%s with approved user → next', (route) => {
    expect(decide(route, user, approved)).toEqual(NEXT);
  });

  it.each(PROTECTED_ROUTES)('%s with unapproved user → /pending-approval', (route) => {
    expect(decide(route, user, unapproved)).toEqual(redirect(`${ORIGIN}/pending-approval`));
  });

  it.each(PROTECTED_ROUTES)('%s with user but NO profile row → /pending-approval (fix: missing profile = not approved)', (route) => {
    expect(decide(route, user, null)).toEqual(redirect(`${ORIGIN}/pending-approval`));
  });

  it('a user whose profile was not looked up is treated as not approved (fail closed)', () => {
    expect(decide('/dashboard', user, undefined)).toEqual(redirect(`${ORIGIN}/pending-approval`));
  });
});

describe('/pending-approval', () => {
  it('anonymous → next (public page)', () => {
    expect(decide('/pending-approval', null)).toEqual(NEXT);
  });
  it('unapproved or profile-less user → next', () => {
    expect(decide('/pending-approval', user, unapproved)).toEqual(NEXT);
    expect(decide('/pending-approval', user, null)).toEqual(NEXT);
  });
  it('approved user → /dashboard', () => {
    expect(decide('/pending-approval', user, approved)).toEqual(redirect(`${ORIGIN}/dashboard`));
  });
});

describe('auth routes', () => {
  it.each(AUTH_ROUTES)('%s anonymous → next', (route) => {
    expect(decide(route, null)).toEqual(NEXT);
  });

  it.each(AUTH_ROUTES)('%s logged in → /dashboard (query kept)', (route) => {
    expect(decide(route, user, approved, '?a=1')).toEqual(redirect(`${ORIGIN}/dashboard?a=1`));
  });

  it('logged-in user on an auth route is redirected even when unapproved (no profile lookup there)', () => {
    expect(decide('/login', user, undefined)).toEqual(redirect(`${ORIGIN}/dashboard`));
  });

  it('/reset-password/confirm stays reachable when logged in', () => {
    expect(decide('/reset-password/confirm', user, approved)).toEqual(NEXT);
    expect(decide('/reset-password/confirm', null)).toEqual(NEXT);
  });
});

describe('/admin*', () => {
  it('anonymous → login with redirectedFrom', () => {
    expect(decide('/admin/dashboard', null)).toEqual(
      redirect(`${ORIGIN}/login?redirectedFrom=%2Fadmin%2Fdashboard`),
    );
  });
  it('any logged-in user → next (the API enforces the admin list, not the middleware)', () => {
    expect(decide('/admin/dashboard', user, undefined)).toEqual(NEXT);
    expect(decide('/admin/dashboard', user, null)).toEqual(NEXT);
  });
});

describe('public routes', () => {
  it.each(['/', '/institutii', '/despre', '/quiz', '/api/chat-haiku', '/auth/callback'])(
    '%s → next for anonymous and logged-in users',
    (path) => {
      expect(decide(path, null)).toEqual(NEXT);
      expect(decide(path, user, undefined)).toEqual(NEXT);
    },
  );
});

describe('needsProfileLookup', () => {
  it('only for logged-in users on protected routes or the pending page', () => {
    expect(needsProfileLookup('/dashboard', user)).toBe(true);
    expect(needsProfileLookup('/pending-approval', user)).toBe(true);
    expect(needsProfileLookup('/dashboard', null)).toBe(false);
    expect(needsProfileLookup('/pending-approval', null)).toBe(false);
    expect(needsProfileLookup('/login', user)).toBe(false);
    expect(needsProfileLookup('/admin/dashboard', user)).toBe(false);
    expect(needsProfileLookup('/', user)).toBe(false);
  });
});

describe('shouldBypassAuth', () => {
  const creds = { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'anon' };

  it('never bypasses when credentials are present', () => {
    expect(shouldBypassAuth({ ...creds, vercelEnv: undefined })).toBe(false);
    expect(shouldBypassAuth({ ...creds, vercelEnv: 'production' })).toBe(false);
  });

  it('bypasses outside production when credentials are missing or placeholders', () => {
    expect(shouldBypassAuth({ vercelEnv: undefined })).toBe(true);
    expect(shouldBypassAuth({ supabaseUrl: 'https://placeholder.supabase.co', supabaseAnonKey: 'x', vercelEnv: 'development' })).toBe(true);
    expect(shouldBypassAuth({ supabaseUrl: 'https://x.supabase.co', vercelEnv: 'preview' })).toBe(true);
  });

  it('never bypasses in production, even without credentials', () => {
    expect(shouldBypassAuth({ vercelEnv: 'production' })).toBe(false);
    expect(shouldBypassAuth({ supabaseUrl: 'https://placeholder.supabase.co', supabaseAnonKey: 'x', vercelEnv: 'production' })).toBe(false);
  });
});
