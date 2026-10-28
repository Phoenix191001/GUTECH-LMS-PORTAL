import type { Metadata } from 'next'
import Link from 'next/link'
import { GraduationCap, Plus } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { Badge } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/feedback'
import { Pagination, parsePage } from '@/components/shared/pagination'
import { ResponsiveTable, type Column } from '@/components/shared/responsive-table'
import { SearchInput } from '@/components/shared/search-input'
import { CreateCourseDialog } from '@/features/courses/components/course-admin-forms'
import { loadDirectory } from '@/features/shared/directory'
import { PAGE_SIZE } from '@/lib/utils'

export const metadata: Metadata = { title: 'Manage courses' }

export default async function AdminCoursesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { supabase } = await requireUser('admin')
  const sp = await searchParams
  const page = parsePage(sp.page)
  const q = (sp.q ?? '').replace(/[,()*\\%_]/g, ' ').trim()

  let query = supabase
    .from('courses')
    .select('*, enrollments(count)', { count: 'exact' })
    .order('code')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (q) query = query.or(`code.ilike.%${q}%,title.ilike.%${q}%`)

  const [{ data: courses, count, error }, teachersRes] = await Promise.all([
    query,
    supabase.from('profiles').select('id, full_name').eq('role', 'teacher').eq('is_active', true).order('full_name').limit(500),
  ])
  const teachers = (teachersRes.data ?? []).map((t) => ({ id: t.id, name: t.full_name }))
  const dir = await loadDirectory(supabase, (courses ?? []).map((c) => c.teacher_id))

  type CourseRow = NonNullable<typeof courses>[number]
  const columns: Column<CourseRow>[] = [
    {
      key: 'code',
      header: 'Course',
      primary: true,
      cell: (c) => (
        <Link href={`/admin/courses/${c.id}`} className="group flex items-center gap-3">
          <Badge tone="primary" className="font-semibold">{c.code}</Badge>
          <span className="font-medium group-hover:text-primary">{c.title}</span>
        </Link>
      ),
    },
    { key: 'teacher', header: 'Teacher', cell: (c) => dir.get(c.teacher_id)?.full_name ?? <span className="text-muted-foreground">Unassigned</span> },
    { key: 'students', header: 'Students', cell: (c) => c.enrollments[0]?.count ?? 0 },
    { key: 'status', header: 'Status', cell: (c) => <Badge tone={c.is_active ? 'success' : 'warning'}>{c.is_active ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions',
      header: '',
      actions: true,
      className: 'text-right',
      cell: (c) => (
        <Link href={`/admin/courses/${c.id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Manage
        </Link>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Courses"
        description="Create courses, assign a teacher and enrol students."
        actions={
          <CreateCourseDialog
            teachers={teachers}
            trigger={
              <Button>
                <Plus /> Add course
              </Button>
            }
          />
        }
      />
      <SearchInput placeholder="Search by code or title" className="mb-5 sm:max-w-sm" />
      {error ? (
        <ErrorState description="We could not load the courses. Please refresh the page." />
      ) : (courses ?? []).length === 0 ? (
        <EmptyState icon={GraduationCap} title={q ? 'No matching courses' : 'No courses yet'} description={q ? 'Try a different search.' : 'Add your first course, then enrol students.'} />
      ) : (
        <ResponsiveTable columns={columns} rows={courses ?? []} rowKey={(c) => c.id} caption="Courses" />
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/admin/courses" params={{ q: q || undefined }} />
    </>
  )
}
