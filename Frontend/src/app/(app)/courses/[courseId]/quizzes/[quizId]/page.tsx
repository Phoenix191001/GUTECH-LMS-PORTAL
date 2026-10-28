import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarClock, ChevronLeft, Hourglass, Repeat, Target } from 'lucide-react'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'
import { LocalTime } from '@/components/shared/local-time'
import { canManage } from '@/features/courses/queries'
import { quizState } from '@/features/quizzes/logic'
import { getQuizOrNotFound } from '@/features/quizzes/queries'
import { StartQuizButton } from '@/features/quizzes/components/start-button'
import { num } from '@/lib/utils'

export const metadata: Metadata = { title: 'Quiz' }

export default async function QuizPage({ params }: { params: Promise<{ courseId: string; quizId: string }> }) {
  const { courseId, quizId } = await params
  const { user, course, quiz } = await getQuizOrNotFound(courseId, quizId)
  if (canManage(user, course)) redirect(`/courses/${courseId}/quizzes/${quizId}/edit`)

  const { supabase } = user
  await supabase.rpc('finalize_my_expired_attempts') // close attempts whose time ran out before we read them
  const [{ data: attempts }, { data: max }] = await Promise.all([
    supabase.from('quiz_attempts').select('*').eq('quiz_id', quizId).eq('student_id', user.id).order('started_at', { ascending: false }),
    supabase.from('gradebook').select('max_marks').eq('item_id', quizId).eq('student_id', user.id).maybeSingle(),
  ])
  const list = attempts ?? []
  const { state, canStart, attemptsLeft } = quizState(quiz, list)
  const inProgress = list.find((a) => a.status === 'in_progress')

  return (
    <>
      <Link href={`/courses/${courseId}/quizzes`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground">
        <ChevronLeft className="size-4" /> Quizzes
      </Link>
      <h2 className="font-display text-2xl font-semibold leading-tight text-balance sm:text-3xl">{quiz.title}</h2>
      {quiz.description && <p className="mt-2 max-w-2xl text-muted-foreground">{quiz.description}</p>}

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [Hourglass, 'Time limit', `${quiz.duration_minutes} min`],
          [Repeat, 'Attempts', `${list.length}/${quiz.max_attempts} used`],
          [CalendarClock, 'Opens', <LocalTime key="o" iso={quiz.opens_at} />],
          [CalendarClock, 'Closes', <LocalTime key="c" iso={quiz.closes_at} />],
        ].map(([Icon, label, value], i) => {
          const I = Icon as typeof Hourglass
          return (
            <div key={i} className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)]">
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><I className="size-3.5" /> {label as string}</dt>
              <dd className="mt-1.5 text-sm font-semibold">{value as React.ReactNode}</dd>
            </div>
          )
        })}
      </dl>

      <Card className="mt-6">
        <CardContent className="flex flex-col items-start gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge tone={state === 'open' || state === 'in_progress' ? 'success' : state === 'closed' ? 'danger' : 'neutral'} className="px-3 py-1 text-sm capitalize">
              {state.replace('_', ' ')}
            </Badge>
            {state === 'open' && <p className="pt-1 text-sm text-muted-foreground">{attemptsLeft} attempt{attemptsLeft === 1 ? '' : 's'} left. The timer starts as soon as you press Start.</p>}
            {state === 'upcoming' && <p className="pt-1 text-sm text-muted-foreground">Opens <LocalTime iso={quiz.opens_at} />.</p>}
            {state === 'closed' && <p className="pt-1 text-sm text-muted-foreground">This quiz is closed.</p>}
          </div>
          {canStart && <StartQuizButton courseId={courseId} quizId={quizId} resume={!!inProgress} />}
        </CardContent>
      </Card>

      {inProgress && (
        <Notice tone="warning" className="mt-4">You have a quiz in progress. Its timer keeps running even if you leave the page.</Notice>
      )}

      {list.filter((a) => a.status !== 'in_progress').length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>Your attempts</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {list.filter((a) => a.status !== 'in_progress').map((a, i, arr) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">Attempt {arr.length - i}</p>
                    <p className="text-xs text-muted-foreground">{a.submitted_at ? <LocalTime iso={a.submitted_at} /> : ''}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {a.status === 'graded' ? (
                      <span className="inline-flex items-center gap-1.5 font-semibold"><Target className="size-4 text-success" /> {num(a.score)}{max?.max_marks ? ` / ${num(max.max_marks)}` : ''}</span>
                    ) : (
                      <Badge tone="warning">Awaiting grading</Badge>
                    )}
                    <Link href={`/courses/${courseId}/quizzes/${quizId}/result/${a.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>View</Link>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  )
}
