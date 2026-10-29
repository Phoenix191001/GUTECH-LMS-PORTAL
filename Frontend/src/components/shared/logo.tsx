import { cn } from '@/lib/utils'
import { BRAND } from '@/lib/brand'

/**
 * Official GUTECH logo, pre-cropped with equal padding on every side (public/gutech-logo.png).
 * Its background is exactly the theme red, so on red surfaces (tone="light") it blends in with no visible box.
 */
export function Logo({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'light' }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/gutech-logo.png"
      alt={BRAND.name + ' - Ghazali University School of Technology'}
      width={390}
      height={169}
      className={cn('block h-auto w-44 bg-sidebar', tone === 'light' ? 'rounded-none' : 'rounded-xl', className)}
    />
  )
}
