import 'server-only'
import { unwrapList } from '@/lib/actions'
import type { Supabase } from '@/lib/auth'
import { loadDirectory } from '@/features/shared/directory'
import type { FeedItem } from './components/announcement-feed'

type Scope = { courseId: string } | { global: true } | { all: true }

/**
 * Announcements visible to the viewer (RLS: course members + global), pinned first and
 * then newest first, each flagged read/unread for this user.
 */
export async function loadFeed(
  supabase: Supabase,
  userId: string,
  scope: Scope,
  opts: { page?: number; pageSize?: number; limit?: number } = {},
): Promise<{ items: FeedItem[]; total: number }> {
  const pageSize = opts.pageSize ?? 20
  const page = opts.page ?? 1

  let query = supabase.from('announcements').select('*', { count: 'exact' }).order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
  if ('courseId' in scope) query = query.eq('course_id', scope.courseId)
  else if ('global' in scope) query = query.is('course_id', null)
  query = opts.limit ? query.limit(opts.limit) : query.range((page - 1) * pageSize, page * pageSize - 1)

  const { data, count, error } = await query
  if (error) throw new Error(error.message)
  const rows = data ?? []
  if (rows.length === 0) return { items: [], total: count ?? 0 }

  const ids = rows.map((r) => r.id)
  const courseIds = [...new Set(rows.map((r) => r.course_id).filter((c): c is string => !!c))]
  const [reads, courses, dir] = await Promise.all([
    supabase.from('announcement_reads').select('announcement_id').eq('user_id', userId).in('announcement_id', ids),
    courseIds.length ? supabase.from('courses').select('id, code').in('id', courseIds) : Promise.resolve({ data: [], error: null }),
    loadDirectory(supabase, rows.map((r) => r.author_id)),
  ])
  const readSet = new Set(unwrapList(reads).map((r) => r.announcement_id))
  const codes = new Map(unwrapList(courses).map((c) => [c.id, c.code]))

  return {
    total: count ?? rows.length,
    items: rows.map((r) => ({
      id: r.id,
      courseId: r.course_id,
      courseCode: r.course_id ? (codes.get(r.course_id) ?? null) : null,
      authorId: r.author_id,
      authorName: dir.get(r.author_id)?.full_name ?? 'Unknown',
      title: r.title,
      body: r.body,
      isPinned: r.is_pinned,
      createdAt: r.created_at,
      read: readSet.has(r.id),
    })),
  }
}
