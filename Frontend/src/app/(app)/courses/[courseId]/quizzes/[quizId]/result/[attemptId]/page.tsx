import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, ChevronLeft, Circle, Clock, XCircle } from 'lucide-react'
import { Badge, Card, CardContent } from '@/components/ui/card'
import { Notice } from '@/components/ui/feedback'
import { LocalTime } from '@/components/shared/local-time'
import { reviewPayloadSchema } from '@/features/quizzes/schemas'
import { getQuizOrNotFound } from '@/features/quizzes/queries'
import { requireUser } from '@/lib/auth'
import { cn, num, percent } from '@/lib/utils'

export const metadata: Metadata = { title: 'Quiz result' }
export const dynamic = 'force-dynamic'

export default async function ResultPage({ params }: { params: Promise<{ courseId: string; quizId: string; attemptId: string }> }) {
  const { courseId, quizId, attemptId } = await params
  const user = await requireUser('student')
  await getQuizOrNotFound(courseId, quizId)
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) notFound()

  await user.supabase.rpc('finalize_my_expired_attempts')
  const { data, error } = await user.supabase.rpc('get_attempt_review', { p_attempt: attemptId })
  if (error) notFound()
  const review = reviewPayloadSchema.parse(data)
  if (review.quiz.id !== quizId) notFound()

  const { attempt, quiz } = review
  const graded = attempt.status === 'graded'
  const pct = percent(attempt.score ?? 0, quiz.max_marks)

  return (
    <>
      <Link href={`/courses/${courseId}/quizzes/${quizId}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground">
        <ChevronLeft className="size-4" /> Back to quiz
      </Link>
      <h2 className="font-display text-2xl font-semibold sm:text-3xl">{quiz.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{attempt.submitted_at ? <>Submitted <LocalTime iso={attempt.submitted_at} /></> : null}</p>

      <Card className={cn('mt-6', graded && 'border-success/40')}>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          {graded ? (
            <>
              <div>
                <p className="text-sm text-muted-foreground">Your score</p>
                <p className="font-display text-5xl font-semibold text-success">
                  {num(attempt.score)} <span className="text-2xl text-muted-foreground">/ {num(quiz.max_marks)}</span>
                </p>
              </div>
              <div className="sm:text-right">
                <p className="font-display text-4xl font-semibold">{pct}%</p>
                <Badge tone="success">Graded</Badge>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-warning-soft text-warning"><Clock className="size-6" /></span>
              <div>
                <p className="font-display text-xl font-semibold">Waiting for your teacher</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Some answers need to be marked by hand. Your final score appears here and in your marks as soon as that is done.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="mt-8" aria-labelledby="review-h">
        <h3 id="review-h" className="mb-4 font-display text-xl font-semibold">Review</h3>
        {!review.review_allowed ? (
          <Notice tone="info">
            Correct answers are shown only after the quiz closes (<LocalTime iso={quiz.closes_at} />) and only if your teacher allows it.
          </Notice>
        ) : (
          <ol className="space-y-4">
            {review.questions.map((q, i) => {
              const fullMarks = q.marks_awarded !== null && q.marks_awarded >= q.marks
              return (
                <li key={q.id}>
                  <Card className="p-5">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-primary">Question {i + 1}</p>
                      <Badge tone={q.marks_awarded === null ? 'neutral' : fullMarks ? 'success' : q.marks_awarded > 0 ? 'warning' : 'danger'}>
                        {q.marks_awarded === null ? 'Pending' : `${num(q.marks_awarded)} / ${num(q.marks)}`}
                      </Badge>
                    </div>
                    <p className="whitespace-pre-wrap font-medium">{q.prompt}</p>
                    {q.type === 'short_answer' ? (
                      <div className="mt-3 rounded-xl bg-muted/50 p-4 text-sm">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your answer</p>
                        <p className="whitespace-pre-wrap">{q.text_answer?.trim() || <span className="text-muted-foreground">No answer</span>}</p>
                      </div>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {q.options.map((o) => {
                          const chosen = q.selected_option_ids.includes(o.id)
                          return (
                            <li
                              key={o.id}
                              className={cn(
                                'flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm',
                                o.is_correct ? 'border-success/40 bg-success-soft/50' : chosen ? 'border-danger/40 bg-danger-soft/50' : 'bg-card',
                              )}
                            >
                              {o.is_correct ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : chosen ? <XCircle className="mt-0.5 size-4 shrink-0 text-danger" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                              <span className="flex-1">{o.text}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {chosen && 'Your answer'}
                                {chosen && o.is_correct && ' · '}
                                {o.is_correct && 'Correct'}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </Card>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </>
  )
}
