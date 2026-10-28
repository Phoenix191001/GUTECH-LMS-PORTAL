import { cn } from '@/lib/utils'
import { BRAND } from '@/lib/brand'

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-9 place-items-center rounded-2xl bg-gradient-to-br from-accent-amber via-accent-pink to-primary rotate-3 text-white shadow-[var(--shadow-glow)]',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3c.6 3.2 3.4 4.6 3.4 8a3.4 3.4 0 0 1-6.8 0c0-1.2.4-2 1-2.8" />
        <path d="M5 14.5a7 7 0 0 0 14 0" />
      </svg>
    </span>
  )
}

export function Logo({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'light' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className={cn('font-display text-xl font-extrabold tracking-tight', tone === 'light' && 'text-white')}>
        {BRAND.name}
      </span>
    </span>
  )
}
