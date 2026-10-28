import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'
import { isSupabaseConfigured, publicEnv } from '@/lib/env'

/** Cookie set by /auth/confirm after a recovery link is verified. */
export const RECOVERY_COOKIE = 'lms_recovery'

const PUBLIC_PATHS = ['/login', '/forgot-password', '/auth/confirm', '/auth/expired']
const GUEST_ONLY_PATHS = ['/login', '/forgot-password']

const matches = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`))

/**
 * Runs on every request (via src/proxy.ts):
 *  1. refreshes the Supabase session cookies,
 *  2. sends signed-out users to /login and signed-in users away from it,
 *  3. signs out deactivated accounts on their very next request,
 *  4. forces users with a temporary password to /reset-password,
 *  5. keeps /admin/* admin-only.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  if (!isSupabaseConfigured()) {
    // Before the Supabase keys are added, everything except the public pages shows the login
    // page (which explains what to configure) instead of crashing on a failed network call.
    const open = matches(request.nextUrl.pathname, PUBLIC_PATHS)
    if (open) return response
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  const env = publicEnv()
  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const redirect = (to: string, search = '') => {
    const url = request.nextUrl.clone()
    url.pathname = to
    url.search = search
    const redirected = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => redirected.cookies.set(c))
    return redirected
  }

  const path = request.nextUrl.pathname
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    if (matches(path, PUBLIC_PATHS)) return response
    const next = path === '/' ? '' : `?next=${encodeURIComponent(path + request.nextUrl.search)}`
    return redirect('/login', next)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, must_change_password')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    return matches(path, ['/login']) ? response : redirect('/login', '?error=disabled')
  }

  if (path === '/reset-password') {
    const recovering = request.cookies.get(RECOVERY_COOKIE)?.value === '1'
    return profile.must_change_password || recovering ? response : redirect('/dashboard')
  }
  if (profile.must_change_password) return redirect('/reset-password')

  if (matches(path, GUEST_ONLY_PATHS) || path === '/') return redirect('/dashboard')
  if (path.startsWith('/admin') && profile.role !== 'admin') return redirect('/dashboard')

  return response
}
