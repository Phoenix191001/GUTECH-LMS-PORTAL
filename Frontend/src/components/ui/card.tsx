import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-3xl border-2 border-border/70 bg-card text-card-foreground shadow-[var(--shadow-soft)] transition-shadow', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-3 sm:p-6 sm:pb-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('font-display text-lg font-bold leading-tight', className)} {...props} />
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-3 sm:p-6 sm:pt-3', className)} {...props} />
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center gap-2 border-t p-4 sm:px-6', className)} {...props} />
}

export const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-muted-foreground',
        primary: 'bg-primary-soft text-primary-soft-foreground',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export function Badge({ className, tone, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

export type Tone = NonNullable<VariantProps<typeof badgeVariants>['tone']>
