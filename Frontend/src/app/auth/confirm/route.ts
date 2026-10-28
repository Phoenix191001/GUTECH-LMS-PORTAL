import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { RECOVERY_COOKIE } from '@/lib/supabase/middleware'

/**
 * Password-reset landing route. The e-mail template links here with ?token_hash=&type=recovery.
 * Links expire after 1 hour and work once; anything else lands on /auth/expired.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (!tokenHash || type !== 'recovery') return NextResponse.redirect(`${origin}/auth/expired`)

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
  if (error) return NextResponse.redirect(`${origin}/auth/expired`)

  // Recovery links only ever lead to the reset form (the `next` param is ignored on purpose).
  const response = NextResponse.redirect(`${origin}/reset-password`)
  // Marks this browser as being in a recovery session (read by the proxy and the reset action).
  response.cookies.set(RECOVERY_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: origin.startsWith('https'),
    path: '/',
    maxAge: 60 * 60,
  })
  return response
}
