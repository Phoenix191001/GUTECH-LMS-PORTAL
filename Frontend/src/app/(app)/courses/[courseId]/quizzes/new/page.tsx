import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/feedback'
import { canManage, getCourseOrNotFound } from '@/features/courses/queries'
import { QuizSettingsForm } from '@/features/quizzes/components/quiz-settings-form'

export const metadata: Metadata = { title: 'New quiz' }

export default async function NewQuizPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const { user, course } = await getCourseOrNotFound(courseId)
  if (!canManage(user, course)) redirect(`/courses/${courseId}/quizzes`)
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New quiz" description="Set the time window and limit first. You will add questions on the next screen." />
      <QuizSettingsForm courseId={courseId} />
    </div>
  )
}
