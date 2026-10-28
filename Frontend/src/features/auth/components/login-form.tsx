'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, PasswordInput } from '@/components/ui/form'
import { Notice } from '@/components/ui/feedback'
import { useAction } from '@/hooks/use-action'
import { signIn } from '../actions'
import { loginSchema, safeNextPath, type LoginInput } from '../schemas'

export function LoginForm({ next, initialError }: { next?: string; initialError?: string }) {
  const router = useRouter()
  const { pending, run } = useAction()
  const [formError, setFormError] = useState<string | undefined>(initialError)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined)
    run(() => signIn(values), {
      onSuccess: (data) => {
        router.replace(data.mustChangePassword ? '/reset-password' : safeNextPath(next))
        router.refresh()
      },
      onError: setFormError,
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <Notice tone="danger">{formError}</Notice>}

      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoFocus
          placeholder="you@school.edu"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-msg' : undefined}
          {...register('email')}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          placeholder="Your password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-msg' : undefined}
          {...register('password')}
        />
      </Field>

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Sign in
      </Button>
    </form>
  )
}
