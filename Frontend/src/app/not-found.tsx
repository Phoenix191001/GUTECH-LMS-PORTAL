import Link from 'next/link'
import { Compass } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-primary-soft text-primary-soft-foreground">
          <Compass className="size-7" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Error 404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">We can&apos;t find that page</h1>
        <p className="mt-2 text-muted-foreground">
          It may have moved, or you may not have access to it.
        </p>
        <Link href="/dashboard" className={buttonVariants({ className: 'mt-6' })}>
          Back to dashboard
        </Link>
      </div>
    </main>
  )
}
