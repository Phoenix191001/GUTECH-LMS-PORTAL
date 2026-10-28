import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarClock, ClipboardList, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/ui/feedback'
import { Pagination, parsePage } from '@/components/shared/pagination'
import { LocalTime } from '@/components/shared/local-time'
import { canManage, getCourseOrNotFound } from '@/features/courses/queries'
import { statusChip, studentStatus } from '@/features/assignments/status'
import { num, PAGE_SIZE } from '@/lib/utils'

export const metadata: Metadata = { title: 'Assignments' }

export default async function AssignmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { courseId } = await params
  const page = parsePage((await searchParams).page)
  const { user, course } = await getCourseOrNotFound(courseId)
  const { supabase } = user
  const manage = canManage(user, course)
  const now = Date.now()

  // Students see upcoming work first (soonest deadline), then past work (newest first); RLS hides drafts from them.
  const { data, count, error } = await supabase
    .from('assignments')
    .select('*, submissions(count)', { count: 'exact' })
    .eq('course_id', courseId)
    .order('due_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (error) return <ErrorState description="We could not load the assignments. Please refresh the page." />

  let assignments = data ?? []
  if (!manage) {
    const upcoming = assignments.filter((a) => new Date(a.due_at).getTime() >= now).sort((a, b) => a.due_at.localeCompare(b.due_at))
    const past = assignments.filter((a) => new Date(a.due_at).getTime() < now)
    assignments = [...upcoming, ...past]
  }

  const [mine, enrolled] = await Promise.all([
    !manage && assignments.length
      ? supabase.from('submissions').select('*').eq('student_id', user.id).in('assignment_id', assignments.map((a) => a.id))
      : Promise.resolve({ data: [] }),
    manage ? supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('course_id', courseId) : Promise.resolve({ count: 0 }),
  ])
  const mySubs = new Map((mine.data ?? []).map((s) => [s.assignment_id, s]))
  const studentCount = enrolled.count ?? 0

  return (
    <div className="space-y-5">
      {manage && (
        <div className="flex justify-end">
          <Link href={`/courses/${courseId}/assignments/new`} className={buttonVariants()}>
            <Plus /> New assignment
          </Link>
        </div>
      )}

      {assignments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No assignments yet"
          description={manage ? 'Create the first assignment for this course.' : 'Assignments your teacher publishes will show up here.'}
          action={
            manage ? (
              <Link href={`/courses/${courseId}/assignments/new`} className={buttonVariants()}>
                <Plus /> New assignment
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {assignments.map((a, i) => {
            const sub = mySubs.get(a.id)
            const chip = manage ? null : statusChip(studentStatus(a, sub, now), a, sub)
            const submitted = a.submissions[0]?.count ?? 0
            const overdue = new Date(a.due_at).getTime() < now
            return (
              <li key={a.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <Link
                  href={`/courses/${courseId}/assignments/${a.id}`}
                  className="group flex items-start gap-4 rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] sm:p-5"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground">
                    <ClipboardList className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium leading-snug group-hover:text-primary">{a.title}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="size-3.5" />
                        {overdue ? 'Was due' : 'Due'} <LocalTime iso={a.due_at} />
                      </span>
                      <span>{num(a.max_marks)} marks</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    {manage ? (
                      <>
                        <Badge tone={a.is_published ? 'success' : 'neutral'}>{a.is_published ? 'Published' : 'Draft'}</Badge>
                        {a.is_published && <Badge tone="info">{submitted}/{studentCount} submitted</Badge>}
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

      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath={`/courses/${courseId}/assignments`} />
    </div>
  )
}
