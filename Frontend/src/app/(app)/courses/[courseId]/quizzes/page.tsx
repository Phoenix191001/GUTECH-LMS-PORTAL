import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarClock, Plus, Timer } from 'lucide-react'
import { Badge, type Tone } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/ui/feedback'
import { Pagination, parsePage } from '@/components/shared/pagination'
import { LocalTime } from '@/components/shared/local-time'
import { canManage, getCourseOrNotFound } from '@/features/courses/queries'
import { quizState, type QuizState } from '@/features/quizzes/logic'
import { PAGE_SIZE } from '@/lib/utils'

export const metadata: Metadata = { title: 'Quizzes' }

const STATE_CHIP: Record<QuizState, { label: string; tone: Tone }> = {
  upcoming: { label: 'Upcoming', tone: 'neutral' },
  open: { label: 'Open', tone: 'success' },
  in_progress: { label: 'In progress', tone: 'primary' },
  submitted: { label: 'Submitted', tone: 'info' },
  closed: { label: 'Closed', tone: 'danger' },
}

export default async function QuizzesPage({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<{ page?: string }> }) {
  const { courseId } = await params
  const page = parsePage((await searchParams).page)
  const { user, course } = await getCourseOrNotFound(courseId)
  const { supabase } = user
  const manage = canManage(user, course)

  if (!manage) await supabase.rpc('finalize_my_expired_attempts') // lazily close attempts whose time ran out

  const { data: quizzes, count, error } = await supabase
    .from('quizzes')
    .select('*, quiz_attempts(count)', { count: 'exact' })
    .eq('course_id', courseId)
    .order('opens_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (error) return <ErrorState description="We could not load the quizzes. Please refresh the page." />

  const ids = (quizzes ?? []).map((q) => q.id)
  const mine = !manage && ids.length ? (await supabase.from('quiz_attempts').select('quiz_id, status, started_at, score').eq('student_id', user.id).in('quiz_id', ids)).data ?? [] : []
  const now = Date.now()

  return (
    <div className="space-y-5">
      {manage && (
        <div className="flex justify-end">
          <Link href={`/courses/${courseId}/quizzes/new`} className={buttonVariants()}>
            <Plus /> New quiz
          </Link>
        </div>
      )}

      {(quizzes ?? []).length === 0 ? (
        <EmptyState
          icon={Timer}
          title="No quizzes yet"
          description={manage ? 'Build a timed quiz with auto-graded questions.' : 'Quizzes your teacher publishes will show up here.'}
          action={manage ? <Link href={`/courses/${courseId}/quizzes/new`} className={buttonVariants()}><Plus /> New quiz</Link> : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {(quizzes ?? []).map((q, i) => {
            const attempts = mine.filter((a) => a.quiz_id === q.id)
            const st = manage ? null : quizState(q, attempts, now)
            const chip = st ? STATE_CHIP[st.state] : null
            return (
              <li key={q.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <Link
                  href={manage ? `/courses/${courseId}/quizzes/${q.id}/edit` : `/courses/${courseId}/quizzes/${q.id}`}
                  className="group flex items-start gap-4 rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] sm:p-5"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                    <Timer className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium leading-snug group-hover:text-primary">{q.title}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-3.5" /> <LocalTime iso={q.opens_at} /> – <LocalTime iso={q.closes_at} /></span>
                      <span>{q.duration_minutes} min</span>
                      <span>{q.max_attempts} attempt{q.max_attempts === 1 ? '' : 's'}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    {manage ? (
                      <>
                        <Badge tone={q.is_published ? 'success' : 'neutral'}>{q.is_published ? 'Published' : 'Draft'}</Badge>
                        <Badge tone="info">{q.quiz_attempts[0]?.count ?? 0} attempt{(q.quiz_attempts[0]?.count ?? 0) === 1 ? '' : 's'}</Badge>
                      </>
                    ) : (
                      chip && <Badge tone={chip.tone}>{chip.label}</Badge>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath={`/courses/${courseId}/quizzes`} />
    </div>
  )
}
