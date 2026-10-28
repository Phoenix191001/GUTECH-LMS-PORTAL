import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { canManage } from '@/features/courses/queries'
import { getQuizOrNotFound } from '@/features/quizzes/queries'
import { QuizBuilder } from '@/features/quizzes/components/quiz-builder'
import { QuizSettingsForm } from '@/features/quizzes/components/quiz-settings-form'
import type { BuilderQuestion } from '@/features/quizzes/components/question-editor'

export const metadata: Metadata = { title: 'Quiz builder' }

export default async function EditQuizPage({ params }: { params: Promise<{ courseId: string; quizId: string }> }) {
  const { courseId, quizId } = await params
  const { user, course, quiz } = await getQuizOrNotFound(courseId, quizId)
  if (!canManage(user, course)) redirect(`/courses/${courseId}/quizzes/${quizId}`)

  const [{ data: questions }, { count }] = await Promise.all([
    user.supabase.from('quiz_questions').select('*, quiz_options(*)').eq('quiz_id', quizId).order('position'),
    user.supabase.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('quiz_id', quizId),
  ])

  const builderQuestions: BuilderQuestion[] = (questions ?? []).map((q, i) => ({
    id: q.id,
    position: i + 1, // display position; stored positions may have gaps after deletes
    type: q.type,
    prompt: q.prompt,
    marks: Number(q.marks),
    options: [...q.quiz_options].sort((a, b) => a.position - b.position),
  }))

  return (
    <>
      <Link href={`/courses/${courseId}/quizzes`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground">
        <ChevronLeft className="size-4" /> Quizzes
      </Link>
      <h2 className="mb-6 font-display text-2xl font-semibold sm:text-3xl">{quiz.title}</h2>
      <div className="grid gap-8 xl:grid-cols-[1fr_24rem]">
        <section aria-labelledby="questions-h" className="order-2 xl:order-1">
          <h3 id="questions-h" className="mb-4 font-display text-xl font-semibold">Questions</h3>
          <QuizBuilder quiz={quiz} questions={builderQuestions} hasAttempts={(count ?? 0) > 0} />
        </section>
        <section aria-labelledby="settings-h" className="order-1 xl:order-2">
          <details className="group rounded-2xl border bg-card shadow-[var(--shadow-soft)] xl:[&>summary]:pointer-events-none" open>
            <summary id="settings-h" className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-display text-xl font-semibold">
              Settings
              <span className="text-sm font-normal text-muted-foreground xl:hidden group-open:hidden">Show</span>
            </summary>
            <div className="border-t p-4">
              <QuizSettingsForm courseId={courseId} quiz={quiz} />
            </div>
          </details>
        </section>
      </div>
    </>
  )
}
