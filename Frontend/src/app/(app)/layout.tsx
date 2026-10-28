import { AppShell } from '@/components/shell/app-shell'
import { requireUser } from '@/lib/auth'
import { signedUrl } from '@/lib/storage'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile } = await requireUser()

  const [courses, announcements, chat, complaintDot, avatarUrl] = await Promise.all([
    supabase.from('courses').select('id, code, title').eq('is_active', true).order('code').limit(100),
    supabase.rpc('unread_announcement_count'),
    supabase.rpc('unread_chat_counts'),
    supabase.rpc('has_complaint_update'),
    signedUrl(supabase, 'avatars', profile.avatar_url),
  ])

  return (
    <AppShell
      user={{ name: profile.full_name, email: profile.email, role: profile.role, avatarUrl }}
      courses={courses.data ?? []}
      counts={{
        announcements: announcements.data ?? 0,
        complaints: complaintDot.data ?? false,
        chat: (chat.data ?? []).reduce((sum, row) => sum + Number(row.unread), 0),
      }}
    >
      {children}
    </AppShell>
  )
}
