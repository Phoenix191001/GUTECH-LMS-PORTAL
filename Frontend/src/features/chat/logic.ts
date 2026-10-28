const FIVE_MINUTES = 5 * 60 * 1000

type Msg = { id: string; sender_id: string; created_at: string }

/** Consecutive messages from one sender within 5 minutes of each other share a header (spec Feature 8, req. 1). */
export function groupMessages<T extends Msg>(messages: T[]): T[][] {
  const groups: T[][] = []
  for (const m of messages) {
    const group = groups.at(-1)
    const last = group?.at(-1)
    const gap = last ? new Date(m.created_at).getTime() - new Date(last.created_at).getTime() : Infinity
    if (group && last && last.sender_id === m.sender_id && gap <= FIVE_MINUTES) group.push(m)
    else groups.push([m])
  }
  return groups
}

export type TextPart = { type: 'text'; value: string } | { type: 'link'; value: string; href: string }

const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi

/**
 * Splits a message into plain text and http(s) links. Nothing is parsed as markdown or
 * HTML; React escapes the text, and links are rendered as anchors with noopener/noreferrer.
 */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0
    // trailing punctuation belongs to the sentence, not the URL
    const raw = match[0].replace(/[.,;:!?)\]]+$/, '')
    if (start > last) parts.push({ type: 'text', value: text.slice(last, start) })
    try {
      const url = new URL(raw)
      if (url.protocol === 'http:' || url.protocol === 'https:') parts.push({ type: 'link', value: raw, href: url.toString() })
      else parts.push({ type: 'text', value: raw })
    } catch {
      parts.push({ type: 'text', value: raw })
    }
    last = start + raw.length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}

/** Merges message lists by id (used when re-fetching after a reconnect). Oldest first. */
export function mergeMessages<T extends { id: string; created_at: string }>(existing: T[], incoming: T[]): T[] {
  const map = new Map(existing.map((m) => [m.id, m]))
  for (const m of incoming) map.set(m.id, m)
  return [...map.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}
