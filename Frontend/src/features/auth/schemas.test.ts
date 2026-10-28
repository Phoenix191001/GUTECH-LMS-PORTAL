import { describe, expect, it } from 'vitest'
import { changePasswordSchema, loginSchema, newPasswordSchema, passwordStrength, resetPasswordSchema, safeNextPath } from './schemas'

describe('password policy', () => {
  const schema = newPasswordSchema('sam@school.edu')

  it('accepts a valid password', () => {
    expect(schema.safeParse('longenough1').success).toBe(true)
  })
  it.each([
    ['too short', 'abc1'],
    ['no number', 'abcdefghijkl'],
    ['no letter', '1234567890123'],
  ])('rejects %s', (_label, value) => {
    expect(schema.safeParse(value).success).toBe(false)
  })
  it('rejects the email address itself', () => {
    expect(newPasswordSchema('someone123@x.edu').safeParse('someone123@x.edu').success).toBe(false)
  })
  it('requires matching confirmation', () => {
    const r = resetPasswordSchema().safeParse({ password: 'longenough1', confirm: 'different11' })
    expect(r.success).toBe(false)
  })
  it('requires the new password to differ from the current one', () => {
    const r = changePasswordSchema().safeParse({ current: 'longenough1', next: 'longenough1', confirm: 'longenough1' })
    expect(r.success).toBe(false)
  })
  it('scores strength between 0 and 4', () => {
    expect(passwordStrength('')).toBe(0)
    expect(passwordStrength('abc')).toBeLessThanOrEqual(2)
    expect(passwordStrength('averylongpassword99')).toBe(4)
  })
})

describe('login schema', () => {
  it('normalises the e-mail', () => {
    const r = loginSchema.parse({ email: '  Sam@School.EDU ', password: 'x' })
    expect(r.email).toBe('sam@school.edu')
  })
})

describe('safeNextPath', () => {
  it('blocks open redirects', () => {
    expect(safeNextPath('//evil.com')).toBe('/dashboard')
    expect(safeNextPath('https://evil.com')).toBe('/dashboard')
    expect(safeNextPath('/courses/1')).toBe('/courses/1')
    expect(safeNextPath(null)).toBe('/dashboard')
  })
})
