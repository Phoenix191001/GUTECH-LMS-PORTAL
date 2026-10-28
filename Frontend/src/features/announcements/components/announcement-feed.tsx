'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Megaphone, Pencil, Pin, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/feedback'
import { Markdown } from '@/components/shared/markdown'
import { RelativeTime } from '@/components/shared/local-time'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/database'
import { deleteAnnouncement, markAnnouncementsRead } from '../actions'
import { AnnouncementDialog } from './announcement-dialog'

export type FeedItem = {
  id: string
  courseId: string | null
  courseCode: string | null
  authorId: string
  authorName: string
  title: string
  body: string
  isPinned: boolean
  createdAt: string
  read: boolean
}

const sortItems = (items: FeedItem[]) =>
  [...items].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.createdAt.localeCompare(a.createdAt))

/**
 * Announcement list with Realtime updates (INSERT/UPDATE/DELETE, RLS-filtered by the
 * database) and viewport-based read tracking that persists across devices.
 */
export function AnnouncementFeed({
  initial,
  courseId,
  globalOnly,
  currentUserId,
  role,
  emptyTitle = 'No announcements yet',
  emptyDescription = 'New announcements appear here as soon as they are posted.',
  emptyAction,
}: {
  initial: FeedItem[]
  /** Subscribe to one course; omit for the combined feed. */
  courseId?: string
  /** Only show global (course-less) announcements, including live ones. */
  globalOnly?: boolean
  currentUserId: string
  role: UserRole
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
}) {
  const router = useRouter()
  const [items, setItems] = useState(() => sortItems(initial))
  const [editing, setEditing] = useState<FeedItem | null>(null)
  const pendingReads = useRef(new Set<string>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setItems(sortItems(initial)), [initial])

  /* ---- read tracking (batched) ---- */
  const flushReads = useCallback(async () => {
    const ids = [...pendingReads.current]
    pendingReads.current.clear()
    if (ids.length === 0) return
    const res = await markAnnouncementsRead({ ids })
    if (res.ok) router.refresh() // updates the sidebar unread badge
  }, [router])

  const markRead = useCallback(
    (id: string) => {
      setItems((prev) => prev.map((i) => (i.id === id && !i.read ? { ...i, read: true } : i)))
      pendingReads.current.add(id)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flushReads(), 900)
    },
    [flushReads],
  )

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  /* ---- realtime ---- */
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`announcements:${courseId ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements', ...(courseId ? { filter: `course_id=eq.${courseId}` } : {}) },
        async (payload) => {
          if (payload.eventType === 'DELETE') {
            setItems((prev) => prev.filter((i) => i.id !== (payload.old as { id?: string }).id))
            return
          }
          const row = payload.new as { id: string; course_id: string | null; author_id: string; title: string; body: string; is_pinned: boolean; created_at: string }
          if (payload.eventType === 'UPDATE') {
            setItems((prev) => sortItems(prev.map((i) => (i.id === row.id ? { ...i, title: row.title, body: row.body, isPinned: row.is_pinned } : i))))
            return
          }
          if (globalOnly && row.course_id) return
          const [author, course] = await Promise.all([
            supabase.from('profile_directory').select('full_name').eq('id', row.author_id).maybeSingle(),
            row.course_id ? supabase.from('courses').select('code').eq('id', row.course_id).maybeSingle() : Promise.resolve({ data: null }),
          ])
          setItems((prev) =>
            prev.some((i) => i.id === row.id)
              ? prev
              : sortItems([
                  {
                    id: row.id,
                    courseId: row.course_id,
                    courseCode: course.data?.code ?? null,
                    authorId: row.author_id,
                    authorName: author.data?.full_name ?? 'Someone',
                    title: row.title,
                    body: row.body,
                    isPinned: row.is_pinned,
                    createdAt: row.created_at,
                    read: false,
                  },
                  ...prev,
                ]),
          )
          if (row.author_id !== currentUserId) toast.info(`New announcement: ${row.title}`)
          router.refresh()
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [courseId, globalOnly, currentUserId, router])

  if (items.length === 0) return <EmptyState icon={Megaphone} title={emptyTitle} description={emptyDescription} action={emptyAction} />

  return (
    <>
      <ul className="space-y-4" aria-live="polite">
        {items.map((item) => (
          <FeedCard
            key={item.id}
            item={item}
            canEdit={role === 'admin' || (item.authorId === currentUserId && item.courseId !== null)}
            onVisible={markRead}
            onEdit={() => setEditing(item)}
            onDeleted={() => {
              setItems((prev) => prev.filter((i) => i.id !== item.id))
              router.refresh()
            }}
          />
        ))}
      </ul>
      {editing && (
        <AnnouncementDialog
          key={editing.id}
          courseId={editing.courseId}
          announcement={{ id: editing.id, title: editing.title, body: editing.body, isPinned: editing.isPinned }}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </>
  )
}

function FeedCard({
  item,
  canEdit,
  onVisible,
  onEdit,
  onDeleted,
}: {
  item: FeedItem
  canEdit: boolean
  onVisible: (id: string) => void
  onEdit: () => void
  onDeleted: () => void
}) {
  const ref = useRef<HTMLLIElement>(null)
  const [expanded, setExpanded] = useState(false)
  const long = item.body.length > 320 || item.body.split('\n').length > 6

  useEffect(() => {
    if (item.read || !ref.current) return
    const el = ref.current
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          onVisible(item.id)
          io.disconnect()
        }
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [item.id, item.read, onVisible])

  return (
    <li
      ref={ref}
      className={cn(
        'animate-rise rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)] transition-colors',
        !item.read && 'border-primary/50 bg-primary-soft/30',
        item.isPinned && 'ring-1 ring-primary/20',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {item.isPinned && <Badge tone="primary"><Pin /> Pinned</Badge>}
        <Badge tone={item.courseCode ? 'info' : 'warning'}>{item.courseCode ?? 'Everyone'}</Badge>
        {!item.read && <Badge tone="primary">New</Badge>}
      </div>
      <h3 className="mt-2.5 font-display text-xl font-semibold leading-snug">{item.title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {item.authorName} · <RelativeTime iso={item.createdAt} />
      </p>

      <div className={cn('relative mt-3 text-[0.9375rem]', long && !expanded && 'max-h-36 overflow-hidden')}>
        <Markdown>{item.body}</Markdown>
        {long && !expanded && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-card to-transparent" />}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {long && (
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            onClick={() => {
              setExpanded((e) => !e)
              if (!item.read) onVisible(item.id)
            }}
          >
            <ChevronDown className={cn('transition-transform', expanded && 'rotate-180')} /> {expanded ? 'Show less' : 'Read more'}
          </Button>
        )}
        {canEdit && (
          <span className="ml-auto flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}><Pencil /> Edit</Button>
            <ConfirmDialog
              trigger={<Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft"><Trash2 /> Delete</Button>}
              title="Delete this announcement?"
              description="It disappears for everyone who could see it."
              confirmLabel="Delete announcement"
              onConfirm={async () => {
                const res = await deleteAnnouncement(item.id)
                if (res.ok) {
                  toast.success('Announcement deleted')
                  onDeleted()
                } else toast.error(res.error)
              }}
            />
          </span>
        )}
      </div>
    </li>
  )
}
