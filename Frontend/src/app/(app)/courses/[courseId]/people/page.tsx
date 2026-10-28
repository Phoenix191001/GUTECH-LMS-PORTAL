import type { Metadata } from 'next'
import { GraduationCap, Mail, Users } from 'lucide-react'
import { Badge } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/feedback'
import { Avatar } from '@/components/shared/avatar'
import { canManage, getCourseOrNotFound } from '@/features/courses/queries'
import { signedUrls } from '@/lib/storage'

export const metadata: Metadata = { title: 'People' }

export default async function PeoplePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const { user, course } = await getCourseOrNotFound(courseId)
  const { data } = await user.supabase.rpc('course_people', { p_course: courseId })
  const people = data ?? []
  const teacher = people.find((p) => p.is_teacher)
  const students = people.filter((p) => !p.is_teacher).sort((a, b) => a.full_name.localeCompare(b.full_name))
  const showEmail = canManage(user, course)
  const avatars = await signedUrls(user.supabase, 'avatars', people.map((p) => p.avatar_url))

  return (
    <div className="space-y-8">
      <section aria-labelledby="teacher-h">
        <h2 id="teacher-h" className="mb-3 flex items-center gap-2 font-display text-xl font-semibold">
          <GraduationCap className="size-5 text-primary" /> Teacher
        </h2>
        {teacher ? (
          <div className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)]">
            <Avatar name={teacher.full_name} src={teacher.avatar_url ? avatars.get(teacher.avatar_url) : null} size="lg" />
            <div className="min-w-0">
              <p className="font-medium">{teacher.full_name}</p>
              {showEmail && teacher.email && (
                <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                  <Mail className="size-3.5" /> {teacher.email}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No teacher assigned.</p>
        )}
      </section>

      <section aria-labelledby="students-h">
        <h2 id="students-h" className="mb-3 flex items-center gap-2 font-display text-xl font-semibold">
          <Users className="size-5 text-primary" /> Students <Badge>{students.length}</Badge>
        </h2>
        {students.length === 0 ? (
          <EmptyState icon={Users} title="No students yet" description="Students appear here once the administrator enrols them." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {students.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-[var(--shadow-soft)]">
                <Avatar name={s.full_name} src={s.avatar_url ? avatars.get(s.avatar_url) : null} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.roll_no ?? 'No roll number'}</p>
                  {showEmail && s.email && <p className="truncate text-xs text-muted-foreground">{s.email}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
