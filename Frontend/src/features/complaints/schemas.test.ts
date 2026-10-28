import { describe, expect, it } from 'vitest'
import { canTransition, createComplaintSchema, needsResponse, referenceOf, updateComplaintSchema } from './schemas'

describe('complaint status flow', () => {
  it('allows only the documented transitions', () => {
    expect(canTransition('open', 'in_review')).toBe(true)
    expect(canTransition('open', 'rejected')).toBe(true)
    expect(canTransition('in_review', 'resolved')).toBe(true)
    expect(canTransition('in_review', 'rejected')).toBe(true)
  })
  it('rejects invalid jumps and moves out of closed states', () => {
    expect(canTransition('open', 'resolved')).toBe(false)
    expect(canTransition('in_review', 'open')).toBe(false)
    expect(canTransition('resolved', 'open')).toBe(false)
    expect(canTransition('rejected', 'in_review')).toBe(false)
  })
  it('requires a response to resolve or reject', () => {
    expect(needsResponse('resolved')).toBe(true)
    expect(needsResponse('rejected')).toBe(true)
    expect(needsResponse('in_review')).toBe(false)
    const id = crypto.randomUUID()
    expect(updateComplaintSchema.safeParse({ id, status: 'resolved' }).success).toBe(false)
    expect(updateComplaintSchema.safeParse({ id, status: 'resolved', response: 'Fixed' }).success).toBe(true)
    expect(updateComplaintSchema.safeParse({ id, status: 'in_review' }).success).toBe(true)
  })
})

describe('createComplaintSchema', () => {
  it('limits subject (150) and description (3000)', () => {
    const base = { category: 'other' as const, courseId: null, subject: 'Subject', description: 'A long enough description' }
    expect(createComplaintSchema.safeParse(base).success).toBe(true)
    expect(createComplaintSchema.safeParse({ ...base, subject: 'x'.repeat(151) }).success).toBe(false)
    expect(createComplaintSchema.safeParse({ ...base, description: 'x'.repeat(3001) }).success).toBe(false)
  })
})

describe('referenceOf', () => {
  it('uses the first 8 characters, uppercased', () => {
    expect(referenceOf('abcdef12-3456-7890-abcd-ef1234567890')).toBe('ABCDEF12')
  })
})
