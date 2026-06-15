import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Refresh session if expired - required for Server Components
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const pathname = req.nextUrl.pathname

  // Protected routes that require authentication
  const isProtectedRoute = 
    pathname.startsWith('/dashboard') || 
    pathname.startsWith('/agency') || 
    pathname.startsWith('/freelancer') || 
    pathname.startsWith('/admin')

  // Auth routes that shouldn't be accessed if already logged in
  const isAuthRoute = 
    pathname.startsWith('/login') || 
    pathname.startsWith('/signup') || 
    pathname.startsWith('/reset-password')

  if (!session && isProtectedRoute) {
    // Redirect unauthenticated users to login
    const redirectUrl = new URL('/login', req.url)
    return NextResponse.redirect(redirectUrl)
  }

  // Admin authorisation at the edge. Previously /admin/* was gated by session
  // only — any logged-in user could reach the admin console; the role check
  // lived client-side in the login page. Enforce it here. (/admin/login is
  // exempt so admins can still sign in.)
  const isAdminRoute = pathname.startsWith('/admin') && pathname !== '/admin/login'
  if (session && isAdminRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, account_type')
      .eq('id', session.user.id)
      .maybeSingle()

    // Allow either flag — the codebase is inconsistent (role vs account_type),
    // so we accept either rather than risk locking out a legitimate admin.
    const isAdmin = profile?.role === 'admin' || profile?.account_type === 'admin'
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/freelancer/dashboard', req.url))
    }
  }

  if (session && isAuthRoute) {
    // Redirect authenticated users to the freelancer dashboard.
    // /freelancer/dashboard performs a role-check and redirects agency/admin users
    // to their own dashboards.
    const redirectUrl = new URL('/freelancer/dashboard', req.url)
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: [
    '/dashboard/:path*', 
    '/agency/:path*', 
    '/freelancer/:path*', 
    '/admin/:path*',
    '/login',
    '/signup',
    '/reset-password'
  ],
}
