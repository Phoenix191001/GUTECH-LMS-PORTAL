'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ActionError, authedAction, parse, publicAction, unwrap } from '@/lib/actions'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { publicEnv } from '@/lib/env'
import { RECOVERY_COOKIE } from '@/lib/supabase/middleware'
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
} from './schemas'

const GENERIC_LOGIN_ERROR = 'Invalid email or password'

/** Sign in with e-mail + password. One generic error for any failure so accounts cannot be enumerated. */
export async function signIn(input: LoginInput) {
  return publicAction('signIn', async () => {
    const { email, password } = parse(loginSchema, input)
    const admin = createAdminClient()

    const locked = unwrap(await admin.rpc('login_locked', { p_email: email }))
    if (locked) throw new ActionError('Too many failed attempts. Please wait 10 minutes before trying again.')

    const supabase = await createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      await admin.rpc('record_login_failure', { p_email: email })
      throw new ActionError(GENERIC_LOGIN_ERROR)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active, must_change_password')
      .eq('id', data.user.id)
      .maybeSingle()

    if (!profile || !profile.is_active) {
      await supabase.auth.signOut()
      throw new ActionError('Your account is disabled. Contact the administrator.')
    }

    await admin.rpc('clear_login_failures', { p_email: email })
    return { mustChangePassword: profile.must_change_password }
  })
}

/** Sign out and go to /login. Used as a form action from the topbar. */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  ;(await cookies()).delete(RECOVERY_COOKIE)
  redirect('/login')
}

/**
 * Always answers the same way, whether or not the account exists. Disabled accounts and
 * addresses over the 3-per-hour limit silently get no e-mail.
 */
export async function requestPasswordReset(input: ForgotPasswordInput) {
  return publicAction('requestPasswordReset', async () => {
    const { email } = parse(forgotPasswordSchema, input)
    try {
      const admin = createAdminClient()
      const { data: allowed } = await admin.rpc('reset_email_allowed', { p_email: email })
      if (allowed) {
        const supabase = await createClient()
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
        })
        if (error) console.error('[action:requestPasswordReset] send failed:', error.message)
      }
    } catch (e) {
      console.error('[action:requestPasswordReset]', e instanceof Error ? e.message : e)
    }
    return undefined
  })
}

/** Sets a new password after a recovery link or a forced first-login change. */
export async function completePasswordReset(input: ResetPasswordInput) {
  return authedAction('completePasswordReset', null, async ({ user, supabase }) => {
    const recovering = (await cookies()).get(RECOVERY_COOKIE)?.value === '1'
    if (!user.profile.must_change_password && !recovering) {
      throw new ActionError('This password reset link is not valid. Request a new one.')
    }
    const { password } = parse(resetPasswordSchema(user.email), input)

    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new ActionError(error.message.includes('same') ? 'Choose a password you have not used before.' : 'Could not update the password. Try again.')

    unwrap(await supabase.rpc('clear_must_change_password'))
    await supabase.auth.signOut({ scope: 'others' }) // old sessions on other devices are invalid
    ;(await cookies()).delete(RECOVERY_COOKIE)
    return undefined
  })
}

/** Profile page: requires the current password (re-authentication) first. */
export async function changePassword(input: ChangePasswordInput) {
  return authedAction('changePassword', null, async ({ user, supabase }) => {
    const { current, next } = parse(changePasswordSchema(user.email), input)

    const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: current })
    if (authError) throw new ActionError('Your current password is incorrect.', { current: ['Your current password is incorrect.'] })

    const { error } = await supabase.auth.updateUser({ password: next })
    if (error) throw new ActionError('Could not update the password. Try again.')
    await supabase.auth.signOut({ scope: 'others' })
    return undefined
  })
}
