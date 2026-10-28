import { describe, expect, it } from 'vitest'
import { groupMessages, linkify, mergeMessages } from './logic'

const m = (id: string, sender: string, iso: string) => ({ id, sender_id: sender, created_at: iso })

describe('groupMessages', () => {
  it('groups consecutive messages from one sender within 5 minutes', () => {
    const groups = groupMessages([
      m('1', 'a', '2026-01-01T10:00:00Z'),
      m('2', 'a', '2026-01-01T10:04:00Z'),
      m('3', 'a', '2026-01-01T10:10:00Z'), // gap > 5 min from #2
      m('4', 'b', '2026-01-01T10:10:30Z'), // different sender
    ])
    expect(groups.map((g) => g.map((x) => x.id))).toEqual([['1', '2'], ['3'], ['4']])
  })
})

describe('linkify', () => {
  it('keeps plain text and turns http(s) links into link parts', () => {
    expect(linkify('see https://example.com/a, ok')).toEqual([
      { type: 'text', value: 'see ' },
      { type: 'link', value: 'https://example.com/a', href: 'https://example.com/a' },
      { type: 'text', value: ', ok' },
    ])
  })
  it('never produces a link for javascript: or HTML', () => {
    const parts = linkify('<img src=x onerror=alert(1)> javascript:alert(1)')
    expect(parts.every((p) => p.type === 'text')).toBe(true)
  })
})

describe('mergeMessages', () => {
  it('merges by id and sorts oldest first', () => {
    const merged = mergeMessages([m('2', 'a', '2026-01-01T10:01:00Z')], [m('1', 'a', '2026-01-01T10:00:00Z'), m('2', 'a', '2026-01-01T10:01:00Z')])
    expect(merged.map((x) => x.id)).toEqual(['1', '2'])
  })
})
