import { cn, initials } from '@/lib/utils'

const SIZES = {
  xs: 'size-6 text-[0.625rem]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-24 text-3xl',
}

/** `src` is a signed URL (avatars live in a private bucket) or null for initials. */
export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string
  src?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft font-semibold text-primary-soft-foreground ring-2 ring-card',
        SIZES[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  )
}
