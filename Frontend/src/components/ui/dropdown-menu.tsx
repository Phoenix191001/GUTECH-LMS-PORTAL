'use client'

import * as React from 'react'
import { DropdownMenu as MenuPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export const DropdownMenu = MenuPrimitive.Root
export const DropdownMenuTrigger = MenuPrimitive.Trigger

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  align = 'end',
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 min-w-52 overflow-hidden rounded-xl border bg-popover p-1.5 text-foreground shadow-[var(--shadow-lift)] data-[state=open]:animate-pop',
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  )
}

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item> & { destructive?: boolean }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground',
        destructive && 'text-danger data-[highlighted]:bg-danger-soft [&_svg]:text-danger',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn('px-2.5 py-2 text-xs text-muted-foreground', className)} {...props} />
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('-mx-1 my-1.5 h-px bg-border', className)} {...props} />
}
