import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, ClipboardCheck, Users } from 'lucide-react'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { LocalTime } from '@/components/shared/local-time'
import { ResponsiveTable, type Column } from '@/components/shared/responsive-table'
import { canManage } from '@/features/courses/queries'
import { totalMarks } from '@/features/quizzes/logic'
import { getQuizOrNotFound } from '@/features/quizzes/queries'
import { ShortAnswerGrader } from '@/features/quizzes/components/short-answer-grader'
import { loadDirectory, nameOf } from '@/features/shared/directory'
import { num, percent } from '@/lib/utils'

export const metadata: Metadata = { title: 'Quiz results' }
export const dynamic = 'force-dynamic'

function duration(start: string, end: string | null) {
  if (!end) return '–'
  const s = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000))
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

export default async function QuizResultsPage({ params }: { params: Promise<{ courseId: string; quizId: string }> }) {
  const { courseId, quizId } = await params
  const { user, course, quiz } = await getQuizOrNotFound(courseId, quizId)
  if (!canManage(user, course)) redirect(`/courses/${courseId}/quizzes/${quizId}`)
  const { supabase } = user

  await supabase.rpc('finalize_expired_attempts', { p_quiz: quizId }) // lazily close attempts whose time ran out

  const [attemptsRes, questionsRes, statsRes, shortRes] = await Promise.all([
    supabase.from('quiz_attempts').select('*').eq('quiz_id', quizId).order('started_at', { ascending: false }).limit(1000),
    supabase.from('quiz_questions').select('id, position, type, prompt, marks').eq('quiz_id', quizId).order('position'),
    supabase.rpc('quiz_question_stats', { p_quiz: quizId }),
    supabase.rpc('quiz_short_answers', { p_quiz: quizId }),
  ])
  const attempts = attemptsRes.data ?? []
  const questions = questionsRes.data ?? []
  const stats = new Map((statsRes.data ?? []).map((s) => [s.question_id, s]))
  const shortAnswers = shortRes.data ?? []
  const dir = await loadDirectory(supabase, attempts.map((a) => a.student_id))
  const max = totalMarks(questions)

  // class stats use each student's best finished attempt (matches the gradebook)
  const best = new Map<string, number>()
  for (const a of attempts) {
    if (a.status === 'in_progress' || a.score === null) continue
    best.set(a.student_id, Math.max(best.get(a.student_id) ?? 0, Number(a.score)))
  }
  const scores = [...best.values()]
  const avg = scores.length ? scores.reduce((x, y) => x + y, 0) / scores.length : null
  const pending = shortAnswers.filter((s) => s.marks_awarded === null).length

  type A = (typeof attempts)[number]
  const columns: Column<A>[] = [
    { key: 'student', header: 'Student', primary: true, cell: (a) => <span className="font-medium">{nameOf(dir, a.student_id)}</span> },
    { key: 'roll', header: 'Roll no.', cell: (a) => dir.get(a.student_id)?.roll_no ?? '–' },
    { key: 'score', header: 'Score', cell: (a) => (a.status === 'in_progress' ? '–' : `${num(a.score)} / ${num(max)}`) },
    { key: 'time', header: 'Time taken', cell: (a) => duration(a.started_at, a.submitted_at) },
    {
      key: 'status',
      header: 'Status',
      cell: (a) => <Badge tone={a.status === 'graded' ? 'success' : a.status === 'submitted' ? 'warning' : 'primary'}>{a.status === 'submitted' ? 'Needs grading' : a.status === 'in_progress' ? 'In progress' : 'Graded'}</Badge>,
    },
    { key: 'when', header: 'Started', hideOnMobile: true, cell: (a) => <LocalTime iso={a.started_at} /> },
  ]

  const shortQuestions = questions.filter((q) => q.type === 'short_answer')

  return (
    <>
      <Link href={`/courses/${courseId}/quizzes/${quizId}/edit`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground">
        <ChevronLeft className="size-4" /> Back to builder
      </Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Results</p>
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">{quiz.title}</h2>
        </div>
        <Link href={`/courses/${courseId}/marks`} className={buttonVariants({ variant: 'outline' })}>Open gradebook</Link>
      </div>

      <dl className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ['Students', String(best.size || new Set(attempts.map((a) => a.student_id)).size)],
          ['Average', avg === null ? '–' : `${num(avg)} (${percent(avg, max)}%)`],
          ['Highest', scores.length ? num(Math.max(...scores)) : '–'],
          ['Lowest', scores.length ? num(Math.min(...scores)) : '–'],
          ['To grade', String(pending)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)]">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</dt>
            <dd className="mt-1 font-display text-2xl font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      {attempts.length === 0 ? (
        <EmptyState icon={Users} title="No attempts yet" description="Results appear here as students take the quiz." />
      ) : (
        <>
          <section aria-labelledby="attempts-h" className="mb-10">
            <h3 id="attempts-h" className="mb-3 font-display text-xl font-semibold">Attempts</h3>
            <ResponsiveTable columns={columns} rows={attempts} rowKey={(a) => a.id} caption="Quiz attempts" />
          </section>

          <section aria-labelledby="qstats-h" className="mb-10">
            <h3 id="qstats-h" className="mb-3 font-display text-xl font-semibold">Per-question results</h3>
            <Card>
              <CardContent className="space-y-5 pt-6">
                {questions.map((q, i) => {
                  const s = stats.get(q.id)
                  const rate = s && s.answered > 0 ? Math.round((s.correct / s.answered) * 100) : 0
                  return (
                    <div key={q.id}>
                      <div className="mb-1.5 flex items-start justify-between gap-3 text-sm">
                        <p className="min-w-0 flex-1"><span className="font-semibold">Q{i + 1}.</span> <span className="line-clamp-2">{q.prompt}</span></p>
                        <span className="shrink-0 font-semibold tabular-nums">{q.type === 'short_answer' ? (s?.avg_marks != null ? `avg ${num(s.avg_marks)}/${num(q.marks)}` : '–') : `${rate}%`}</span>
                      </div>
                      <div
                        role="meter"
                        aria-label={`Question ${i + 1} full-marks rate`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={q.type === 'short_answer' ? undefined : rate}
                        className="h-2.5 overflow-hidden rounded-full bg-muted"
                      >
                        <div
                          className={rate >= 70 ? 'h-full rounded-full bg-success' : rate >= 40 ? 'h-full rounded-full bg-warning' : 'h-full rounded-full bg-danger'}
                          style={{ width: `${q.type === 'short_answer' && s?.avg_marks != null && Number(q.marks) > 0 ? Math.round((Number(s.avg_marks) / Number(q.marks)) * 100) : rate}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{s?.answered ?? 0} response{(s?.answered ?? 0) === 1 ? '' : 's'}</p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </section>

          {shortQuestions.length > 0 && (
            <section aria-labelledby="grade-h">
              <h3 id="grade-h" className="mb-3 flex items-center gap-2 font-display text-xl font-semibold">
                <ClipboardCheck className="size-5 text-primary" /> Short-answer grading {pending > 0 && <Badge tone="warning">{pending} to grade</Badge>}
              </h3>
              <div className="space-y-6">
                {shortQuestions.map((q, i) => {
                  const rows = shortAnswers.filter((s) => s.question_id === q.id)
                  return (
                    <Card key={q.id}>
                      <CardHeader>
                        <CardTitle className="text-base">Q{questions.indexOf(q) + 1}. {q.prompt}</CardTitle>
                        <p className="text-sm text-muted-foreground">Up to {num(q.marks)} marks · {rows.length} response{rows.length === 1 ? '' : 's'}</p>
                      </CardHeader>
                      <CardContent>
                        {rows.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No responses yet.</p>
                        ) : (
                          <ul className="space-y-3">
                            {rows.map((r) => (
                              <ShortAnswerGrader key={r.answer_id} answerId={r.answer_id} studentName={nameOf(dir, r.student_id)} text={r.text_answer} maxMarks={Number(q.marks)} initial={r.marks_awarded} />
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}
    </>
  )
}
