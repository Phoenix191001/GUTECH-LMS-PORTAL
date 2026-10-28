import * as React from 'react'
import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-150 outline-none select-none disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-primary to-accent-pink text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 hover:-translate-y-0.5',
        secondary: 'bg-muted text-foreground hover:bg-border/70',
        soft: 'bg-primary-soft text-primary-soft-foreground hover:brightness-95',
        outline: 'border-2 border-primary/25 bg-card text-foreground hover:border-primary/60 hover:bg-primary-soft',
        ghost: 'text-foreground hover:bg-muted',
        destructive: 'bg-danger text-white hover:brightness-110',
        link: 'text-primary underline-offset-4 hover:underline px-0 h-auto active:scale-100',
      },
      size: {
        sm: 'h-8 px-3 text-[0.8125rem]',
        md: 'h-10 px-4',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
)

export interface ButtonProps extends React.ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export function Button({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  )
}
