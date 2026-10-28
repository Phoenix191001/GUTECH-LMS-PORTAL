import { cn } from '@/lib/utils'
import { BRAND } from '@/lib/brand'

/** Official GUTECH logo (white on crimson). The PNG has generous padding, so it is cropped to the mark. */
export function Logo({ className }: { className?: string; tone?: 'default' | 'light' }) {
  return (
    <span className={cn('inline-block h-14 w-44 overflow-hidden rounded-2xl bg-primary', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/gutech-logo.png" alt={BRAND.name + ' - Ghazali University School of Technology'} className="size-full scale-[1.3] object-cover" />
    </span>
  )
}
