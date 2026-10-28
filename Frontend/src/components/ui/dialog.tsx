'use client'

import * as React from 'react'
import { AlertDialog as AlertPrimitive, Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

const overlay =
  'fixed inset-0 z-50 bg-[oklch(0.14_0.07_285/0.6)] backdrop-blur-[3px] data-[state=open]:animate-fade-in'

type Variant = 'modal' | 'drawer-right' | 'drawer-left'

const contentVariants: Record<Variant, string> = {
  // bottom sheet on phones, centred card from sm up
  modal:
    'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[88dvh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl',
  'drawer-right': 'inset-y-0 right-0 w-[min(100%,28rem)] rounded-l-2xl',
  'drawer-left': 'inset-y-0 left-0 w-[min(88%,20rem)]',
}

export function DialogContent({
  className,
  children,
  variant = 'modal',
  hideClose,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { variant?: Variant; hideClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden border bg-popover text-foreground shadow-[var(--shadow-lift)] outline-none data-[state=open]:animate-rise',
          contentVariants[variant],
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 border-b p-5 pr-14', className)} {...props} />
}

export function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex-1 overflow-y-auto p-5', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 border-t bg-muted/40 p-4 pb-safe sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('font-display text-xl font-semibold leading-tight', className)} {...props} />
}

export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-sm text-muted-foreground', className)} {...props} />
}

/**
 * Confirmation for destructive actions (delete, remove, deactivate). Optionally requires
 * typing a phrase (e.g. the assignment title) before the confirm button enables.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = true,
  requireText,
  onConfirm,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: React.ReactNode
  title: string
  description: React.ReactNode
  confirmLabel?: string
  destructive?: boolean
  requireText?: string
  onConfirm: () => Promise<void> | void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [innerOpen, setInnerOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [typed, setTyped] = React.useState('')
  const open = controlledOpen ?? innerOpen
  const setOpen = (v: boolean) => {
    setInnerOpen(v)
    onOpenChange?.(v)
    if (!v) setTyped('')
  }
  const locked = requireText !== undefined && typed.trim() !== requireText.trim()

  return (
    <AlertPrimitive.Root open={open} onOpenChange={setOpen}>
      {trigger && <AlertPrimitive.Trigger asChild>{trigger}</AlertPrimitive.Trigger>}
      <AlertPrimitive.Portal>
        <AlertPrimitive.Overlay className={overlay} />
        <AlertPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-2xl border bg-popover p-6 pb-safe shadow-[var(--shadow-lift)] outline-none data-[state=open]:animate-rise sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <AlertPrimitive.Title className="font-display text-xl font-semibold">{title}</AlertPrimitive.Title>
          <AlertPrimitive.Description asChild>
            <div className="mt-2 text-sm text-muted-foreground">{description}</div>
          </AlertPrimitive.Description>
          {requireText !== undefined && (
            <div className="mt-4 space-y-1.5">
              <label htmlFor="confirm-text" className="text-sm font-medium">
                Type <span className="font-semibold text-foreground">{requireText}</span> to confirm
              </label>
              <Input id="confirm-text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </div>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertPrimitive.Cancel asChild>
              <Button variant="outline" disabled={busy}>
                Cancel
              </Button>
            </AlertPrimitive.Cancel>
            <Button
              variant={destructive ? 'destructive' : 'default'}
              loading={busy}
              disabled={locked}
              onClick={async () => {
                setBusy(true)
                try {
                  await onConfirm()
                  setOpen(false)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertPrimitive.Content>
      </AlertPrimitive.Portal>
    </AlertPrimitive.Root>
  )
}
