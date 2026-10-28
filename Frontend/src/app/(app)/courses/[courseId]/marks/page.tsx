import type { Metadata } from 'next'
import Link from 'next/link'
import { Download, GraduationCap } from 'lucide-react'
import { Badge, Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { LocalTime } from '@/components/shared/local-time'
import { canManage, getCourseOrNotFound } from '@/features/courses/queries'
import { classSummary, sortAndFilter, type Cell, type FilterKey, type SortKey } from '@/features/marks/logic'
import { getCourseGradebook, getStudentGradebook } from '@/features/marks/queries'
import { cn, num, percent } from '@/lib/utils'

export const metadata: Metadata = { title: 'Marks' }
export const dynamic = 'force-dynamic'

const SORTS: [SortKey, string][] = [['name', 'Name'], ['roll', 'Roll no.'], ['total', 'Total']]
const FILTERS: [FilterKey | undefined, string][] = [[undefined, 'Everyone'], ['below50', 'Below 50%'], ['missing', 'Missing work']]

function cellView(cell: Cell, max: number) {
  switch (cell.state) {
    case 'graded': {
      const pct = max > 0 ? cell.marks / max : 0
      return <span className={cn('font-semibold tabular-nums', pct >= 0.5 ? 'text-foreground' : 'text-danger')}>{num(cell.marks)}</span>
    }
    case 'pending':
      return <Badge tone="warning">Pending</Badge>
    case 'missing':
      return <Badge tone="danger">Missing</Badge>
    default:
      return <span className="text-muted-foreground">–</span>
  }
}

export default async function MarksPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>
  searchParams: Promise<{ sort?: string; filter?: string }>
}) {
  const { courseId } = await params
  const sp = await searchParams
  const { user, course } = await getCourseOrNotFound(courseId)

  /* ------------------------------ teacher / admin ------------------------------ */
  if (canManage(user, course) || user.profile.role === 'admin') {
    const sort: SortKey = SORTS.some(([k]) => k === sp.sort) ? (sp.sort as SortKey) : 'name'
    const filter = FILTERS.some(([k]) => k === sp.filter) ? (sp.filter as FilterKey) : undefined
    const { items, rows } = await getCourseGradebook(user.supabase, courseId)
    const summary = classSummary(rows)
    const shown = sortAndFilter(rows, sort, filter)
    const href = (patch: { sort?: string; filter?: string | null }) => {
      const s = new URLSearchParams()
      const next = { sort, filter, ...patch }
      if (next.sort && next.sort !== 'name') s.set('sort', next.sort)
      if (next.filter) s.set('filter', next.filter)
      const qs = s.toString()
      return `/courses/${courseId}/marks${qs ? `?${qs}` : ''}`
    }

    if (items.length === 0) {
      return <EmptyState icon={GraduationCap} title="Nothing to grade yet" description="Published assignments and quizzes appear here as columns." />
    }

    return (
      <div className="space-y-5">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            ['Class average', summary.average === null ? '–' : `${summary.average}%`],
            ['Highest', summary.highest === null ? '–' : `${summary.highest}%`],
            ['Lowest', summary.lowest === null ? '–' : `${summary.lowest}%`],
            ['Ungraded items', String(summary.ungraded)],
            ['Missing submissions', String(summary.missing)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)]">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</dt>
              <dd className="mt-1 font-display text-2xl font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter">
            {FILTERS.map(([key, label]) => (
              <Link key={label} href={href({ filter: key ?? null })} aria-current={filter === key ? 'true' : undefined}
                className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition', filter === key ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}>
                {label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by</span>
            <div className="flex gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Sort">
              {SORTS.map(([key, label]) => (
                <Link key={key} href={href({ sort: key })} aria-current={sort === key ? 'true' : undefined}
                  className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition', sort === key ? 'bg-card shadow-[var(--shadow-soft)]' : 'text-muted-foreground hover:text-foreground')}>
                  {label}
                </Link>
              ))}
            </div>
            <a href={`/courses/${courseId}/marks/export`} download className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              <Download /> Export CSV
            </a>
          </div>
        </div>

        <div className="max-h-[70dvh] overflow-auto rounded-2xl border bg-card shadow-[var(--shadow-soft)]">
          <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
            <caption className="sr-only">Gradebook: students by assignments and quizzes</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 top-0 z-30 min-w-44 border-b bg-muted px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Student</th>
                {items.map((item) => (
                  <th key={item.key} scope="col" className="sticky top-0 z-20 min-w-32 border-b bg-muted px-3 py-3 text-center align-bottom">
                    <Link
                      href={item.type === 'assignment' ? `/courses/${courseId}/assignments/${item.id}` : `/courses/${courseId}/quizzes/${item.id}/results`}
                      className="block max-w-40 truncate text-xs font-semibold hover:text-primary"
                      title={item.title}
                    >
                      {item.title}
                    </Link>
                    <span className="text-[0.6875rem] font-normal text-muted-foreground">{item.type === 'quiz' ? 'Quiz' : 'Assignment'} · /{num(item.max)}</span>
                  </th>
                ))}
                <th scope="col" className="sticky top-0 z-20 min-w-24 border-b border-l bg-muted px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</th>
                <th scope="col" className="sticky top-0 z-20 min-w-20 border-b bg-muted px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">%</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={items.length + 3} className="px-4 py-10 text-center text-muted-foreground">No students match this filter.</td></tr>
              )}
              {shown.map((row) => (
                <tr key={row.studentId} className="group">
                  <th scope="row" className="sticky left-0 z-10 border-b bg-card px-4 py-2.5 text-left font-medium group-hover:bg-muted">
                    <span className="block max-w-48 truncate">{row.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">{row.rollNo ?? '–'}{row.removed && ' · Removed'}</span>
                  </th>
                  {row.cells.map((cell, i) => {
                    const item = items[i]!
                    const target = item.type === 'assignment' ? `/courses/${courseId}/assignments/${item.id}/grade/${row.studentId}` : `/courses/${courseId}/quizzes/${item.id}/results`
                    return (
                      <td key={item.key} className="border-b px-3 py-2.5 text-center group-hover:bg-muted/60">
                        <Link href={target} className="block rounded-md px-2 py-1 hover:bg-primary-soft" aria-label={`${item.title} for ${row.name}`}>
                          {cellView(cell, item.max)}
                        </Link>
                      </td>
                    )
                  })}
                  <td className="border-b border-l px-3 py-2.5 text-center font-semibold tabular-nums group-hover:bg-muted/60">{row.totals.max > 0 ? `${num(row.totals.obtained)}/${num(row.totals.max)}` : '–'}</td>
                  <td className="border-b px-3 py-2.5 text-center font-semibold tabular-nums group-hover:bg-muted/60">
                    {row.totals.percent === null ? '–' : <span className={row.totals.percent < 50 ? 'text-danger' : 'text-success'}>{row.totals.percent}%</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Pending, missing and not-yet-due items are left out of each total and percentage until they are graded. Quizzes with several attempts use the best score.</p>
      </div>
    )
  }

  /* --------------------------------- student --------------------------------- */
  const { lines, totals } = await getStudentGradebook(user.supabase, courseId, user.id)
  if (lines.length === 0) {
    return <EmptyState icon={GraduationCap} title="No marks yet" description="Marks for assignments and quizzes appear here once your teacher publishes and grades them." />
  }

  return (
    <div className="space-y-5">
      <Card className="bg-gradient-to-br from-card to-primary-soft/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div>
            <p className="text-sm text-muted-foreground">Course total</p>
            <p className="font-display text-4xl font-semibold">
              {totals.max > 0 ? num(totals.obtained) : '–'} <span className="text-xl text-muted-foreground">/ {num(totals.max)}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-4xl font-semibold text-primary">{totals.percent === null ? '–' : `${totals.percent}%`}</p>
            <p className="text-sm text-muted-foreground">overall</p>
          </div>
        </CardContent>
      </Card>

      <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-soft)] md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Your marks</caption>
          <thead className="bg-muted/60 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              {['Item', 'Type', 'Date', 'Marks', '%', 'Feedback'].map((h) => <th key={h} scope="col" className="px-4 py-3">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.map(({ item, cell, feedback }) => (
              <tr key={item.key}>
                <td className="px-4 py-3 font-medium">{item.title}</td>
                <td className="px-4 py-3"><Badge tone={item.type === 'quiz' ? 'info' : 'neutral'} className="capitalize">{item.type}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground"><LocalTime iso={item.date} mode="date" /></td>
                <td className="px-4 py-3 tabular-nums">{cell.state === 'graded' ? `${num(cell.marks)} / ${num(item.max)}` : cellView(cell, item.max)}</td>
                <td className="px-4 py-3 tabular-nums">{cell.state === 'graded' ? `${percent(cell.marks, item.max)}%` : '–'}</td>
                <td className="max-w-xs px-4 py-3 text-muted-foreground"><span className="line-clamp-2">{feedback ?? '–'}</span></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 bg-muted/40 font-semibold">
            <tr>
              <td className="px-4 py-3" colSpan={3}>Total (graded items only)</td>
              <td className="px-4 py-3 tabular-nums">{num(totals.obtained)} / {num(totals.max)}</td>
              <td className="px-4 py-3 tabular-nums">{totals.percent === null ? '–' : `${totals.percent}%`}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label="Your marks">
        {lines.map(({ item, cell, feedback }) => (
          <li key={item.key} className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground"><span className="capitalize">{item.type}</span> · <LocalTime iso={item.date} mode="date" /></p>
              </div>
              <div className="text-right">
                {cell.state === 'graded' ? (
                  <>
                    <p className="font-semibold tabular-nums">{num(cell.marks)} / {num(item.max)}</p>
                    <p className="text-xs text-muted-foreground">{percent(cell.marks, item.max)}%</p>
                  </>
                ) : cellView(cell, item.max)}
              </div>
            </div>
            {feedback && <p className="mt-3 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">{feedback}</p>}
          </li>
        ))}
        <li className="flex items-center justify-between rounded-2xl bg-primary-soft p-4 font-semibold text-primary-soft-foreground">
          <span>Total</span>
          <span className="tabular-nums">{num(totals.obtained)} / {num(totals.max)} {totals.percent !== null && `· ${totals.percent}%`}</span>
        </li>
      </ul>

      <p className="text-xs text-muted-foreground">Items that are pending, missing or not yet due are left out of your total and percentage until they are graded.</p>
    </div>
  )
}
