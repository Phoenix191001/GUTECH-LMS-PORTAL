import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Row, UserRole } from '@/types/database'
import { createClient } from '@/lib/supabase/server'

export type Supabase = SupabaseClient<Database>
export type Profile = Row<'profiles'>

export type AppUser = {
  id: string
  email: string
  profile: Profile
  supabase: Supabase
}

/** The signed-in user + profile for this request (deduplicated per render). Null when signed out/disabled. */
export const getAppUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (!profile || !profile.is_active) return null
  return { id: user.id, email: user.email ?? profile.email, profile, supabase }
})

/** For pages and layouts: redirects to /login when signed out, /dashboard when the role is wrong. */
export async function requireUser(...roles: UserRole[]): Promise<AppUser> {
  const user = await getAppUser()
  if (!user) redirect('/login')
  if (roles.length > 0 && !roles.includes(user.profile.role)) redirect('/dashboard')
  return user
}
