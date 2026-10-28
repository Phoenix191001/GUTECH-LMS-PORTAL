import * as React from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer rounded-lg bg-[linear-gradient(90deg,var(--muted)_25%,color-mix(in_oklab,var(--muted)_55%,var(--card))_50%,var(--muted)_75%)] bg-[length:200%_100%]',
        className,
      )}
      {...props}
    />
  )
}

/** Generic list skeleton used by loading.tsx files. */
export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl border bg-card p-4">
          <Skeleton className="size-11 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="hidden h-6 w-16 rounded-full sm:block" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/60 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
        <Icon className="size-6" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this. Please try again.',
  action,
}: {
  title?: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-danger/30 bg-danger-soft px-6 py-12 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-card text-danger">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Progress({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-200"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  eyebrow?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow && <div className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</div>}
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight text-balance sm:text-[2rem]">{title}</h1>
        {description && <p className="max-w-2xl text-[0.9375rem] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Inline status block for form-level errors/successes. */
export function Notice({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'info' | 'danger' | 'success' | 'warning'
  children: React.ReactNode
  className?: string
}) {
  const tones = {
    info: 'bg-info-soft text-info',
    danger: 'bg-danger-soft text-danger',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
  }
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-xl px-4 py-3 text-sm', tones[tone], className)}>
      {children}
    </div>
  )
}
