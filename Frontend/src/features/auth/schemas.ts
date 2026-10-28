import { z } from 'zod'

/** One schema for client forms and server actions (spec: same zod schema on both sides). */

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'))

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({ email: emailSchema })
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export type PasswordRule = { id: string; label: string; test: (password: string, email: string) => boolean }

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 10 characters', test: (p) => p.length >= 10 },
  { id: 'letter', label: 'Contains a letter', test: (p) => /[A-Za-z]/.test(p) },
  { id: 'number', label: 'Contains a number', test: (p) => /\d/.test(p) },
  { id: 'email', label: 'Is not your email address', test: (p, email) => p.length > 0 && p.toLowerCase() !== email.toLowerCase() },
]

/** 0-4 strength: rules passed, with a bonus step for long passwords. */
export function passwordStrength(password: string, email = ''): number {
  if (!password) return 0
  const passed = PASSWORD_RULES.filter((r) => r.test(password, email)).length
  return Math.min(4, passed === PASSWORD_RULES.length && password.length >= 14 ? 4 : passed === PASSWORD_RULES.length ? 3 : Math.min(passed, 2))
}

/** Password policy: >= 10 chars, one letter, one number, not equal to the e-mail. */
export function newPasswordSchema(email = '') {
  return z
    .string()
    .min(10, 'Use at least 10 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/\d/, 'Include at least one number')
    .refine((p) => p.toLowerCase() !== email.toLowerCase(), 'Password cannot be your email address')
}

export function resetPasswordSchema(email = '') {
  return z
    .object({ password: newPasswordSchema(email), confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
}
export type ResetPasswordInput = { password: string; confirm: string }

export function changePasswordSchema(email = '') {
  return z
    .object({ current: z.string().min(1, 'Enter your current password'), next: newPasswordSchema(email), confirm: z.string() })
    .refine((v) => v.next === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })
    .refine((v) => v.next !== v.current, { path: ['next'], message: 'Choose a password different from the current one' })
}
export type ChangePasswordInput = { current: string; next: string; confirm: string }

/** Only same-site relative redirects are honoured after login. */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/dashboard'
  if (value.startsWith('/login') || value.startsWith('/reset-password')) return '/dashboard'
  return value
}
