'use client'

import { useCallback, useTransition } from 'react'
import { toast } from 'sonner'
import type { ActionResult } from '@/lib/action-types'

type RunOptions<T> = {
  /** Toast shown on success. */
  success?: string
  onSuccess?: (data: T) => void
  onError?: (error: string, fieldErrors?: Record<string, string[]>) => void
}

/**
 * Runs a server action inside a transition, toasts the outcome and exposes `pending`.
 * Server actions never throw to the UI; they return { ok, data | error }.
 */
export function useAction() {
  const [pending, startTransition] = useTransition()

  const run = useCallback(<T,>(fn: () => Promise<ActionResult<T>>, options: RunOptions<T> = {}) => {
    startTransition(async () => {
      let res: ActionResult<T>
      try {
        res = await fn()
      } catch {
        res = { ok: false, error: 'Network problem. Please check your connection and try again.' }
      }
      if (res.ok) {
        if (options.success) toast.success(options.success)
        options.onSuccess?.(res.data)
      } else {
        toast.error(res.error)
        options.onError?.(res.error, res.fieldErrors)
      }
    })
  }, [])

  return { pending, run }
}
