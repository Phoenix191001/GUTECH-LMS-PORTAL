import 'server-only'
import type { Supabase } from '@/lib/auth'
import type { UserRole } from '@/types/database'

export type DirEntry = {
  id: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  roll_no: string | null
  is_active: boolean
}

const CHUNK = 80

/**
 * Resolves people through `profile_directory` (names, avatars, roll numbers of people the
 * viewer shares a course with, never e-mail) instead of embedding `profiles`, which RLS
 * hides from students. Chunked so long id lists never exceed URL limits.
 */
export async function loadDirectory(supabase: Supabase, ids: (string | null | undefined)[]): Promise<Map<string, DirEntry>> {
  const unique = [...new Set(ids.filter((i): i is string => !!i))]
  const out = new Map<string, DirEntry>()
  for (let i = 0; i < unique.length; i += CHUNK) {
    const { data } = await supabase
      .from('profile_directory')
      .select('id, full_name, avatar_url, role, roll_no, is_active')
      .in('id', unique.slice(i, i + CHUNK))
    for (const p of data ?? []) {
      if (p.id && p.full_name && p.role) {
        out.set(p.id, {
          id: p.id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          role: p.role,
          roll_no: p.roll_no,
          is_active: p.is_active ?? true,
        })
      }
    }
  }
  return out
}

export function nameOf(dir: Map<string, DirEntry>, id: string | null | undefined, fallback = 'Former member'): string {
  return (id && dir.get(id)?.full_name) || fallback
}
