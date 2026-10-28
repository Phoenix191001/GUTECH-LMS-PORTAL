'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, LogOut, Monitor, Moon, Sun, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/shared/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/dialog'
import { Field, Input, PasswordInput } from '@/components/ui/form'
import { Progress } from '@/components/ui/feedback'
import { PasswordMeter } from '@/features/auth/components/password-meter'
import { changePassword } from '@/features/auth/actions'
import { changePasswordSchema, type ChangePasswordInput } from '@/features/auth/schemas'
import { useAction } from '@/hooks/use-action'
import { validateFile } from '@/lib/files'
import { createClient } from '@/lib/supabase/client'
import { uploadToSignedUrl } from '@/lib/upload'
import { cn } from '@/lib/utils'
import { createAvatarUpload, removeAvatar, saveAvatar, signOutOtherDevices, updateProfileName } from '../actions'

/** Avatar with change / remove. Uploads go browser -> private Storage bucket via a signed URL. */
export function AvatarEditor({ name, avatarUrl, hasAvatar }: { name: string; avatarUrl: string | null; hasAvatar: boolean }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    const problem = validateFile('avatars', { name: file.name, size: file.size, type: file.type })
    if (problem) return void toast.error(problem)

    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    setProgress(0)
    try {
      const ticket = await createAvatarUpload({ fileName: file.name, fileSize: file.size, mimeType: file.type })
      if (!ticket.ok) throw new Error(ticket.error)
      await uploadToSignedUrl('avatars', ticket.data, file, setProgress, { upsert: true })
      const saved = await saveAvatar({ path: ticket.data.path })
      if (!saved.ok) {
        await createClient().storage.from('avatars').remove([ticket.data.path])
        throw new Error(saved.error)
      }
      toast.success('Profile picture updated')
      router.refresh()
    } catch (e) {
      setPreview(null)
      toast.error(e instanceof Error ? e.message : 'Could not upload the picture.')
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        <Avatar name={name} src={preview ?? avatarUrl} size="xl" className="ring-4 ring-primary-soft" />
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label="Change profile picture"
          className="absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-glow)] ring-2 ring-card transition hover:bg-primary-hover"
        >
          <Camera className="size-4" />
        </button>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      <div className="min-w-0 space-y-2">
        <p className="text-sm text-muted-foreground">PNG, JPG or WEBP up to 2 MB.</p>
        {progress !== null && <Progress value={progress} className="w-40" />}
        {hasAvatar && progress === null && (
          <ConfirmDialog
            trigger={<Button variant="ghost" size="sm" className="-ml-2 text-danger hover:bg-danger-soft"><Trash2 /> Remove picture</Button>}
            title="Remove your profile picture?"
            description="Your initials will be shown instead."
            confirmLabel="Remove"
            onConfirm={async () => {
              const res = await removeAvatar()
              if (res.ok) {
                setPreview(null)
                toast.success('Picture removed')
                router.refresh()
              } else toast.error(res.error)
            }}
          />
        )}
      </div>
    </div>
  )
}

export function NameForm({ fullName }: { fullName: string }) {
  const router = useRouter()
  const { pending, run } = useAction()
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<{ fullName: string }>({ defaultValues: { fullName } })

  return (
    <form
      noValidate
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={handleSubmit((v) => run(() => updateProfileName(v), { success: 'Name updated', onSuccess: () => router.refresh() }))}
    >
      <Field label="Full name" htmlFor="pf-name" error={errors.fullName?.message} className="flex-1">
        <Input id="pf-name" autoComplete="name" maxLength={120} {...register('fullName', { required: 'Enter your full name', minLength: { value: 2, message: 'Enter your full name' } })} />
      </Field>
      <Button type="submit" loading={pending} disabled={!isDirty}>Save name</Button>
    </form>
  )
}

/** Change password: re-authenticates with the current password first, then applies the shared password policy. */
export function ChangePasswordForm({ email }: { email: string }) {
  const { pending, run } = useAction()
  const schema = useMemo(() => changePasswordSchema(email), [email])
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(schema), defaultValues: { current: '', next: '', confirm: '' } })
  const next = useWatch({ control, name: 'next' })

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit((v) =>
        run(() => changePassword(v), {
          success: 'Password changed. Other devices were signed out.',
          onSuccess: () => reset(),
          onError: (_msg, fields) => fields?.current && setError('current', { message: fields.current[0] }),
        }),
      )}
    >
      <Field label="Current password" htmlFor="cp-current" error={errors.current?.message}>
        <PasswordInput id="cp-current" autoComplete="current-password" aria-invalid={!!errors.current} {...register('current')} />
      </Field>
      <Field label="New password" htmlFor="cp-next" error={errors.next?.message}>
        <PasswordInput id="cp-next" autoComplete="new-password" aria-invalid={!!errors.next} {...register('next')} />
      </Field>
      <PasswordMeter password={next} email={email} />
      <Field label="Confirm new password" htmlFor="cp-confirm" error={errors.confirm?.message}>
        <PasswordInput id="cp-confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register('confirm')} />
      </Field>
      <Button type="submit" loading={pending}>Change password</Button>
    </form>
  )
}

export function ThemeCard() {
  const { theme, setTheme } = useTheme()
  const options = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Follows your device by default.</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
          {options.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border-2 py-4 text-sm font-medium transition-colors',
                theme === value ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              <Icon className="size-5" /> {label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function SignOutOthersButton() {
  const { pending, run } = useAction()
  return (
    <Button variant="outline" loading={pending} onClick={() => run(() => signOutOtherDevices(), { success: 'Signed out of all other devices' })}>
      <LogOut /> Sign out of other devices
    </Button>
  )
}
