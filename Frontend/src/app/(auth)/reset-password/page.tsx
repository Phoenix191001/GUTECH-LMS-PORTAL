import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form'
import { signOut } from '@/features/auth/actions'
import { getAppUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Set a new password' }

export default async function ResetPasswordPage() {
  // The proxy only lets recovery sessions / forced changes reach this page.
  const user = await getAppUser()
  if (!user) redirect('/auth/expired')

  return (
    <div className="animate-rise">
      <h1 className="font-display text-4xl font-semibold">
        {user.profile.must_change_password ? 'Choose your own password' : 'Set a new password'}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {user.profile.must_change_password
          ? 'You are using a temporary password. Pick a new one to continue.'
          : 'Pick a strong password you have not used before. You will be signed out of other devices.'}
      </p>
      <div className="mt-8">
        <ResetPasswordForm email={user.email} />
      </div>
      <form action={signOut} className="mt-6 text-center">
        <Button type="submit" variant="link" className="text-muted-foreground">
          Sign out instead
        </Button>
      </form>
    </div>
  )
}
