'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, Loader2, RotateCw, SendHorizontal, Trash2, WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar } from '@/components/shared/avatar'
import { LocalTime } from '@/components/shared/local-time'
import { Badge } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { deleteMessage, loadMessages, markChatRead, sendMessage } from '../actions'
import { groupMessages, linkify, mergeMessages } from '../logic'
import { MAX_MESSAGE, type ChatMessage, type ChatPerson } from '../schemas'

type Msg = ChatMessage & { pending?: boolean; failed?: boolean }
type Me = { id: string; name: string; role: 'admin' | 'teacher' | 'student' }

const NEAR_BOTTOM = 120

/**
 * Realtime classroom chat. The browser subscribes with the user's own session, so RLS decides
 * which rows arrive: a removed student stops receiving messages immediately.
 */
export function ChatRoom({
  courseId,
  me,
  canPost,
  canModerate,
  initialMessages,
  initialPeople,
  initialHasMore,
}: {
  courseId: string
  me: Me
  canPost: boolean
  canModerate: boolean
  initialMessages: ChatMessage[]
  initialPeople: Record<string, ChatPerson>
  initialHasMore: boolean
}) {
  const router = useRouter()
  const [messages, setMessages] = useState<Msg[]>(initialMessages)
  const [people, setPeople] = useState(initialPeople)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [text, setText] = useState('')
  const [pill, setPill] = useState(false)
  const [offline, setOffline] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const nearBottom = useRef(true)
  const restore = useRef<number | null>(null)
  const wasDown = useRef(false)
  const requested = useRef(new Set<string>())
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
    setPill(false)
  }, [])

  /* ---- read state ---- */
  const scheduleRead = useCallback(() => {
    if (readTimer.current) clearTimeout(readTimer.current)
    readTimer.current = setTimeout(() => void markChatRead(courseId), 600)
  }, [courseId])

  useEffect(() => {
    scrollToBottom()
    void markChatRead(courseId).then(() => router.refresh())
    return () => {
      if (readTimer.current) clearTimeout(readTimer.current)
      void markChatRead(courseId).then(() => router.refresh()) // clears the tab badge on leave
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  /* ---- keep scroll position when older messages are prepended ---- */
  useLayoutEffect(() => {
    const el = listRef.current
    if (el && restore.current !== null) {
      el.scrollTop += el.scrollHeight - restore.current
      restore.current = null
    }
  }, [messages])

  /* ---- people lookup for senders we have not seen yet ---- */
  const ensurePerson = useCallback(
    async (senderId: string) => {
      if (requested.current.has(senderId)) return
      requested.current.add(senderId)
      const supabase = createClient()
      const { data } = await supabase.from('profile_directory').select('full_name, avatar_url, role').eq('id', senderId).maybeSingle()
      if (!data?.full_name || !data.role) return
      let avatarUrl: string | null = null
      if (data.avatar_url) avatarUrl = (await supabase.storage.from('avatars').createSignedUrl(data.avatar_url, 3600)).data?.signedUrl ?? null
      const role = data.role
      setPeople((prev) => ({ ...prev, [senderId]: { name: data.full_name!, avatarUrl, role } }))
    },
    [],
  )

  /* ---- realtime ---- */
  useEffect(() => {
    const supabase = createClient()

    const refetchLatest = async () => {
      const res = await loadMessages({ courseId })
      if (!res.ok) return
      setMessages((prev) => mergeMessages(prev.filter((m) => !m.pending), res.data.messages))
      setPeople((prev) => ({ ...res.data.people, ...prev }))
    }

    const channel = supabase
      .channel(`chat:${courseId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `course_id=eq.${courseId}` }, (payload) => {
        const row = payload.new as ChatMessage
        const own = row.sender_id === me.id
        setMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev
          // reconcile our own optimistic message with the real row
          if (own) {
            const idx = prev.findIndex((m) => m.pending && m.body === row.body)
            if (idx >= 0) return prev.map((m, i) => (i === idx ? row : m))
          }
          return mergeMessages(prev, [row])
        })
        void ensurePerson(row.sender_id)
        if (own || nearBottom.current) {
          requestAnimationFrame(() => scrollToBottom(true))
          if (!own) scheduleRead()
        } else setPill(true)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `course_id=eq.${courseId}` }, (payload) => {
        const row = payload.new as ChatMessage
        setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, body: row.body, deleted_at: row.deleted_at } : m)))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setOffline(false)
          if (wasDown.current) {
            wasDown.current = false
            void refetchLatest() // pick up anything missed while disconnected
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          wasDown.current = true
          setOffline(true)
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [courseId, me.id, ensurePerson, scrollToBottom, scheduleRead])

  /* ---- older history ---- */
  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore) return
    const oldest = messagesRef.current.find((m) => !m.pending)
    if (!oldest) return
    setLoadingOlder(true)
    const res = await loadMessages({ courseId, before: oldest.created_at })
    setLoadingOlder(false)
    if (!res.ok) return void toast.error(res.error)
    restore.current = listRef.current?.scrollHeight ?? null
    setHasMore(res.data.hasMore)
    setPeople((prev) => ({ ...res.data.people, ...prev }))
    setMessages((prev) => mergeMessages(prev, res.data.messages))
  }, [courseId, hasMore, loadingOlder])

  const onScroll = () => {
    const el = listRef.current
    if (!el) return
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM
    if (nearBottom.current) setPill(false)
    if (el.scrollTop < 60) void loadOlder()
  }

  /* ---- sending ---- */
  const submit = async (retry?: Msg) => {
    const body = (retry?.body ?? text).trim()
    if (!body || body.length > MAX_MESSAGE) return
    const temp: Msg = retry
      ? { ...retry, pending: true, failed: false }
      : { id: `tmp-${crypto.randomUUID()}`, course_id: courseId, sender_id: me.id, body, created_at: new Date().toISOString(), deleted_at: null, pending: true }
    if (retry) setMessages((prev) => prev.map((m) => (m.id === retry.id ? temp : m)))
    else {
      setMessages((prev) => [...prev, temp])
      setText('')
      if (inputRef.current) inputRef.current.style.height = 'auto'
    }
    requestAnimationFrame(() => scrollToBottom(true))

    const res = await sendMessage({ courseId, body })
    if (res.ok) {
      setMessages((prev) => {
        const rest = prev.filter((m) => m.id !== temp.id)
        return rest.some((m) => m.id === res.data.id) ? rest : mergeMessages(rest, [res.data])
      })
    } else {
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)))
      toast.error(res.error)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  const groups = useMemo(() => groupMessages(messages), [messages])
  const remaining = MAX_MESSAGE - text.length

  return (
    <div className="flex h-[calc(100dvh-21rem)] min-h-[22rem] flex-col overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-soft)] lg:h-[calc(100dvh-19rem)]">
      {offline && (
        <div role="status" className="flex items-center gap-2 bg-warning-soft px-4 py-2 text-sm text-warning">
          <WifiOff className="size-4" /> Reconnecting… new messages will appear when you are back online.
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-label="Chat messages" className="h-full space-y-4 overflow-y-auto px-3 py-4 sm:px-5">
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={() => void loadOlder()} loading={loadingOlder}>Load earlier messages</Button>
            </div>
          )}
          {!hasMore && messages.length > 0 && <p className="text-center text-xs text-muted-foreground">Start of the conversation</p>}
          {messages.length === 0 && (
            <div className="grid h-full place-items-center text-center">
              <div>
                <p className="font-display text-lg font-semibold">No messages yet</p>
                <p className="mt-1 text-sm text-muted-foreground">{canPost ? 'Say hello to your class.' : 'Messages from the class appear here.'}</p>
              </div>
            </div>
          )}

          {groups.map((group, gi) => {
            const first = group[0]!
            const own = first.sender_id === me.id
            const person = people[first.sender_id]
            const prevDay = gi > 0 ? groups[gi - 1]![0]!.created_at.slice(0, 10) : null
            const newDay = prevDay !== first.created_at.slice(0, 10)
            return (
              <div key={first.id} className={cn('flex gap-2.5', own && 'flex-row-reverse')}>
                {!own && <Avatar name={person?.name ?? 'Former member'} src={person?.avatarUrl} size="sm" className="mt-5" />}
                <div className={cn('flex max-w-[82%] flex-col gap-1 sm:max-w-[70%]', own && 'items-end')}>
                  <p className={cn('flex items-center gap-2 px-1 text-xs text-muted-foreground', own && 'flex-row-reverse')}>
                    <span className="font-medium text-foreground">{own ? 'You' : (person?.name ?? 'Former member')}</span>
                    {!own && person && person.role !== 'student' && <Badge tone="primary" className="capitalize">{person.role}</Badge>}
                    <LocalTime iso={first.created_at} mode={newDay ? 'datetime' : 'time'} />
                  </p>
                  {group.map((m) => (
                    <Bubble key={m.id} m={m} own={own} canDelete={own || canModerate} onRetry={() => void submit(m)} onDismiss={() => setMessages((prev) => prev.filter((x) => x.id !== m.id))} onDelete={async () => {
                      const res = await deleteMessage(m.id)
                      if (res.ok) setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, deleted_at: new Date().toISOString(), body: '' } : x)))
                      else toast.error(res.error)
                    }} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {pill && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-lift)] animate-pop"
          >
            <ArrowDown className="size-4" /> New messages
          </button>
        )}
      </div>

      {canPost ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="border-t bg-card p-3"
        >
          <div className="flex items-end gap-2">
            <div className="relative min-w-0 flex-1">
              <label htmlFor="chat-input" className="sr-only">Message</label>
              <textarea
                id="chat-input"
                ref={inputRef}
                value={text}
                rows={1}
                maxLength={MAX_MESSAGE}
                placeholder="Write a message…"
                onKeyDown={onKeyDown}
                onChange={(e) => {
                  setText(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
                }}
                className="block max-h-36 min-h-11 w-full resize-none rounded-xl border border-input bg-background px-3.5 py-2.5 text-base outline-none transition focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 sm:text-[0.9375rem]"
              />
              {remaining < 200 && <span className={cn('absolute -top-5 right-1 text-xs', remaining < 0 ? 'text-danger' : 'text-muted-foreground')}>{remaining}</span>}
            </div>
            <Button type="submit" size="icon" aria-label="Send message" disabled={!text.trim()}>
              <SendHorizontal />
            </Button>
          </div>
          <p className="mt-1.5 hidden text-xs text-muted-foreground sm:block">Enter to send · Shift+Enter for a new line</p>
        </form>
      ) : (
        <p className="border-t bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">Administrators can read and moderate this chat but not post.</p>
      )}
    </div>
  )
}

function Bubble({
  m,
  own,
  canDelete,
  onRetry,
  onDismiss,
  onDelete,
}: {
  m: Msg
  own: boolean
  canDelete: boolean
  onRetry: () => void
  onDismiss: () => void
  onDelete: () => Promise<void>
}) {
  if (m.deleted_at) {
    return <p className="rounded-2xl border border-dashed px-3.5 py-2 text-sm italic text-muted-foreground">This message was deleted</p>
  }
  return (
    <div className={cn('group flex items-center gap-1.5', own && 'flex-row-reverse')}>
      <div
        className={cn(
          'min-w-0 whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[0.9375rem] leading-relaxed',
          own ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted',
          m.pending && 'opacity-60',
          m.failed && 'bg-danger-soft text-danger ring-1 ring-danger/40',
        )}
      >
        {linkify(m.body).map((part, i) =>
          part.type === 'link' ? (
            <a key={i} href={part.href} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline underline-offset-2">
              {part.value}
            </a>
          ) : (
            <span key={i}>{part.value}</span>
          ),
        )}
      </div>
      {m.pending && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-label="Sending" />}
      {m.failed && (
        <span className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Retry sending" onClick={onRetry}><RotateCw /></Button>
          <Button variant="ghost" size="icon-sm" aria-label="Discard message" onClick={onDismiss}><Trash2 /></Button>
        </span>
      )}
      {!m.pending && !m.failed && canDelete && (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label="Delete message" className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-60">
              <Trash2 />
            </Button>
          }
          title="Delete this message?"
          description="It will show as “This message was deleted” for everyone in the course."
          confirmLabel="Delete message"
          onConfirm={onDelete}
        />
      )}
    </div>
  )
}
