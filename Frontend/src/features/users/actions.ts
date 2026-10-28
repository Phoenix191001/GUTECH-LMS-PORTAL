'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ActionError, authedAction, parse, unwrap, unwrapList } from '@/lib/actions'
import type { Supabase } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseCsvObjects } from '@/lib/csv'
import { emailSchema, newPasswordSchema } from '@/features/auth/schemas'
import { generateTempPassword } from './password'
import { createUserSchema, csvImportSchema, resetPasswordSchemaAdmin, updateUserSchema, type CreateUserInput, type UpdateUserInput } from './schemas'

const refresh = () => revalidatePath('/admin/users')

function isDuplicate(error: { code?: string; message: string }) {
  return error.code === '23505' || /already|registered|exists/i.test(error.message)
}

/**
 * Creates the auth user and the profile together (service role). If the profile insert
 * fails the auth user is deleted again so nothing is half-created.
 */
async function createAccount(input: { fullName: string; email: string; role: 'admin' | 'teacher' | 'student'; rollNo?: string; password: string }) {
  const admin = createAdminClient()
  const created = await admin.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true })
  if (created.error || !created.data.user) {
    throw new ActionError(created.error && isDuplicate(created.error) ? 'A user with this email already exists.' : 'Could not create the account.')
  }
  const id = created.data.user.id
  const { error } = await admin.from('profiles').insert({
    id,
    full_name: input.fullName,
    email: input.email,
    role: input.role,
    roll_no: input.role === 'student' ? input.rollNo || null : null,
    must_change_password: true,
  })
  if (error) {
    await admin.auth.admin.deleteUser(id)
    throw new ActionError(error.code === '23505' ? 'That email or roll number is already in use.' : 'Could not create the profile.')
  }
  return id
}

export async function createUser(input: CreateUserInput) {
  return authedAction('createUser', ['admin'], async () => {
    const v = parse(createUserSchema, input)
    const id = await createAccount({ ...v, password: v.tempPassword })
    refresh()
    return { id }
  })
}

export async function updateUser(input: UpdateUserInput) {
  return authedAction('updateUser', ['admin'], async ({ user, supabase }) => {
    const v = parse(updateUserSchema, input)
    const target = unwrap(await supabase.from('profiles').select('*').eq('id', v.id).maybeSingle())
    if (!target) throw new ActionError('User not found.')

    if (v.id === user.id && (v.role !== 'admin' || !v.isActive)) {
      throw new ActionError('You cannot deactivate or demote yourself.')
    }
    if (target.role === 'teacher' && v.role !== 'teacher') {
      const { count } = await supabase.from('courses').select('id', { count: 'exact', head: true }).eq('teacher_id', v.id).eq('is_active', true)
      if ((count ?? 0) > 0) throw new ActionError('This teacher still has active courses. Assign those courses to someone else first.')
    }

    const { error } = await createAdminClient()
      .from('profiles')
      .update({ full_name: v.fullName, role: v.role, roll_no: v.role === 'student' ? v.rollNo || null : null, is_active: v.isActive })
      .eq('id', v.id)
    if (error) throw new ActionError(error.code === '23505' ? 'That roll number is already in use.' : 'Could not update the user.')
    refresh()
    return undefined
  })
}

/**
 * Admin password reset. Generates (or accepts) a temporary password, forces a change at next
 * login, and returns it ONCE to be shown in a dialog. It is never stored or logged.
 */
export async function adminResetPassword(input: { id: string; password?: string }) {
  return authedAction('adminResetPassword', ['admin'], async ({ user, supabase }) => {
    const v = parse(resetPasswordSchemaAdmin, input)
    if (v.id === user.id) throw new ActionError('Use the Profile page to change your own password.')
    const target = unwrap(await supabase.from('profiles').select('id, email').eq('id', v.id).maybeSingle())
    if (!target) throw new ActionError('User not found.')

    const password = v.password ? parse(newPasswordSchema(target.email), v.password) : generateTempPassword()
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.updateUserById(v.id, { password })
    if (error) throw new ActionError('Could not set the temporary password.')
    unwrap(await admin.from('profiles').update({ must_change_password: true }).eq('id', v.id))
    refresh()
    return { password }
  })
}

/* ---------------------------- bulk student import ---------------------------- */

type ImportRow = { line: number; fullName: string; email: string; rollNo: string; status: 'ready' | 'error'; message?: string }

const rowSchema = z.object({
  fullName: z.string().trim().min(2, 'Name is required').max(120),
  email: emailSchema,
  rollNo: z.string().trim().max(40).regex(/^[A-Za-z0-9._\-/ ]*$/, 'Invalid roll number'),
})

async function checkImport(supabase: Supabase, csv: string): Promise<ImportRow[]> {
  const records = parseCsvObjects(csv)
  if (records.length === 0) throw new ActionError('The file has no rows. Expected columns: full_name,email,roll_no')
  if (records.length > 300) throw new ActionError('Import at most 300 students at a time.')
  const first = records[0] ?? {}
  if (!('full_name' in first) || !('email' in first)) throw new ActionError('Missing columns. Expected: full_name,email,roll_no')

  const emails = records.map((r) => (r.email ?? '').toLowerCase()).filter(Boolean)
  const rolls = records.map((r) => r.roll_no ?? '').filter(Boolean)
  const [byEmail, byRoll] = await Promise.all([
    supabase.from('profiles').select('email').in('email', emails.length ? emails : ['-']),
    supabase.from('profiles').select('roll_no').in('roll_no', rolls.length ? rolls : ['-']),
  ])
  const takenEmail = new Set(unwrapList(byEmail).map((p) => p.email.toLowerCase()))
  const takenRoll = new Set(unwrapList(byRoll).map((p) => p.roll_no))

  const seenEmail = new Set<string>()
  const seenRoll = new Set<string>()
  return records.map((r, i): ImportRow => {
    const base = { line: i + 2, fullName: r.full_name ?? '', email: (r.email ?? '').toLowerCase(), rollNo: r.roll_no ?? '' }
    const parsed = rowSchema.safeParse({ fullName: base.fullName, email: base.email, rollNo: base.rollNo })
    if (!parsed.success) return { ...base, status: 'error', message: parsed.error.issues[0]?.message ?? 'Invalid row' }
    if (takenEmail.has(base.email) || seenEmail.has(base.email)) return { ...base, status: 'error', message: 'Email already exists' }
    if (base.rollNo && (takenRoll.has(base.rollNo) || seenRoll.has(base.rollNo))) return { ...base, status: 'error', message: 'Roll number already exists' }
    seenEmail.add(base.email)
    if (base.rollNo) seenRoll.add(base.rollNo)
    return { ...base, status: 'ready' }
  })
}

/** Dry run: per-row validation so the admin can review before anything is created. */
export async function previewStudentImport(input: { csv: string }) {
  return authedAction('previewStudentImport', ['admin'], async ({ supabase }) => {
    const { csv } = parse(csvImportSchema, input)
    return checkImport(supabase, csv)
  })
}

export type ImportResult = { line: number; email: string; fullName: string; ok: boolean; password?: string; error?: string }

/** Creates every valid row with its own temporary password. Passwords are returned once. */
export async function importStudents(input: { csv: string }) {
  return authedAction('importStudents', ['admin'], async ({ supabase }) => {
    const { csv } = parse(csvImportSchema, input)
    const rows = await checkImport(supabase, csv)
    const results: ImportResult[] = []
    for (const row of rows) {
      if (row.status === 'error') {
        results.push({ line: row.line, email: row.email, fullName: row.fullName, ok: false, error: row.message })
        continue
      }
      const password = generateTempPassword()
      try {
        await createAccount({ fullName: row.fullName, email: row.email, role: 'student', rollNo: row.rollNo, password })
        results.push({ line: row.line, email: row.email, fullName: row.fullName, ok: true, password })
      } catch (e) {
        results.push({ line: row.line, email: row.email, fullName: row.fullName, ok: false, error: e instanceof ActionError ? e.message : 'Could not create the account' })
      }
    }
    refresh()
    return results
  })
}
