import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

const TITLES = /^(dr|prof|professor|mr|mrs|ms|miss|engr|sir|madam)\.?$/i

/** Name split into words, without leading titles like Dr. or Prof.. */
function nameParts(name: string | null | undefined): string[] {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  while (parts.length > 1 && TITLES.test(parts[0]!)) parts.shift()
  return parts
}

/** Friendly first name for greetings: Dr. Amna Siddiqui -> Amna. */
export function firstName(name: string | null | undefined): string {
  return nameParts(name)[0] ?? ''
}

export function initials(name: string | null | undefined): string {
  const parts = nameParts(name)
  if (parts.length === 0) return '?'
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase()
}

export function percent(obtained: number, max: number): number {
  return max > 0 ? Math.round((obtained / max) * 1000) / 10 : 0
}

/** Trims trailing zeros: 8.00 -> "8", 7.50 -> "7.5". */
export function num(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '–'
  return String(Number(Number(n).toFixed(2)))
}

/** ISO (UTC) -> value for <input type="datetime-local"> in the browser's time zone. */
export function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** <input type="datetime-local"> value (browser local time) -> ISO UTC string. */
export function fromLocalInputValue(value: string): string {
  return new Date(value).toISOString()
}

/** Escape LIKE wildcards in user search text before using it in `ilike`. */
export function escapeLike(value: string): string {
  return value.replace(/[%_\\,()]/g, (c) => `\\${c}`)
}

export const PAGE_SIZE = 20
