'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { useAction } from '@/hooks/use-action'
import { requestPasswordReset } from '../actions'
import { forgotPasswordSchema, type ForgotPasswordInput } from '../schemas'

export function ForgotPasswordForm() {
  const { pending, run } = useAction()
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } })

  if (sent) {
    return (
      <div role="status" className="rounded-2xl border bg-card p-6 text-center shadow-[var(--shadow-soft)]">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-success-soft text-success">
          <MailCheck className="size-6" />
        </div>
        {/* Same message whether or not the account exists (no enumeration). */}
        <p className="font-medium">If an account exists for this email, a reset link has been sent.</p>
        <p className="mt-2 text-sm text-muted-foreground">The link works once and expires in 1 hour. Check your spam folder too.</p>
        <Link href="/login" className="mt-5 inline-block text-sm font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit((v) => run(() => requestPasswordReset(v), { onSuccess: () => setSent(true) }))} noValidate className="space-y-5">
      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          placeholder="you@school.edu"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-msg' : undefined}
          {...register('email')}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Send reset link
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  )
}
