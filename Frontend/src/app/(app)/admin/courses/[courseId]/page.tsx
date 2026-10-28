import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ExternalLink, Users } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { Badge } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/feedback'
import { Pagination, parsePage } from '@/components/shared/pagination'
import { ResponsiveTable, type Column } from '@/components/shared/responsive-table'
import { SearchInput } from '@/components/shared/search-input'
import { Avatar } from '@/components/shared/avatar'
import { CourseActiveToggle, CourseDetailsForm, CourseTeacherForm } from '@/features/courses/components/course-admin-forms'
import { EnrollCsvDialog, EnrollStudentsDialog, RemoveEnrollmentButton } from '@/features/courses/components/enrollment-dialogs'
import { loadDirectory, type DirEntry } from '@/features/shared/directory'
import { cn, PAGE_SIZE } from '@/lib/utils'

export const metadata: Metadata = { title: 'Course admin' }

const TABS = [
  ['details', 'Details'],
  ['students', 'Students'],
  ['teacher', 'Teacher'],
] as const

export default async function AdminCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>
}) {
  const { courseId } = await params
  const sp = await searchParams
  const { supabase } = await requireUser('admin')
  if (!/^[0-9a-f-]{36}$/i.test(courseId)) notFound()

  const { data: course } = await supabase.from('courses').select('*').eq('id', courseId).maybeSingle()
  if (!course) notFound()

  const tab = TABS.some(([t]) => t === sp.tab) ? (sp.tab as 'details' | 'students' | 'teacher') : 'details'
  const [enrolledRes, teachersRes] = await Promise.all([
    supabase.from('enrollments').select('id, student_id, enrolled_at').eq('course_id', courseId).limit(2000),
    supabase.from('profiles').select('id, full_name').eq('role', 'teacher').eq('is_active', true).order('full_name').limit(500),
  ])
  const enrollments = enrolledRes.data ?? []
  // keep the current teacher selectable even if they were later deactivated
  const teachers = (teachersRes.data ?? []).map((t) => ({ id: t.id, name: t.full_name }))
  const dir = await loadDirectory(supabase, [course.teacher_id, ...enrollments.map((e) => e.student_id)])
  if (!teachers.some((t) => t.id === course.teacher_id)) {
    teachers.unshift({ id: course.teacher_id, name: `${dir.get(course.teacher_id)?.full_name ?? 'Current teacher'} (inactive)` })
  }

  return (
    <>
      <Link href="/admin/courses" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground">
        <ChevronLeft className="size-4" /> All courses
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="primary" className="font-semibold">{course.code}</Badge>
            <Badge tone={course.is_active ? 'success' : 'warning'}>{course.is_active ? 'Active' : 'Inactive'}</Badge>
          </div>
          <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-tight sm:text-[2rem]">{course.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{enrollments.length} enrolled · Teacher: {dir.get(course.teacher_id)?.full_name ?? 'Unassigned'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/courses/${course.id}/resources`} className={buttonVariants({ variant: 'outline' })}>
            <ExternalLink /> Open course
          </Link>
          <CourseActiveToggle courseId={course.id} active={course.is_active} />
        </div>
      </div>

      <nav aria-label="Course admin sections" className="mb-6 flex gap-1 rounded-2xl border bg-card p-1.5 shadow-[var(--shadow-soft)] sm:inline-flex">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/courses/${course.id}?tab=${key}`}
            aria-current={tab === key ? 'page' : undefined}
            className={cn('flex-1 rounded-xl px-5 py-2 text-center text-sm font-medium transition-colors sm:flex-none', tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === 'details' && <CourseDetailsForm course={course} />}
      {tab === 'teacher' && <CourseTeacherForm courseId={course.id} teacherId={course.teacher_id} teachers={teachers} />}
      {tab === 'students' && <StudentsTab courseId={course.id} enrollments={enrollments} dir={dir} sp={sp} supabase={supabase} />}
    </>
  )
}

async function StudentsTab({
  courseId,
  enrollments,
  dir,
  sp,
  supabase,
}: {
  courseId: string
  enrollments: { id: string; student_id: string; enrolled_at: string }[]
  dir: Map<string, DirEntry>
  sp: { q?: string; page?: string }
  supabase: Awaited<ReturnType<typeof requireUser>>['supabase']
}) {
  const page = parsePage(sp.page)
  const needle = (sp.q ?? '').trim().toLowerCase()
  const enrolledIds = new Set(enrollments.map((e) => e.student_id))

  const { data: all } = await supabase.from('profiles').select('id, full_name, email, roll_no').eq('role', 'student').eq('is_active', true).order('full_name').limit(600)
  const candidatesAll = (all ?? []).filter((s) => !enrolledIds.has(s.id))
  const candidates = candidatesAll.slice(0, 500).map((s) => ({ id: s.id, name: s.full_name, rollNo: s.roll_no, email: s.email }))

  const rows = enrollments
    .map((e) => ({ ...e, person: dir.get(e.student_id) }))
    .filter((r) => !needle || `${r.person?.full_name ?? ''} ${r.person?.roll_no ?? ''}`.toLowerCase().includes(needle))
    .sort((a, b) => (a.person?.full_name ?? '').localeCompare(b.person?.full_name ?? ''))
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  type R = (typeof rows)[number]
  const columns: Column<R>[] = [
    {
      key: 'name',
      header: 'Student',
      primary: true,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.person?.full_name ?? '?'} size="sm" />
          <span className="font-medium">{r.person?.full_name ?? 'Unknown'}</span>
        </div>
      ),
    },
    { key: 'roll', header: 'Roll no.', cell: (r) => r.person?.roll_no ?? <span className="text-muted-foreground">–</span> },
    { key: 'actions', header: '', actions: true, className: 'text-right', cell: (r) => <RemoveEnrollmentButton enrollmentId={r.id} name={r.person?.full_name ?? 'this student'} /> },
  ]

  return (
    <section aria-labelledby="students-heading">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <h2 id="students-heading" className="font-display text-xl font-semibold">{enrollments.length} enrolled</h2>
        <SearchInput placeholder="Search enrolled students" className="sm:ml-4 sm:max-w-xs sm:flex-1" />
        <div className="flex gap-2 sm:ml-auto">
          <EnrollCsvDialog courseId={courseId} />
          <EnrollStudentsDialog courseId={courseId} candidates={candidates} truncated={candidatesAll.length > 500} />
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Users} title={needle ? 'No matching students' : 'No students enrolled'} description={needle ? 'Try a different search.' : 'Add students one by one, many at once, or from a CSV.'} />
      ) : (
        <ResponsiveTable columns={columns} rows={pageRows} rowKey={(r) => r.id} caption="Enrolled students" />
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} basePath={`/admin/courses/${courseId}`} params={{ tab: 'students', q: needle || undefined }} />
    </section>
  )
}
