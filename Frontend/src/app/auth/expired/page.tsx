import Link from 'next/link'
import type { Metadata } from 'next'
import { LinkIcon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Link expired' }

export default function ExpiredLinkPage() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-2xl bg-warning-soft text-warning">
          <LinkIcon className="size-7" />
        </div>
        <h1 className="font-display text-3xl font-semibold">This link has expired</h1>
        <p className="mt-2 text-muted-foreground">
          Reset links work once and expire after 1 hour. Request a new one and use it right away.
        </p>
        <Link href="/forgot-password" className={buttonVariants({ className: 'mt-6' })}>
          Request a new link
        </Link>
      </div>
    </main>
  )
}
