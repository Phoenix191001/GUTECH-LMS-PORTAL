import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Server-rendered pagination driven by ?page=. Keeps the other query params. */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params = {},
}: {
  page: number
  pageSize: number
  total: number
  basePath: string
  params?: Record<string, string | undefined>
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const href = (p: number) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }
  const link = (disabled: boolean) =>
    cn(buttonVariants({ variant: 'outline', size: 'sm' }), disabled && 'pointer-events-none opacity-50')
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Page {page} of {pages} · {total} total
      </p>
      <div className="flex gap-2">
        <Link href={href(page - 1)} className={link(page <= 1)} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined}>
          <ChevronLeft /> Previous
        </Link>
        <Link href={href(page + 1)} className={link(page >= pages)} aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : undefined}>
          Next <ChevronRight />
        </Link>
      </div>
    </nav>
  )
}

export function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(n) && n > 0 ? n : 1
}
