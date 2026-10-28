'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/feedback'

/** Global error boundary: friendly message for users, details stay in server logs. */
export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[ui-error]', error.digest ?? error.message)
  }, [error])

  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-lg place-items-center px-6">
      <ErrorState
        description="An unexpected error occurred. You can try again, and if it keeps happening let your administrator know."
        action={<Button onClick={reset}>Try again</Button>}
      />
    </main>
  )
}
