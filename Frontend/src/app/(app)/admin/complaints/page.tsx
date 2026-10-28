import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { Badge } from '@/components/ui/card'
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/feedback'
import { FilterSelect } from '@/components/shared/filter-select'
import { Pagination, parsePage } from '@/components/shared/pagination'
import { ResponsiveTable, type Column } from '@/components/shared/responsive-table'
import { SearchInput } from '@/components/shared/search-input'
import { LocalTime } from '@/components/shared/local-time'
import { AdminReviewButton, StatusChip, type ComplaintView } from '@/features/complaints/components/complaint-ui'
import { CATEGORIES, CATEGORY_LABEL, STATUSES, STATUS_LABEL, referenceOf } from '@/features/complaints/schemas'
import { loadDirectory } from '@/features/shared/directory'
import { cn, PAGE_SIZE } from '@/lib/utils'
import type { ComplaintCategory, ComplaintStatus } from '@/types/database'

export const metadata: Metadata = { title: 'Review complaints' }
export const dynamic = 'force-dynamic'

type SP = { status?: string; category?: string; course?: string; q?: string; page?: string }

export default async function AdminComplaintsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { supabase } = await requireUser('admin')
  const sp = await searchParams
  const page = parsePage(sp.page)
  const status = STATUSES.find((s) => s === sp.status) as ComplaintStatus | undefined
  const category = CATEGORIES.find((c) => c === sp.category) as ComplaintCategory | undefined
  const course = /^[0-9a-f-]{36}$/i.test(sp.course ?? '') ? sp.course : undefined
  const q = (sp.q ?? '').replace(/[,()*\\%_]/g, ' ').trim()

  let query = supabase
    .from('complaints')
    .select('*, courses(code)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (status) query = query.eq('status', status)
  if (category) query = query.eq('category', category)
  if (course) query = query.eq('course_id', course)
  if (q) query = query.or(`subject.ilike.%${q}%,description.ilike.%${q}%`)

  const [list, courses, openCount] = await Promise.all([
    query,
    supabase.from('courses').select('id, code').order('code').limit(300),
    supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'open'),
  ])
  if (list.error) return <ErrorState description="We could not load the complaints. Please refresh the page." />

  const dir = await loadDirectory(supabase, (list.data ?? []).map((c) => c.submitted_by))
  const rows: ComplaintView[] = (list.data ?? []).map((c) => ({
    id: c.id,
    subject: c.subject,
    description: c.description,
    category: c.category,
    status: c.status,
    adminResponse: c.admin_response,
    createdAt: c.created_at,
    resolvedAt: c.resolved_at,
    courseCode: c.courses?.code ?? null,
    submitterName: dir.get(c.submitted_by)?.full_name,
    submitterRole: dir.get(c.submitted_by)?.role,
  }))

  const href = (patch: Partial<SP>) => {
    const s = new URLSearchParams()
    const merged: SP = { status, category, course, q: q || undefined, ...patch }
    for (const [k, v] of Object.entries(merged)) if (v) s.set(k, v)
    const qs = s.toString()
    return `/admin/complaints${qs ? `?${qs}` : ''}`
  }

  const columns: Column<ComplaintView>[] = [
    {
      key: 'subject',
      header: 'Complaint',
      primary: true,
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{c.subject}</p>
          <p className="text-xs text-muted-foreground"><span className="font-mono">#{referenceOf(c.id)}</span> · {CATEGORY_LABEL[c.category]}</p>
        </div>
      ),
    },
    { key: 'from', header: 'From', cell: (c) => <span>{c.submitterName ?? 'Unknown'} <span className="text-xs capitalize text-muted-foreground">({c.submitterRole})</span></span> },
    { key: 'course', header: 'Course', cell: (c) => (c.courseCode ? <Badge tone="info">{c.courseCode}</Badge> : <span className="text-muted-foreground">–</span>) },
    { key: 'status', header: 'Status', cell: (c) => <StatusChip status={c.status} /> },
    { key: 'date', header: 'Filed', cell: (c) => <LocalTime iso={c.createdAt} mode="date" /> },
    { key: 'actions', header: '', actions: true, className: 'text-right', cell: (c) => <AdminReviewButton complaint={c} /> },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Complaints"
        description={`${openCount.count ?? 0} open · review, respond and close.`}
      />

      <div className="mb-5 space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {[undefined, ...STATUSES].map((s) => (
            <Link
              key={s ?? 'all'}
              href={href({ status: s, page: undefined })}
              aria-current={status === s ? 'true' : undefined}
              className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition', status === s ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
            >
              {s ? STATUS_LABEL[s] : 'All'}
            </Link>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchInput placeholder="Search subject or description" className="sm:max-w-xs sm:flex-1" />
          <FilterSelect action="/admin/complaints" name="category" value={category} label="Category" allLabel="All categories" className="sm:w-48" options={CATEGORIES.map((c) => [c, CATEGORY_LABEL[c]])} carry={{ status, category, course, q: q || undefined }} />
          <FilterSelect action="/admin/complaints" name="course" value={course} label="Course" allLabel="All courses" className="sm:w-48" options={(courses.data ?? []).map((c) => [c.id, c.code])} carry={{ status, category, course, q: q || undefined }} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="No complaints found" description="Nothing matches these filters." />
      ) : (
        <ResponsiveTable columns={columns} rows={rows} rowKey={(c) => c.id} caption="Complaints" />
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={list.count ?? 0} basePath="/admin/complaints" params={{ status, category, course, q: q || undefined }} />
    </>
  )
}
