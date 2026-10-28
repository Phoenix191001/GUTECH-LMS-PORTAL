'use client'

import * as React from 'react'
import { Label as LabelPrimitive, Switch as SwitchPrimitive } from 'radix-ui'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

const fieldBase =
  'w-full rounded-xl border-2 border-input bg-card px-3.5 text-[0.9375rem] text-foreground shadow-[var(--shadow-soft)] outline-none transition placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger aria-invalid:ring-danger/20'

export function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  // 16px on small screens prevents iOS zoom-on-focus
  return <input type={type} className={cn(fieldBase, 'h-11 text-base sm:h-10 sm:text-[0.9375rem]', className)} {...props} />
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={cn(fieldBase, 'min-h-24 resize-y py-2.5 text-base sm:text-[0.9375rem]', className)} {...props} />
}

export function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(fieldBase, 'h-11 appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-9 text-base sm:h-10 sm:text-[0.9375rem]', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a8a9a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  )
}

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('text-sm font-medium leading-none text-foreground', className)} {...props} />
}

type FieldProps = {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}

/** Label + control + hint/error wiring (aria-describedby is set by the caller via `${htmlFor}-msg`). */
export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span aria-hidden className="ml-0.5 text-danger">*</span>}
      </Label>
      {children}
      {(error || hint) && (
        <p id={`${htmlFor}-msg`} role={error ? 'alert' : undefined} className={cn('text-[0.8125rem]', error ? 'text-danger' : 'text-muted-foreground')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  const [shown, setShown] = React.useState(false)
  return (
    <div className="relative">
      <Input type={shown ? 'text' : 'password'} className={cn('pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted-foreground transition hover:text-foreground"
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input transition-colors outline-none focus-visible:ring-4 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.375rem]" />
    </SwitchPrimitive.Root>
  )
}

/** A labelled switch row, usable inside react-hook-form via Controller or plain state. */
export function SwitchField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border bg-card p-3.5">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {description && <p className="text-[0.8125rem] text-muted-foreground">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}

export function Checkbox({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <input
      type="checkbox"
      className={cn('size-4.5 shrink-0 cursor-pointer rounded-md border-input accent-[var(--primary)]', className)}
      {...props}
    />
  )
}
