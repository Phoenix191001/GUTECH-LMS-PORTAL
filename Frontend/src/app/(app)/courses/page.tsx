import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, ClipboardList, Timer, Users } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { loadDirectory } from '@/features/shared/directory'
import { Badge } from '@/components/ui/card'
import { EmptyState, PageHeader } from '@/components/ui/feedback'
import { buttonVariants } from '@/components/ui/button'
import { Avatar } from '@/components/shared/avatar'

export const metadata: Metadata = { title: 'Courses' }

export default async function CoursesPage() {
  const { supabase, profile } = await requireUser()

  // RLS makes this role-aware: admin all, teacher own, student enrolled.
  const [{ data: courses }, { data: overview }] = await Promise.all([
    supabase.from('courses').select('*').order('code'),
    supabase.rpc('course_overview'),
  ])
  const stats = new Map((overview ?? []).map((o) => [o.course_id, o]))
  const dir = await loadDirectory(supabase, (courses ?? []).map((c) => c.teacher_id))
  const isStudent = profile.role === 'student'

  return (
    <>
      <PageHeader
        eyebrow="Learning"
        title="Courses"
        description={
          profile.role === 'admin'
            ? 'Every course in the institution.'
            : profile.role === 'teacher'
              ? 'The courses you teach.'
              : 'The courses you are enrolled in.'
        }
        actions={
          profile.role === 'admin' && (
            <Link href="/admin/courses" className={buttonVariants({ variant: 'soft' })}>
              Manage courses
            </Link>
          )
        }
      />

      {(courses ?? []).length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description={isStudent ? 'You are not enrolled in any course yet. Your administrator will add you.' : 'Courses appear here once they are created and assigned.'}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(courses ?? []).map((course, i) => {
            const s = stats.get(course.id)
            const teacher = dir.get(course.teacher_id)
            return (
              <li key={course.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <Link
                  href={`/courses/${course.id}/resources`}
                  className="group relative block h-full overflow-hidden rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
                >
                  <span aria-hidden className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-primary to-accent-pink opacity-90 transition-opacity group-hover:opacity-100" />
                  <div className="flex items-start justify-between gap-3">
                    <Badge tone="primary" className="font-semibold tracking-wide">{course.code}</Badge>
                    {!course.is_active && <Badge tone="warning">Inactive</Badge>}
                  </div>
                  <h2 className="mt-4 font-display text-xl font-semibold leading-snug group-hover:text-primary">{course.title}</h2>
                  {course.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>}
                  <div className="mt-4 flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Avatar name={teacher?.full_name ?? 'Teacher'} size="xs" />
                    <span className="truncate">{teacher?.full_name ?? 'Unassigned'}</span>
                  </div>
                  <dl className="mt-5 grid grid-cols-3 gap-2 border-t pt-4 text-center">
                    <div>
                      <dt className="sr-only">Pending assignments</dt>
                      <dd className="flex flex-col items-center gap-0.5">
                        <ClipboardList className="size-4 text-primary" />
                        <span className="text-lg font-semibold leading-none">{s?.pending_assignments ?? 0}</span>
                        <span className="text-[0.6875rem] text-muted-foreground">{isStudent ? 'To do' : 'Open'}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="sr-only">Open quizzes</dt>
                      <dd className="flex flex-col items-center gap-0.5">
                        <Timer className="size-4 text-primary" />
                        <span className="text-lg font-semibold leading-none">{s?.open_quizzes ?? 0}</span>
                        <span className="text-[0.6875rem] text-muted-foreground">Quizzes</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="sr-only">Students</dt>
                      <dd className="flex flex-col items-center gap-0.5">
                        <Users className="size-4 text-primary" />
                        <span className="text-lg font-semibold leading-none">{isStudent ? '—' : (s?.student_count ?? 0)}</span>
                        <span className="text-[0.6875rem] text-muted-foreground">Students</span>
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
