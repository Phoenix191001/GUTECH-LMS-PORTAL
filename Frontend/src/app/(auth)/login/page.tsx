import type { Metadata } from 'next'
import { Notice } from '@/components/ui/feedback'
import { LoginForm } from '@/features/auth/components/login-form'
import { isSupabaseConfigured } from '@/lib/env'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams
  return (
    <div className="animate-rise">
      <h1 className="font-display text-4xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">Sign in with the email and password from your administrator.</p>

      {!isSupabaseConfigured() && (
        <Notice tone="warning" className="mt-6">
          Supabase is not configured yet. Add your project URL and keys to <code>Frontend/.env.local</code>, then restart the dev server.
        </Notice>
      )}

      <div className="mt-8">
        <LoginForm
          next={next}
          initialError={error === 'disabled' ? 'Your account is disabled. Contact the administrator.' : undefined}
        />
      </div>
    </div>
  )
}
