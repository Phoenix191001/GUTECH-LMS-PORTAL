import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form'

export const metadata: Metadata = { title: 'Forgot password' }

export default function ForgotPasswordPage() {
  return (
    <div className="animate-rise">
      <h1 className="font-display text-4xl font-semibold">Reset your password</h1>
      <p className="mt-2 text-muted-foreground">
        Enter your email and we will send you a link to choose a new password. If your email does not work, ask your administrator
        for a temporary password.
      </p>
      <div className="mt-8">
        <ForgotPasswordForm />
      </div>
    </div>
  )
}
