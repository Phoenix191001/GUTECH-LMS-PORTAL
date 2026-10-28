import type { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState, PageHeader } from '@/components/ui/feedback'
import { Pagination, parsePage } from '@/components/shared/pagination'
import { requireUser } from '@/lib/auth'
import { loadFeed } from '@/features/announcements/queries'
import { AnnouncementDialog } from '@/features/announcements/components/announcement-dialog'
import { AnnouncementFeed } from '@/features/announcements/components/announcement-feed'
import { PAGE_SIZE } from '@/lib/utils'

export const metadata: Metadata = { title: 'Global announcements' }

export default async function AdminAnnouncementsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page)
  const user = await requireUser('admin')

  let feed
  try {
    feed = await loadFeed(user.supabase, user.id, { global: true }, { page, pageSize: PAGE_SIZE })
  } catch {
    return <ErrorState description="We could not load the announcements. Please refresh the page." />
  }
  const post = <AnnouncementDialog courseId={null} trigger={<Button><Plus /> New global announcement</Button>} />

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Global announcements"
        description="Shown in a banner on every user's dashboard."
        actions={post}
      />
      <AnnouncementFeed
        initial={feed.items}
        globalOnly
        currentUserId={user.id}
        role="admin"
        emptyTitle="No global announcements"
        emptyDescription="Post a notice that every student and teacher will see."
        emptyAction={post}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={feed.total} basePath="/admin/announcements" />
    </>
  )
}
