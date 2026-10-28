import 'server-only'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { requireUser, type AppUser } from '@/lib/auth'
import { loadDirectory } from '@/features/shared/directory'

/**
 * The course for this request, or a 404. RLS decides visibility: a student who is not
 * enrolled, or a teacher of another course, gets "not found" even with the direct URL.
 */
export const getCourseOrNotFound = cache(async (courseId: string) => {
  const user = await requireUser()
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) notFound()
  const { data: course } = await user.supabase.from('courses').select('*').eq('id', courseId).maybeSingle()
  if (!course) notFound()
  const dir = await loadDirectory(user.supabase, [course.teacher_id])
  return { user, course, teacher: dir.get(course.teacher_id) ?? null }
})

/** True when the viewer can manage the course content (admin or its teacher). */
export function canManage(user: AppUser, course: { teacher_id: string }) {
  return user.profile.role === 'admin' || (user.profile.role === 'teacher' && course.teacher_id === user.id)
}
