'use client'

import { useState, useTransition } from 'react'
import { Eye } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/feedback'
import { LocalTime } from '@/components/shared/local-time'
import { cn } from '@/lib/utils'
import { getResourceViewers, type Viewer } from '../actions'

type Data = { seen: Viewer[]; notSeen: Viewer[]; total: number }

/** Teacher-only "Seen by 12 of 30" panel with a second tab for students who have not opened it. */
export function SeenByDialog({ resourceId, seenCount, title }: { resourceId: string; seenCount: number; title: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [tab, setTab] = useState<'seen' | 'unseen'>('seen')
  const [pending, start] = useTransition()

  const load = (open: boolean) => {
    if (!open) return
    start(async () => {
      const res = await getResourceViewers(resourceId)
      if (res.ok) setData(res.data)
      else toast.error(res.error)
    })
  }

  const list = tab === 'seen' ? data?.seen : data?.notSeen
  return (
    <Dialog onOpenChange={load}>
      <DialogTrigger asChild>
        <Button variant="soft" size="sm">
          <Eye /> Seen by {seenCount}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seen by</DialogTitle>
          <DialogDescription className="truncate">{title}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="text-sm font-medium" aria-live="polite">
            {data ? `${data.seen.length} of ${data.total} students` : 'Loading…'}
          </p>
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {(
              [
                ['seen', 'Seen'],
                ['unseen', 'Not seen yet'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn('rounded-lg py-2 text-sm font-medium transition', tab === key ? 'bg-card shadow-[var(--shadow-soft)]' : 'text-muted-foreground')}
              >
                {label}
              </button>
            ))}
          </div>
          {pending && !data ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : list && list.length > 0 ? (
            <ul className="divide-y rounded-xl border">
              {list.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{v.name}</span>
                    {v.rollNo && <span className="text-xs text-muted-foreground">{v.rollNo}</span>}
                  </span>
                  {v.seenAt && <LocalTime iso={v.seenAt} className="shrink-0 text-xs text-muted-foreground" />}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {tab === 'seen' ? 'Nobody has opened this yet.' : 'Everyone has seen this.'}
            </p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
