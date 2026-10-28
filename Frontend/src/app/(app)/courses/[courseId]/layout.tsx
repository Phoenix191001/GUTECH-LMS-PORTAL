import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Badge } from '@/components/ui/card'
import { CourseTabs } from '@/features/courses/components/course-tabs'
import { getCourseOrNotFound } from '@/features/courses/queries'

export default async function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ courseId: string }>
}) {
  const { courseId } = await params
  const { user, course, teacher } = await getCourseOrNotFound(courseId)
  const { data: unread } = await user.supabase.rpc('unread_chat_counts')
  const chatUnread = Number((unread ?? []).find((r) => r.course_id === course.id)?.unread ?? 0)

  return (
    <>
      <Link href="/courses" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground">
        <ChevronLeft className="size-4" /> All courses
      </Link>
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="primary" className="font-semibold tracking-wide">{course.code}</Badge>
          {!course.is_active && <Badge tone="warning">Inactive</Badge>}
        </div>
        <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-tight text-balance sm:text-[2rem]">{course.title}</h1>
        {teacher && <p className="mt-1 text-sm text-muted-foreground">Taught by {teacher.full_name}</p>}
      </header>
      <CourseTabs courseId={course.id} chatUnread={chatUnread} />
      {children}
    </>
  )
}
