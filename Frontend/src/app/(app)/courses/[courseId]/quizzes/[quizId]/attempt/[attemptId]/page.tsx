import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { QuizRunner } from '@/features/quizzes/components/quiz-runner'
import { attemptPayloadSchema } from '@/features/quizzes/schemas'
import { getQuizOrNotFound } from '@/features/quizzes/queries'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: 'Quiz attempt' }
export const dynamic = 'force-dynamic'

export default async function AttemptPage({ params }: { params: Promise<{ courseId: string; quizId: string; attemptId: string }> }) {
  const { courseId, quizId, attemptId } = await params
  const user = await requireUser('student')
  await getQuizOrNotFound(courseId, quizId)
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) notFound()

  // The database returns questions WITHOUT is_correct, plus saved answers and the server-derived expiry.
  const { data, error } = await user.supabase.rpc('get_attempt_questions', { p_attempt: attemptId })
  if (error) notFound()
  const payload = attemptPayloadSchema.parse(data)

  if (payload.finished) redirect(`/courses/${courseId}/quizzes/${quizId}/result/${attemptId}`)
  if (payload.quiz.id !== quizId) notFound()

  return <QuizRunner payload={payload} courseId={courseId} />
}
