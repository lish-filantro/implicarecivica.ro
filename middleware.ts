import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { CookieOptions } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Skip middleware if Supabase credentials are not configured (development mode)
  const hasSupabaseCredentials =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');

  if (!hasSupabaseCredentials) {
    // In development without real Supabase, allow all routes
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Campanii pages are hidden — redirect to homepage
  if (request.nextUrl.pathname.startsWith('/campanii')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Redirect /chatbot to /chat
  if (request.nextUrl.pathname.startsWith('/chatbot')) {
    const url = request.nextUrl.clone()
    url.pathname = request.nextUrl.pathname.replace('/chatbot', '/chat')
    return NextResponse.redirect(url)
  }

  // Protected routes - require authentication
  const protectedRoutes = ['/chat', '/dashboard', '/requests', '/emails', '/settings', '/feedback']
  const isProtectedRoute = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route))

  // Auth routes - redirect to dashboard if already logged in
  const authRoutes = ['/login', '/register', '/verify', '/reset-password']
  const isAuthRoute = authRoutes.some(route => request.nextUrl.pathname.startsWith(route))

  // /reset-password/confirm needs to be accessible when logged in (after recovery callback)
  const isPasswordConfirm = request.nextUrl.pathname.startsWith('/reset-password/confirm')

  if (isProtectedRoute && !user) {
    // Redirect to login if accessing protected route without auth
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectedFrom', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Check if approved user (for protected routes, excluding pending-approval page itself)
  const isPendingPage = request.nextUrl.pathname === '/pending-approval'
  if (user && (isProtectedRoute || isPendingPage)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('approved')
      .eq('id', user.id)
      .single()

    if (profile && !profile.approved && !isPendingPage) {
      // Unapproved user trying to access protected route
      return NextResponse.redirect(new URL('/pending-approval', request.url))
    }
    if (profile?.approved && isPendingPage) {
      // Approved user on pending page — send to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (isAuthRoute && !isPasswordConfirm && user) {
    // Redirect to dashboard if accessing auth route while logged in
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Admin routes - require authentication
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  if (isAdminRoute && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectedFrom', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Campanii admin routes - require authentication
  const isCampaniiAdmin = request.nextUrl.pathname.startsWith('/campanii/admin') &&
    !request.nextUrl.pathname.startsWith('/campanii/admin/login')

  if (isCampaniiAdmin && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/campanii/admin/login'
    url.searchParams.set('redirectedFrom', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from campanii login
  if (request.nextUrl.pathname === '/campanii/admin/login' && user) {
    return NextResponse.redirect(new URL('/campanii/admin', request.url))
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
