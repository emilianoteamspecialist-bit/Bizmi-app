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

  if (session && isAuthRoute) {
    // Redirect authenticated users to the generic dashboard
    // Server components will handle routing them to the correct role dashboard
    const redirectUrl = new URL('/dashboard', req.url)
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
