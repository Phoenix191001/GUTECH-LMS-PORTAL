import type { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/feedback'
import { Pagination, parsePage } from '@/components/shared/pagination'
import { canManage, getCourseOrNotFound } from '@/features/courses/queries'
import { loadFeed } from '@/features/announcements/queries'
import { AnnouncementDialog } from '@/features/announcements/components/announcement-dialog'
import { AnnouncementFeed } from '@/features/announcements/components/announcement-feed'
import { PAGE_SIZE } from '@/lib/utils'

export const metadata: Metadata = { title: 'Announcements' }

export default async function CourseAnnouncementsPage({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<{ page?: string }> }) {
  const { courseId } = await params
  const page = parsePage((await searchParams).page)
  const { user, course } = await getCourseOrNotFound(courseId)
  const manage = canManage(user, course)

  let feed
  try {
    feed = await loadFeed(user.supabase, user.id, { courseId }, { page, pageSize: PAGE_SIZE })
  } catch {
    return <ErrorState description="We could not load the announcements. Please refresh the page." />
  }

  const post = (
    <AnnouncementDialog courseId={courseId} trigger={<Button><Plus /> New announcement</Button>} />
  )

  return (
    <div className="space-y-5">
      {manage && <div className="flex justify-end">{post}</div>}
      <AnnouncementFeed
        initial={feed.items}
        courseId={courseId}
        currentUserId={user.id}
        role={user.profile.role}
        emptyDescription={manage ? 'Post a notice to everyone in this course.' : 'Your teacher has not posted anything yet.'}
        emptyAction={manage ? post : undefined}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={feed.total} basePath={`/courses/${courseId}/announcements`} />
    </div>
  )
}
