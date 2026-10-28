'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, Input, Select, SwitchField } from '@/components/ui/form'
import { useAction } from '@/hooks/use-action'
import { createUser, updateUser } from '../actions'
import { generateTempPassword } from '../password'
import { userFormSchema, type UserFormValues } from '../schemas'
import { createUserSchema, updateUserSchema } from '../schemas'

export type EditableUser = {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'teacher' | 'student'
  roll_no: string | null
  is_active: boolean
}

/** Add or edit a user. Creation sets a temporary password the user must change at first login. */
export function UserDialog({
  user,
  isSelf,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  user?: EditableUser
  isSelf?: boolean
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const editing = !!user
  const [innerOpen, setInnerOpen] = useState(false)
  const open = controlledOpen ?? innerOpen
  const setOpen = (v: boolean) => {
    setInnerOpen(v)
    onOpenChange?.(v)
  }
  const { pending, run } = useAction()

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      fullName: user?.full_name ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'student',
      rollNo: user?.roll_no ?? '',
      tempPassword: '',
      isActive: user?.is_active ?? true,
    },
  })
  const role = useWatch({ control, name: 'role' })

  const onSubmit = handleSubmit((v) => {
    // The server schemas are the single source of truth for the stricter rules.
    if (editing) {
      const payload = { id: user.id, fullName: v.fullName, role: v.role, rollNo: v.rollNo || undefined, isActive: v.isActive }
      const check = updateUserSchema.safeParse(payload)
      if (!check.success) return setError(check.error.issues[0]?.path[0] === 'rollNo' ? 'rollNo' : 'fullName', { message: check.error.issues[0]?.message })
      run(() => updateUser(payload), { success: 'User updated', onSuccess: () => { setOpen(false); router.refresh() } })
    } else {
      const payload = { fullName: v.fullName, email: v.email, role: v.role, rollNo: v.rollNo || undefined, tempPassword: v.tempPassword }
      const check = createUserSchema.safeParse(payload)
      if (!check.success) {
        const issue = check.error.issues[0]
        const field = (issue?.path[0] as keyof UserFormValues | undefined) ?? 'fullName'
        return setError(field, { message: issue?.message })
      }
      run(() => createUser(payload), {
        success: 'User created. Share the temporary password securely.',
        onSuccess: () => {
          setOpen(false)
          reset()
          router.refresh()
        },
      })
    }
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit user' : 'Add user'}</DialogTitle>
          <DialogDescription>
            {editing ? user.email : 'They will be asked to choose their own password at first sign-in.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            <Field label="Full name" htmlFor="u-name" required error={errors.fullName?.message}>
              <Input id="u-name" autoComplete="off" aria-invalid={!!errors.fullName} {...register('fullName')} />
            </Field>
            {!editing && (
              <Field label="Email" htmlFor="u-email" required error={errors.email?.message}>
                <Input id="u-email" type="email" inputMode="email" autoComplete="off" aria-invalid={!!errors.email} {...register('email')} />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Role" htmlFor="u-role" hint={isSelf ? 'You cannot change your own role.' : undefined}>
                {/* aria-disabled instead of `disabled`: a disabled <select> would drop out of the form values */}
                <Select
                  id="u-role"
                  aria-disabled={isSelf}
                  tabIndex={isSelf ? -1 : undefined}
                  className={isSelf ? 'pointer-events-none opacity-60' : undefined}
                  {...register('role')}
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </Select>
              </Field>
              {role === 'student' && (
                <Field label="Roll number" htmlFor="u-roll" error={errors.rollNo?.message}>
                  <Input id="u-roll" autoComplete="off" aria-invalid={!!errors.rollNo} {...register('rollNo')} />
                </Field>
              )}
            </div>

            {!editing && (
              <Field label="Temporary password" htmlFor="u-pass" required error={errors.tempPassword?.message} hint="At least 10 characters with a letter and a number.">
                <div className="flex gap-2">
                  <Input id="u-pass" autoComplete="off" spellCheck={false} className="font-mono" aria-invalid={!!errors.tempPassword} {...register('tempPassword')} />
                  <Button type="button" variant="outline" onClick={() => setValue('tempPassword', generateTempPassword(), { shouldValidate: true })}>
                    <Wand2 /> <span className="hidden sm:inline">Generate</span>
                    <span className="sr-only sm:hidden">Generate password</span>
                  </Button>
                </div>
              </Field>
            )}

            {editing && (
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <SwitchField
                    id="u-active"
                    label="Active"
                    description={isSelf ? 'You cannot deactivate yourself.' : 'Inactive users cannot sign in. Their marks and messages are kept.'}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSelf}
                  />
                )}
              />
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {editing ? 'Save changes' : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
