import type { Metadata } from 'next'
import { ErrorState } from '@/components/ui/feedback'
import { canManage, getCourseOrNotFound } from '@/features/courses/queries'
import { loadChatPage } from '@/features/chat/queries'
import { ChatRoom } from '@/features/chat/components/chat-room'

export const metadata: Metadata = { title: 'Chat' }
export const dynamic = 'force-dynamic'

export default async function ChatPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const { user, course } = await getCourseOrNotFound(courseId)

  let page
  try {
    page = await loadChatPage(user.supabase, courseId)
  } catch {
    return <ErrorState description="We could not load the chat. Please refresh the page." />
  }

  const role = user.profile.role
  return (
    <ChatRoom
      courseId={courseId}
      me={{ id: user.id, name: user.profile.full_name, role }}
      canPost={role !== 'admin'}
      canModerate={canManage(user, course)}
      initialMessages={page.messages}
      initialPeople={page.people}
      initialHasMore={page.hasMore}
    />
  )
}
