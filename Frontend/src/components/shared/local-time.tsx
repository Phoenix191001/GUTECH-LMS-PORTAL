'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

const noopSubscribe = () => () => {}

type Mode = 'datetime' | 'date' | 'time'

const OPTIONS: Record<Mode, Intl.DateTimeFormatOptions> = {
  datetime: { dateStyle: 'medium', timeStyle: 'short' },
  date: { dateStyle: 'medium' },
  time: { timeStyle: 'short' },
}

/**
 * Dates are stored in UTC and shown in the viewer's time zone. The server snapshot is UTC
 * so hydration matches; the browser snapshot is local time.
 */
export function LocalTime({ iso, mode = 'datetime', className }: { iso: string | null | undefined; mode?: Mode; className?: string }) {
  const text = useSyncExternalStore(
    noopSubscribe,
    () => (iso ? new Intl.DateTimeFormat(undefined, OPTIONS[mode]).format(new Date(iso)) : ''),
    () => (iso ? new Intl.DateTimeFormat('en-GB', { ...OPTIONS[mode], timeZone: 'UTC' }).format(new Date(iso)) : ''),
  )
  if (!iso) return null
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text}
    </time>
  )
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.round((new Date(iso).getTime() - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  for (const [unit, secs] of UNITS) {
    if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit)
  }
  return 'just now'
}

export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = useState<string>('')
  useEffect(() => {
    const update = () => setText(relativeTime(iso))
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [iso])
  return (
    <time dateTime={iso} className={className} title={iso}>
      {text || iso.slice(0, 10)}
    </time>
  )
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`
  return `${pad(m)}:${pad(sec)}`
}

/**
 * Live countdown to a deadline. `serverNow` corrects for a wrong device clock; the
 * server still makes the real decision.
 */
export function Countdown({
  targetIso,
  serverNow,
  onElapsed,
  className,
}: {
  targetIso: string
  serverNow: string
  onElapsed?: () => void
  className?: string
}) {
  const [offset] = useState(() => new Date(serverNow).getTime() - Date.now())
  const [left, setLeft] = useState<number | null>(null)

  useEffect(() => {
    const target = new Date(targetIso).getTime()
    let fired = false
    const tick = () => {
      const remaining = (target - (Date.now() + offset)) / 1000
      setLeft(remaining)
      if (remaining <= 0 && !fired) {
        fired = true
        onElapsed?.()
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetIso, offset, onElapsed])

  return (
    <span className={className} role="timer" aria-live="off">
      {left === null ? '--:--' : left <= 0 ? 'Time is up' : formatDuration(left)}
    </span>
  )
}
