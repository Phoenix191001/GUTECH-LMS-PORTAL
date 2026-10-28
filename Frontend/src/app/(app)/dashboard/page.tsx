import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BookOpen, CalendarClock, ClipboardCheck, Flag, GraduationCap, Megaphone, MessageSquare, Pin, Plus, Target, Timer, Users } from 'lucide-react'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { LocalTime, RelativeTime } from '@/components/shared/local-time'
import { requireUser, type AppUser } from '@/lib/auth'
import { loadFeed } from '@/features/announcements/queries'
import { quizState } from '@/features/quizzes/logic'
import { loadDirectory } from '@/features/shared/directory'
import { cn, num, percent } from '@/lib/utils'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await requireUser()
  const first = user.profile.full_name.split(' ')[0]

  const [feed, globals] = await Promise.all([
    loadFeed(user.supabase, user.id, { all: true }, { limit: 5 }).catch(() => ({ items: [], total: 0 })),
    loadFeed(user.supabase, user.id, { global: true }, { limit: 2 }).catch(() => ({ items: [], total: 0 })),
  ])

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-[oklch(0.33_0.14_22)] p-6 text-white shadow-[var(--shadow-lift)] sm:p-10">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(34rem 18rem at 100% 0%, oklch(0.65 0.2 25 / 0.45), transparent 65%), radial-gradient(24rem 14rem at 0% 100%, oklch(0.9 0.05 20 / 0.18), transparent 60%)' }} />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">{user.profile.role === 'admin' ? 'Administrator' : user.profile.role === 'teacher' ? 'Teacher' : 'Student'}</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-white text-balance sm:text-5xl">Welcome back, {first}</h1>
          <p className="mt-2 max-w-xl text-sm text-white/85 sm:text-base">
            {user.profile.role === 'student' ? "Here's what needs your attention." : user.profile.role === 'teacher' ? 'Here is what is waiting for you in your courses.' : 'A quick look at the whole institution.'}
          </p>
        </div>
      </section>

      {/* Global announcements banner */}
      {globals.items.length > 0 && (
        <section aria-label="Notices from the administration" className="space-y-3">
          {globals.items.map((a) => (
            <Link key={a.id} href="/announcements" className={cn('flex items-start gap-3.5 rounded-3xl border-2 p-4 transition hover:shadow-[var(--shadow-soft)]', a.isPinned ? 'border-primary/40 bg-primary-soft/60' : 'bg-card')}>
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent-pink text-primary-foreground">{a.isPinned ? <Pin className="size-4" /> : <Megaphone className="size-4" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{a.title}</span>
                <span className="line-clamp-1 text-sm text-muted-foreground">{a.body.replace(/[#*_`>\[\]]/g, '')}</span>
              </span>
              {!a.read && <Badge tone="primary">New</Badge>}
            </Link>
          ))}
        </section>
      )}

      {user.profile.role === 'student' && <StudentDashboard user={user} />}
      {user.profile.role === 'teacher' && <TeacherDashboard user={user} />}
      {user.profile.role === 'admin' && <AdminDashboard user={user} />}

      {/* Latest announcements */}
      <section aria-labelledby="latest-h">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="latest-h" className="font-display text-xl font-semibold">Latest announcements</h2>
          <Link href="/announcements" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">View all <ArrowRight className="size-3.5" /></Link>
        </div>
        {feed.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No announcements yet.</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-soft)]">
            {feed.items.map((a) => (
              <li key={a.id}>
                <Link href={a.courseId ? `/courses/${a.courseId}/announcements` : '/announcements'} className="flex items-start gap-3 px-4 py-3.5 transition hover:bg-muted/50">
                  <Badge tone={a.courseCode ? 'info' : 'warning'} className="mt-0.5 shrink-0">{a.courseCode ?? 'Everyone'}</Badge>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm', !a.read ? 'font-semibold' : 'font-medium')}>{a.title}</span>
                    <span className="text-xs text-muted-foreground">{a.authorName} · <RelativeTime iso={a.createdAt} /></span>
                  </span>
                  {!a.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ icon: Icon, label, value, href }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; href?: string }) {
  const body = (
    <>
      <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground"><Icon className="size-5" /></span>
      <span className="mt-3 block font-display text-3xl font-semibold leading-none">{value}</span>
      <span className="mt-1.5 block text-sm text-muted-foreground">{label}</span>
    </>
  )
  const cls = 'block rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] sm:p-5'
  return href ? <Link href={href} className={cn(cls, 'transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]')}>{body}</Link> : <div className={cls}>{body}</div>
}

function Panel({ title, href, hrefLabel = 'View all', children }: { title: string; href?: string; hrefLabel?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-lg">{title}</CardTitle>
        {href && <Link href={href} className="text-sm font-medium text-primary hover:underline">{hrefLabel}</Link>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>

/* --------------------------------- student --------------------------------- */

async function StudentDashboard({ user }: { user: AppUser }) {
  const { supabase } = user
  const nowIso = new Date().toISOString()
  await supabase.rpc('finalize_my_expired_attempts')

  const [courses, assignments, quizzes, marks, unread, chat] = await Promise.all([
    supabase.from('courses').select('id, code, title').eq('is_active', true),
    supabase.from('assignments').select('id, title, due_at, course_id, allow_late').eq('is_published', true).gt('due_at', nowIso).order('due_at').limit(25),
    supabase.from('quizzes').select('id, title, opens_at, closes_at, max_attempts, course_id').eq('is_published', true).gt('closes_at', nowIso).order('opens_at').limit(10),
    supabase.from('gradebook').select('*').order('recorded_at', { ascending: false }).limit(3),
    supabase.rpc('unread_announcement_count'),
    supabase.rpc('unread_chat_counts'),
  ])
  const code = new Map((courses.data ?? []).map((c) => [c.id, c.code]))

  const aIds = (assignments.data ?? []).map((a) => a.id)
  const qIds = (quizzes.data ?? []).map((q) => q.id)
  const [subs, attempts] = await Promise.all([
    aIds.length ? supabase.from('submissions').select('assignment_id').eq('student_id', user.id).in('assignment_id', aIds) : Promise.resolve({ data: [] }),
    qIds.length ? supabase.from('quiz_attempts').select('quiz_id, status, started_at').eq('student_id', user.id).in('quiz_id', qIds) : Promise.resolve({ data: [] }),
  ])
  const submitted = new Set((subs.data ?? []).map((s) => s.assignment_id))
  const todo = (assignments.data ?? []).filter((a) => !submitted.has(a.id))
  const quizList = (quizzes.data ?? []).map((q) => ({ q, st: quizState(q, (attempts.data ?? []).filter((a) => a.quiz_id === q.id)) })).filter((x) => x.st.state !== 'submitted' && x.st.state !== 'closed')
  const chatUnread = (chat.data ?? []).reduce((n, r) => n + Number(r.unread), 0)

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
        <Stat icon={BookOpen} label="Courses" value={courses.data?.length ?? 0} href="/courses" />
        <Stat icon={CalendarClock} label="Deadlines ahead" value={todo.length} />
        <Stat icon={Timer} label="Quizzes to take" value={quizList.filter((x) => x.st.canStart || x.st.state === 'upcoming').length} />
        <Stat icon={Megaphone} label="Unread" value={(unread.data ?? 0) + chatUnread} href="/announcements" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Upcoming deadlines">
          {todo.length === 0 ? <Empty>You are all caught up. 🎉</Empty> : (
            <ul className="divide-y">
              {todo.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <Link href={`/courses/${a.course_id}/assignments/${a.id}`} className="flex items-center gap-3 py-3 transition hover:text-primary">
                    <Badge tone="primary">{code.get(a.course_id) ?? ''}</Badge>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
                    <LocalTime iso={a.due_at} className="shrink-0 text-xs text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Quizzes">
          {quizList.length === 0 ? <Empty>No quizzes right now.</Empty> : (
            <ul className="divide-y">
              {quizList.slice(0, 5).map(({ q, st }) => (
                <li key={q.id}>
                  <Link href={`/courses/${q.course_id}/quizzes/${q.id}`} className="flex items-center gap-3 py-3 transition hover:text-primary">
                    <Badge tone="primary">{code.get(q.course_id) ?? ''}</Badge>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{q.title}</span>
                    <Badge tone={st.canStart ? 'success' : 'neutral'}>{st.state === 'in_progress' ? 'In progress' : st.state === 'open' ? 'Open' : 'Upcoming'}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="My marks">
        {(marks.data ?? []).length === 0 ? <Empty>Graded work will appear here.</Empty> : (
          <ul className="grid gap-3 sm:grid-cols-3">
            {(marks.data ?? []).map((m) => (
              <li key={`${m.item_type}-${m.item_id}`}>
                <Link href={m.course_id ? `/courses/${m.course_id}/marks` : '/courses'} className="block rounded-xl border bg-muted/30 p-4 transition hover:border-primary/40 hover:bg-primary-soft/40">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Target className="size-3.5" /> <span className="capitalize">{m.item_type}</span> · {m.course_id ? code.get(m.course_id) : ''}</p>
                  <p className="mt-1.5 truncate text-sm font-medium">{m.title}</p>
                  <p className="mt-2 font-display text-2xl font-semibold">{num(m.marks)} <span className="text-sm font-normal text-muted-foreground">/ {num(m.max_marks)} · {percent(Number(m.marks), Number(m.max_marks))}%</span></p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}

/* --------------------------------- teacher --------------------------------- */

async function TeacherDashboard({ user }: { user: AppUser }) {
  const { supabase } = user
  const [courses, overview, ungraded, toGrade, quizGrade] = await Promise.all([
    supabase.from('courses').select('id, code, title').eq('is_active', true).order('code'),
    supabase.rpc('course_overview'),
    supabase.from('submissions').select('id', { count: 'exact', head: true }).is('marks_obtained', null),
    supabase.from('submissions').select('id, student_id, submitted_at, assignment_id, assignments(title, course_id)').is('marks_obtained', null).order('submitted_at').limit(6),
    supabase.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
  ])
  const dir = await loadDirectory(supabase, (toGrade.data ?? []).map((s) => s.student_id))
  const students = (overview.data ?? []).reduce((n, o) => n + Number(o.student_count), 0)

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
        <Stat icon={BookOpen} label="My courses" value={courses.data?.length ?? 0} href="/courses" />
        <Stat icon={Users} label="Students" value={students} />
        <Stat icon={ClipboardCheck} label="Submissions to grade" value={ungraded.count ?? 0} />
        <Stat icon={Timer} label="Quiz answers to grade" value={quizGrade.count ?? 0} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Waiting for your grade">
          {(toGrade.data ?? []).length === 0 ? <Empty>Nothing is waiting. Nice work.</Empty> : (
            <ul className="divide-y">
              {(toGrade.data ?? []).map((s) => (
                <li key={s.id}>
                  <Link href={`/courses/${s.assignments?.course_id}/assignments/${s.assignment_id}/grade/${s.student_id}`} className="flex items-center gap-3 py-3 transition hover:text-primary">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{dir.get(s.student_id)?.full_name ?? 'Student'}</span>
                      <span className="block truncate text-xs text-muted-foreground">{s.assignments?.title}</span>
                    </span>
                    <LocalTime iso={s.submitted_at} className="shrink-0 text-xs text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Your courses" href="/courses">
          {(courses.data ?? []).length === 0 ? <Empty>No courses assigned yet.</Empty> : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {(courses.data ?? []).map((c) => (
                <li key={c.id}>
                  <Link href={`/courses/${c.id}/resources`} className="flex h-full items-center gap-3 rounded-xl border bg-muted/30 p-3.5 transition hover:border-primary/40 hover:bg-primary-soft/40">
                    <Badge tone="primary">{c.code}</Badge>
                    <span className="truncate text-sm font-medium">{c.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}

/* ---------------------------------- admin ---------------------------------- */

async function AdminDashboard({ user }: { user: AppUser }) {
  const { supabase } = user
  const [users, students, courses, openComplaints, recent] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('role', 'student'),
    supabase.from('courses').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('complaints').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('complaints').select('id, subject, category, created_at').in('status', ['open', 'in_review']).order('created_at').limit(5),
  ])

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Summary">
        <Stat icon={Users} label="Active users" value={users.count ?? 0} href="/admin/users" />
        <Stat icon={GraduationCap} label="Students" value={students.count ?? 0} href="/admin/users?role=student" />
        <Stat icon={BookOpen} label="Active courses" value={courses.count ?? 0} href="/admin/courses" />
        <Stat icon={Flag} label="Open complaints" value={openComplaints.count ?? 0} href="/admin/complaints?status=open" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Quick actions">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['/admin/users', Users, 'Add a user'],
              ['/admin/courses', Plus, 'Create a course'],
              ['/admin/announcements', Megaphone, 'Post an announcement'],
              ['/admin/complaints', MessageSquare, 'Review complaints'],
            ].map(([href, Icon, label]) => {
              const I = Icon as typeof Users
              return (
                <Link key={href as string} href={href as string} className={buttonVariants({ variant: 'outline', className: 'h-auto justify-start gap-3 py-3.5' })}>
                  <I className="text-primary" /> {label as string}
                </Link>
              )
            })}
          </div>
        </Panel>

        <Panel title="Complaints needing attention" href="/admin/complaints">
          {(recent.data ?? []).length === 0 ? <Empty>No open complaints.</Empty> : (
            <ul className="divide-y">
              {(recent.data ?? []).map((c) => (
                <li key={c.id}>
                  <Link href="/admin/complaints" className="flex items-center gap-3 py-3 transition hover:text-primary">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.subject}</span>
                    <Badge className="capitalize">{c.category}</Badge>
                    <RelativeTime iso={c.created_at} className="shrink-0 text-xs text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}
