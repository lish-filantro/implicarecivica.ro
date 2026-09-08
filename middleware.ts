/**
 * Edge middleware: refreshes the Supabase session cookies, then applies the
 * pure routing rules from @m544/shared/auth/middleware (protected routes,
 * approval gate, auth-route redirects, /campanii and /chatbot redirects).
 *
 * NEXT_PUBLIC_* values are read directly here on purpose: this file runs in
 * the Edge runtime and those variables are inlined at build time.
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { CookieOptions } from '@supabase/ssr'
import { decideRoute, needsProfileLookup, shouldBypassAuth, type RouteProfile } from '@m544/shared/auth/middleware'

type CookieToSet = { name: string; value: string; options?: CookieOptions }

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const env = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
  }

  // Local development without Supabase: allow everything. Never in production.
  if (shouldBypassAuth(env)) {
    return supabaseResponse
  }

  const supabase = createServerClient(env.supabaseUrl ?? '', env.supabaseAnonKey ?? '', {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
      },
    },
  })

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // profiles.approved is only read when the decision depends on it
  let profile: RouteProfile | null | undefined
  if (user && needsProfileLookup(pathname, user)) {
    const { data } = await supabase.from('profiles').select('approved').eq('id', user.id).maybeSingle()
    profile = (data as RouteProfile | null) ?? null
  }

  const decision = decideRoute({ pathname, user, profile, url: new URL(request.url) })
  if (decision.action === 'redirect') {
    return NextResponse.redirect(decision.to)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
