import 'server-only'
import { unwrapList } from '@/lib/actions'
import type { Supabase } from '@/lib/auth'
import { loadDirectory } from '@/features/shared/directory'
import { signedUrls } from '@/lib/storage'
import { PAGE, type ChatPage, type ChatPerson } from './schemas'

/**
 * Newest-first page of 50 messages, cursor on created_at (`before`), returned oldest-first
 * for rendering, with the people (name + signed avatar) needed to show them.
 */
export async function loadChatPage(supabase: Supabase, courseId: string, before?: string): Promise<ChatPage> {
  let query = supabase
    .from('chat_messages')
    .select('*')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
    .limit(PAGE + 1)
  if (before) query = query.lt('created_at', before)

  const rows = unwrapList(await query)
  const hasMore = rows.length > PAGE
  const messages = rows.slice(0, PAGE).reverse()

  const dir = await loadDirectory(supabase, messages.map((m) => m.sender_id))
  const avatars = await signedUrls(supabase, 'avatars', [...dir.values()].map((d) => d.avatar_url))
  const people: Record<string, ChatPerson> = {}
  for (const [id, p] of dir) people[id] = { name: p.full_name, avatarUrl: p.avatar_url ? (avatars.get(p.avatar_url) ?? null) : null, role: p.role }

  return { messages, people, hasMore }
}
