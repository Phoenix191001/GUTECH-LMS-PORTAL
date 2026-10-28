import type { Metadata } from 'next'
import { CalendarDays, Hash, Mail, ShieldCheck } from 'lucide-react'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/feedback'
import { LocalTime } from '@/components/shared/local-time'
import { requireUser } from '@/lib/auth'
import { signedUrl } from '@/lib/storage'
import { AvatarEditor, ChangePasswordForm, NameForm, SignOutOthersButton, ThemeCard } from '@/features/profile/components/profile-forms'

export const metadata: Metadata = { title: 'Profile' }
export const dynamic = 'force-dynamic'

const ROLE_LABEL = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' } as const

export default async function ProfilePage() {
  const { profile, supabase, email } = await requireUser()
  const [avatarUrl, courses] = await Promise.all([
    signedUrl(supabase, 'avatars', profile.avatar_url),
    supabase.from('courses').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ])

  return (
    <>
      <PageHeader eyebrow="Account" title="Your profile" description="Update how you appear to your classmates and teachers, and keep your account secure." />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div aria-hidden className="h-24 bg-gradient-to-r from-primary to-accent-pink" />
            <CardContent className="-mt-12 space-y-6 pt-0">
              <AvatarEditor name={profile.full_name} avatarUrl={avatarUrl} hasAvatar={!!profile.avatar_url} />
              <NameForm fullName={profile.full_name} />
              <dl className="grid gap-4 border-t pt-5 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 size-4 text-muted-foreground" />
                  <div className="min-w-0"><dt className="text-xs text-muted-foreground">Email</dt><dd className="truncate text-sm font-medium">{email}</dd></div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-4 text-muted-foreground" />
                  <div><dt className="text-xs text-muted-foreground">Role</dt><dd className="text-sm font-medium"><Badge tone="primary">{ROLE_LABEL[profile.role]}</Badge></dd></div>
                </div>
                {profile.roll_no && (
                  <div className="flex items-start gap-3">
                    <Hash className="mt-0.5 size-4 text-muted-foreground" />
                    <div><dt className="text-xs text-muted-foreground">Roll number</dt><dd className="text-sm font-medium">{profile.roll_no}</dd></div>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <CalendarDays className="mt-0.5 size-4 text-muted-foreground" />
                  <div><dt className="text-xs text-muted-foreground">Member since</dt><dd className="text-sm font-medium"><LocalTime iso={profile.created_at} mode="date" /></dd></div>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                Your email, role and roll number are managed by your administrator.
                {profile.role !== 'admin' && ` You are in ${courses.count ?? 0} active course${courses.count === 1 ? '' : 's'}.`}
              </p>
            </CardContent>
          </Card>

          <ThemeCard />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
              <CardDescription>You will need your current password. Other devices are signed out afterwards.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm email={email} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Sessions</CardTitle>
              <CardDescription>Signed in somewhere you no longer use? End those sessions.</CardDescription>
            </CardHeader>
            <CardContent>
              <SignOutOthersButton />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
