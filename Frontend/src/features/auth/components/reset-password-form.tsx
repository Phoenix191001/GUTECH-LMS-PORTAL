'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Field, PasswordInput } from '@/components/ui/form'
import { useAction } from '@/hooks/use-action'
import { completePasswordReset } from '../actions'
import { resetPasswordSchema, type ResetPasswordInput } from '../schemas'
import { PasswordMeter } from './password-meter'

export function ResetPasswordForm({ email }: { email: string }) {
  const router = useRouter()
  const { pending, run } = useAction()
  const schema = useMemo(() => resetPasswordSchema(email), [email])
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } })
  const password = useWatch({ control, name: 'password' })

  return (
    <form
      onSubmit={handleSubmit((v) =>
        run(() => completePasswordReset(v), {
          success: 'Password updated',
          onSuccess: () => {
            router.replace('/dashboard')
            router.refresh()
          },
        }),
      )}
      noValidate
      className="space-y-5"
    >
      <Field label="New password" htmlFor="password" error={errors.password?.message}>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          autoFocus
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-msg' : undefined}
          {...register('password')}
        />
      </Field>
      <PasswordMeter password={password} email={email} />
      <Field label="Confirm new password" htmlFor="confirm" error={errors.confirm?.message}>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          aria-invalid={!!errors.confirm}
          aria-describedby={errors.confirm ? 'confirm-msg' : undefined}
          {...register('confirm')}
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Save new password
      </Button>
    </form>
  )
}
