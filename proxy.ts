import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_ONLY_PREFIXES = [
  '/dashboard',
  '/containers',
  '/orders',
  '/shipments',
  '/warehouses',
  '/products',
  '/dealers',
  '/payments',
  '/messages',
  '/queries',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Unauthenticated: only /sign-in is allowed
  if (!user) {
    if (pathname === '/sign-in') return supabaseResponse
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  // Authenticated: fetch role from public.users
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role

  // No role mapped — sign out and bounce with error param
  if (!role) {
    await supabase.auth.signOut()
    const url = new URL('/sign-in', request.url)
    url.searchParams.set('error', 'no_role')
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.headers.getSetCookie().forEach((cookie) => {
      redirectResponse.headers.append('Set-Cookie', cookie)
    })
    return redirectResponse
  }

  // Admin trying to reach dealer portal → send back to admin dashboard
  if (role === 'admin' && pathname.startsWith('/portal')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Dealer trying to reach any admin-only path → send to dealer portal
  if (role === 'dealer') {
    const isAdminPath = ADMIN_ONLY_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    )
    if (isAdminPath) {
      return NextResponse.redirect(new URL('/portal', request.url))
    }
  }

  // Authenticated user landing on sign-in page → redirect to their home
  if (pathname === '/sign-in') {
    const home = role === 'admin' ? '/dashboard' : '/portal'
    return NextResponse.redirect(new URL(home, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}