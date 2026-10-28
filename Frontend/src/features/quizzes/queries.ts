import 'server-only'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getCourseOrNotFound } from '@/features/courses/queries'

/** Quiz for this request or a 404 (students cannot open drafts or other courses' quizzes). */
export const getQuizOrNotFound = cache(async (courseId: string, quizId: string) => {
  const ctx = await getCourseOrNotFound(courseId)
  if (!/^[0-9a-f-]{36}$/i.test(quizId)) notFound()
  const { data: quiz } = await ctx.user.supabase.from('quizzes').select('*').eq('id', quizId).eq('course_id', courseId).maybeSingle()
  if (!quiz) notFound()
  return { ...ctx, quiz }
})
