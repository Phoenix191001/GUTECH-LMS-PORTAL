import 'server-only'
import { unstable_rethrow } from 'next/navigation'
import { ZodError, type ZodType } from 'zod'
import type { PostgrestError } from '@supabase/supabase-js'
import type { UserRole } from '@/types/database'
import { getAppUser, type AppUser } from '@/lib/auth'
import { isSupabaseConfigured } from '@/lib/env'

import type { ActionResult } from '@/lib/action-types'

/** An error whose message is safe and useful to show to the user. */
export class ActionError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ActionError'
  }
}

const GENERIC = 'Something went wrong. Please try again.'

/** Validates untrusted input with the same zod schema the client form uses. */
export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_'
    ;(fieldErrors[key] ??= []).push(issue.message)
  }
  throw new ActionError(result.error.issues[0]?.message ?? 'Invalid input.', fieldErrors)
}

/** Converts a Supabase error into an ActionError (friendly) or a plain Error (logged, generic to the user). */
export function dbError(error: PostgrestError | { message: string; code?: string }): Error {
  const code = 'code' in error ? error.code : undefined
  if (code === 'P0001') return new ActionError(error.message) // our own `raise exception` messages
  if (code === '23505') return new ActionError('That already exists.')
  if (code === '23503') return new ActionError('A related record is missing or still in use.')
  if (code === '42501' || /row-level security/i.test(error.message)) {
    return new ActionError('You do not have permission to do that.')
  }
  return new Error(`${code ?? 'db'}: ${error.message}`)
}

/** Unwraps a `{ data, error }` Supabase response or throws. */
export function unwrap<T>(res: { data: T; error: PostgrestError | null }): T {
  if (res.error) throw dbError(res.error)
  return res.data
}

/** Like unwrap, for list queries: null data becomes an empty array. */
export function unwrapList<T>(res: { data: T[] | null; error: PostgrestError | null }): T[] {
  if (res.error) throw dbError(res.error)
  return res.data ?? []
}

type Ctx = { user: AppUser; supabase: AppUser['supabase'] }

/**
 * Wraps a server action: checks Supabase is configured, authenticates, RE-CHECKS the role
 * (UI hiding is never enough), runs the handler, logs failures with user id + action name
 * (never passwords or tokens), and returns `{ ok, data | error }`.
 */
export async function authedAction<T>(
  name: string,
  roles: UserRole[] | null,
  handler: (ctx: Ctx) => Promise<T>,
): Promise<ActionResult<T>> {
  let userId = 'anonymous'
  try {
    if (!isSupabaseConfigured()) throw new ActionError('The server is not configured yet. Add the Supabase keys to .env.local.')
    const user = await getAppUser()
    if (!user) throw new ActionError('Your session has expired. Please sign in again.')
    userId = user.id
    if (roles && !roles.includes(user.profile.role)) throw new ActionError('You do not have permission to do that.')
    return { ok: true, data: await handler({ user, supabase: user.supabase }) }
  } catch (e) {
    return failure(name, userId, e)
  }
}

/** For public actions (sign in, forgot password) that have no session yet. */
export async function publicAction<T>(name: string, handler: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    if (!isSupabaseConfigured()) throw new ActionError('The server is not configured yet. Add the Supabase keys to .env.local.')
    return { ok: true, data: await handler() }
  } catch (e) {
    return failure(name, 'anonymous', e)
  }
}

function failure(name: string, userId: string, e: unknown): ActionResult<never> {
  unstable_rethrow(e) // let redirect()/notFound() through
  if (e instanceof ActionError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors }
  if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? 'Invalid input.' }
  console.error(`[action:${name}] user=${userId}`, e instanceof Error ? e.message : e)
  return { ok: false, error: GENERIC }
}
