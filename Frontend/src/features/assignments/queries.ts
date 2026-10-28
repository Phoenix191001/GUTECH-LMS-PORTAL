import 'server-only'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { unwrapList } from '@/lib/actions'
import type { Supabase } from '@/lib/auth'
import { getCourseOrNotFound } from '@/features/courses/queries'
import { loadDirectory } from '@/features/shared/directory'
import type { Row } from '@/types/database'

/** Assignment for this request or a 404 (students cannot open drafts or other courses'). */
export const getAssignmentOrNotFound = cache(async (courseId: string, assignmentId: string) => {
  const ctx = await getCourseOrNotFound(courseId)
  if (!/^[0-9a-f-]{36}$/i.test(assignmentId)) notFound()
  const { data: assignment } = await ctx.user.supabase
    .from('assignments')
    .select('*')
    .eq('id', assignmentId)
    .eq('course_id', courseId)
    .maybeSingle()
  if (!assignment) notFound()
  return { ...ctx, assignment }
})

export type RosterEntry = {
  studentId: string
  name: string
  rollNo: string | null
  submission: Row<'submissions'> | null
  /** No longer enrolled, but their work is kept. */
  removed: boolean
}

/** Every enrolled student (plus removed ones who have work) with their submission. Teacher/admin only. */
export async function loadRoster(supabase: Supabase, courseId: string, assignmentId: string): Promise<RosterEntry[]> {
  const [enrolled, submissions] = await Promise.all([
    supabase.from('enrollments').select('student_id').eq('course_id', courseId).limit(2000),
    supabase.from('submissions').select('*').eq('assignment_id', assignmentId).limit(2000),
  ])
  const enrolledIds = new Set(unwrapList(enrolled).map((e) => e.student_id))
  const subs = new Map(unwrapList(submissions).map((s) => [s.student_id, s]))
  const ids = new Set([...enrolledIds, ...subs.keys()])
  const dir = await loadDirectory(supabase, [...ids])

  return [...ids]
    .map((id) => ({
      studentId: id,
      name: dir.get(id)?.full_name ?? 'Former member',
      rollNo: dir.get(id)?.roll_no ?? null,
      submission: subs.get(id) ?? null,
      removed: !enrolledIds.has(id),
    }))
    .sort((a, b) => (a.rollNo ?? 'zzz').localeCompare(b.rollNo ?? 'zzz') || a.name.localeCompare(b.name))
}
