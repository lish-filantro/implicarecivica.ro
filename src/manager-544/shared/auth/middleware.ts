/**
 * Pure routing decision for middleware.ts. No I/O, no Node-only imports:
 * this module runs in the Edge runtime.
 *
 * middleware.ts refreshes the Supabase session, calls `needsProfileLookup`
 * to decide whether to fetch `profiles.approved`, then applies `decideRoute`.
 */

export const PROTECTED_ROUTES = ['/chat', '/dashboard', '/requests', '/emails', '/settings', '/feedback'] as const;
export const AUTH_ROUTES = ['/login', '/register', '/verify', '/reset-password'] as const;
const PASSWORD_CONFIRM = '/reset-password/confirm';
const PENDING_PAGE = '/pending-approval';

export interface RouteUser {
  id: string;
  email?: string | null;
}
export interface RouteProfile {
  approved: boolean;
}

export interface RouteDecisionInput {
  pathname: string;
  user: RouteUser | null;
  /** `null` = no profile row; `undefined` = not looked up (only valid when !needsProfileLookup). */
  profile: RouteProfile | null | undefined;
  /** Full request URL; redirects are built from it so the query string survives. */
  url: URL;
  /** Lower-cased admin logins (see parseAdminEmails). Only consulted under /admin. */
  adminEmails?: string[];
}

/** Admins used before ADMIN_EMAILS existed; only honoured outside production. */
const DEV_ADMIN_EMAILS = ['lishhop@protonmail.com'];

/** ADMIN_EMAILS → lower-cased list. Empty in production means nobody (fail closed). */
export function parseAdminEmails(raw: string | undefined, production: boolean): string[] {
  const list = (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
  if (list.length > 0) return list;
  return production ? [] : DEV_ADMIN_EMAILS;
}

export type RouteDecision = { action: 'next' } | { action: 'redirect'; to: string };

const NEXT: RouteDecision = { action: 'next' };
const startsWithAny = (pathname: string, prefixes: readonly string[]) =>
  prefixes.some((p) => pathname.startsWith(p));

function redirect(url: URL, pathname: string, extraParams?: Record<string, string>): RouteDecision {
  const target = new URL(url);
  target.pathname = pathname;
  for (const [k, v] of Object.entries(extraParams ?? {})) target.searchParams.set(k, v);
  return { action: 'redirect', to: target.toString() };
}

const toLogin = (url: URL, from: string) => redirect(url, '/login', { redirectedFrom: from });
const toPath = (url: URL, pathname: string) => ({ action: 'redirect', to: new URL(pathname, url).toString() }) as const;

export const isProtectedRoute = (pathname: string) => startsWithAny(pathname, PROTECTED_ROUTES);
export const isAuthRoute = (pathname: string) => startsWithAny(pathname, AUTH_ROUTES);

/** The profile is needed only for a logged-in user on a protected route or the pending page. */
export function needsProfileLookup(pathname: string, user: RouteUser | null): boolean {
  return user !== null && (isProtectedRoute(pathname) || pathname === PENDING_PAGE);
}

export function decideRoute(input: RouteDecisionInput): RouteDecision {
  const { pathname, user, profile, url } = input;
  if (pathname.startsWith('/campanii')) return toPath(url, '/');

  if (pathname.startsWith('/chatbot')) return redirect(url, pathname.replace('/chatbot', '/chat'));

  const isProtected = isProtectedRoute(pathname);
  if (isProtected && !user) return toLogin(url, pathname);

  const isPendingPage = pathname === PENDING_PAGE;
  if (user && (isProtected || isPendingPage)) {
    // A missing profile row (or one we could not read) is NOT an approved user.
    const approved = profile?.approved === true;
    if (!approved && !isPendingPage) return toPath(url, PENDING_PAGE);
    if (approved && isPendingPage) return toPath(url, '/dashboard');
  }

  if (isAuthRoute(pathname) && !pathname.startsWith(PASSWORD_CONFIRM) && user) return redirect(url, '/dashboard');

  if (pathname.startsWith('/admin')) {
    if (!user) return toLogin(url, pathname);
    const email = user.email?.toLowerCase() ?? '';
    if (!email || !(input.adminEmails ?? []).includes(email)) return toPath(url, '/dashboard');
  }

  return NEXT;
}

export interface MiddlewareEnv {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  vercelEnv?: string;
}

export function hasSupabaseCredentials(env: MiddlewareEnv): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey && !env.supabaseUrl.includes('placeholder'));
}

/**
 * Local development without Supabase may skip auth entirely. Production never
 * does: a misconfigured deployment must fail closed, not open.
 */
export function shouldBypassAuth(env: MiddlewareEnv): boolean {
  return env.vercelEnv !== 'production' && !hasSupabaseCredentials(env);
}
