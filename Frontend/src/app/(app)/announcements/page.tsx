import type { Metadata } from 'next'
import { ErrorState, PageHeader } from '@/components/ui/feedback'
import { Pagination, parsePage } from '@/components/shared/pagination'
import { requireUser } from '@/lib/auth'
import { loadFeed } from '@/features/announcements/queries'
import { AnnouncementFeed } from '@/features/announcements/components/announcement-feed'
import { PAGE_SIZE } from '@/lib/utils'

export const metadata: Metadata = { title: 'Announcements' }

/** Everything the user may see: global notices plus every course they belong to. */
export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page)
  const user = await requireUser()

  let feed
  try {
    feed = await loadFeed(user.supabase, user.id, { all: true }, { page, pageSize: PAGE_SIZE })
  } catch {
    return <ErrorState description="We could not load the announcements. Please refresh the page." />
  }

  return (
    <>
      <PageHeader eyebrow="Updates" title="Announcements" description="Notices from your teachers and the administration. Unread ones are highlighted until you have seen them." />
      <AnnouncementFeed initial={feed.items} currentUserId={user.id} role={user.profile.role} />
      <Pagination page={page} pageSize={PAGE_SIZE} total={feed.total} basePath="/announcements" />
    </>
  )
}
