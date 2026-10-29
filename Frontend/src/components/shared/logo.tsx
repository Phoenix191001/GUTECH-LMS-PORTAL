import { cn } from '@/lib/utils'
import { BRAND } from '@/lib/brand'

/**
 * Official GUTECH logo, pre-cropped with equal padding on every side (public/gutech-logo.png).
 * The PNG is white on a transparent background: on red surfaces (tone="light") it sits directly on them, on light surfaces it gets a red badge.
 */
export function Logo({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'light' }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/gutech-logo.png"
      alt={BRAND.name + ' - Ghazali University School of Technology'}
      width={390}
      height={169}
      className={cn('block h-auto w-44', tone === 'light' ? 'rounded-none' : 'rounded-xl bg-primary', className)}
    />
  )
}
