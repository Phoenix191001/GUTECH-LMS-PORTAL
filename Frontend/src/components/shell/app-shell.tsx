'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { Bell, BookOpen, ChevronsUpDown, LogOut, Menu, Monitor, Moon, Sun, UserRound } from 'lucide-react'
import { signOut } from '@/features/auth/actions'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/shared/logo'
import { Avatar } from '@/components/shared/avatar'
import { Badge } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { bottomNavFor, isActive, navFor, type NavItem } from './nav'
import type { UserRole } from '@/types/database'

export type ShellUser = { name: string; email: string; role: UserRole; avatarUrl: string | null }
export type ShellCourse = { id: string; code: string; title: string }
export type ShellCounts = { announcements: number; complaints: boolean; chat: number }

const ROLE_LABEL: Record<UserRole, string> = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' }

function badgeFor(item: NavItem, counts: ShellCounts): { text: string; dot: boolean } | null {
  if (item.badge === 'announcements' && counts.announcements > 0) return { text: counts.announcements > 99 ? '99+' : String(counts.announcements), dot: false }
  if (item.badge === 'complaints' && counts.complaints) return { text: '', dot: true }
  return null
}

function SidebarLinks({ role, counts, onNavigate }: { role: UserRole; counts: ShellCounts; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
      {navFor(role).map((group, gi) => (
        <div key={gi}>
          {group.label && (
            <p className="mb-2 px-4 text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-sidebar-muted">{group.label}</p>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href)
              const badge = badgeFor(item, counts)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition-all',
                      active
                        ? 'bg-white text-primary shadow-[var(--shadow-soft)]'
                        : 'text-sidebar-foreground/85 hover:bg-white/15 hover:text-white',
                    )}
                  >
                    
                    <item.icon className={cn('size-[1.125rem]', active ? 'text-primary' : 'text-sidebar-muted group-hover:text-white')} />
                    <span className="flex-1">{item.label}</span>
                    {badge &&
                      (badge.dot ? (
                        <span className="size-2.5 rounded-full bg-white" aria-label="New updates" />
                      ) : (
                        <span className="grid min-w-5 place-items-center rounded-full bg-white px-1.5 text-[0.6875rem] font-bold text-primary">
                          {badge.text}
                        </span>
                      ))}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function ThemeItems() {
  const { theme, setTheme } = useTheme()
  const items = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ]
  return (
    <>
      <DropdownMenuLabel>Theme</DropdownMenuLabel>
      {items.map(({ value, label, icon: Icon }) => (
        <DropdownMenuItem key={value} onSelect={(e) => { e.preventDefault(); setTheme(value) }}>
          <Icon /> {label}
          {theme === value && <span className="ml-auto text-xs text-primary">●</span>}
        </DropdownMenuItem>
      ))}
    </>
  )
}

function UserMenu({ user }: { user: ShellUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-full p-0.5 outline-none transition hover:ring-4 hover:ring-primary/15 focus-visible:ring-4 focus-visible:ring-ring/30"
        aria-label="Open user menu"
      >
        <Avatar name={user.name} src={user.avatarUrl} size="md" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-2.5">
          <Avatar name={user.name} src={user.avatarUrl} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <Badge tone="primary" className="mt-1">{ROLE_LABEL[user.role]}</Badge>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile"><UserRound /> Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ThemeItems />
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={() => { void signOut() }}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function CourseSwitcher({ courses }: { courses: ShellCourse[] }) {
  const pathname = usePathname()
  const current = courses.find((c) => pathname.startsWith(`/courses/${c.id}`))
  const tab = current ? (pathname.split('/')[3] ?? 'resources') : 'resources'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex max-w-[11rem] items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-sm font-semibold text-primary-soft-foreground outline-none transition hover:bg-primary hover:text-primary-foreground focus-visible:ring-4 focus-visible:ring-ring/25 sm:max-w-[16rem]">
        <BookOpen className="size-4 shrink-0" />
        <span className="truncate">{current ? current.code : 'Switch course'}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-72 overflow-y-auto">
        <DropdownMenuLabel>Your courses</DropdownMenuLabel>
        {courses.length === 0 && <p className="px-2.5 pb-2 text-sm text-muted-foreground">No courses yet.</p>}
        {courses.map((c) => (
          <DropdownMenuItem key={c.id} asChild>
            <Link href={`/courses/${c.id}/${tab}`} className={cn(current?.id === c.id && 'bg-primary-soft text-primary-soft-foreground')}>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">{c.code}</span>
              <span className="truncate">{c.title}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/courses">View all courses</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Notifications({ counts }: { counts: ShellCounts }) {
  const total = counts.announcements + counts.chat + (counts.complaints ? 1 : 0)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={total > 0 ? `Notifications (${total} new)` : 'Notifications'}
        className="relative grid size-10 place-items-center rounded-full text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/25"
      >
        <Bell className="size-5" />
        {total > 0 && <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-accent-pink ring-2 ring-background" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        {total === 0 && <p className="px-2.5 pb-3 text-sm text-muted-foreground">You&apos;re all caught up.</p>}
        {counts.announcements > 0 && (
          <DropdownMenuItem asChild>
            <Link href="/announcements">{counts.announcements} unread announcement{counts.announcements === 1 ? '' : 's'}</Link>
          </DropdownMenuItem>
        )}
        {counts.chat > 0 && (
          <DropdownMenuItem asChild>
            <Link href="/courses">{counts.chat} unread chat message{counts.chat === 1 ? '' : 's'}</Link>
          </DropdownMenuItem>
        )}
        {counts.complaints && (
          <DropdownMenuItem asChild>
            <Link href="/complaints">Update on one of your complaints</Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function AppShell({
  user,
  courses,
  counts,
  children,
}: {
  user: ShellUser
  courses: ShellCourse[]
  counts: ShellCounts
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const bottom = bottomNavFor(user.role)

  return (
    <div className="min-h-dvh lg:pl-[19rem]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-3 left-3 z-30 hidden w-72 flex-col overflow-hidden rounded-[2rem] bg-gradient-to-b from-sidebar via-sidebar to-[oklch(0.3_0.13_22)] text-sidebar-foreground shadow-[var(--shadow-lift)] lg:flex">
        <div className="flex justify-center px-4 pb-4 pt-6">
          <Logo tone="light" className="w-full" />
        </div>
        <SidebarLinks role={user.role} counts={counts} />
        <Link
          href="/profile"
          className="m-3 flex items-center gap-3 rounded-full bg-white/15 p-2.5 pr-4 transition hover:bg-white/25"
        >
          <Avatar name={user.name} src={user.avatarUrl} size="md" className="ring-sidebar-accent" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-white">{user.name}</span>
            <span className="block truncate text-xs text-sidebar-muted">{ROLE_LABEL[user.role]}</span>
          </span>
        </Link>
      </aside>

      {/* Topbar */}
      <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6">
        <div className="glass mx-auto flex h-16 max-w-6xl items-center gap-2 rounded-full border-2 border-border/70 px-4 shadow-[var(--shadow-soft)] sm:px-5">
          <Link href="/dashboard" className="mr-1 lg:hidden" aria-label="Dashboard">
            <Logo className="w-28" />
          </Link>
          <CourseSwitcher courses={courses} />
          <div className="ml-auto flex items-center gap-1">
            <Notifications counts={counts} />
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-9 lg:pb-12 lg:pt-8">
        {children}
      </main>

      {/* Phone bottom navigation */}
      <nav aria-label="Primary" className="glass pb-safe fixed inset-x-3 bottom-3 z-30 rounded-full border-2 border-border/70 shadow-[var(--shadow-lift)] lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {bottom.map((item) => {
            const active = isActive(pathname, item.href)
            const badge = badgeFor(item, counts)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn('relative flex min-h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium', active ? 'text-primary' : 'text-muted-foreground')}
                >
                  <span className="relative">
                    <item.icon className="size-5" />
                    {badge && <span className="absolute -right-1.5 -top-1 size-2 rounded-full bg-primary ring-2 ring-background" />}
                  </span>
                  {item.label === 'Announcements' ? 'News' : item.label === 'Review complaints' ? 'Complaints' : item.label}
                  {active && <span aria-hidden className="absolute top-1.5 size-1.5 rounded-full bg-accent-pink" />}
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex min-h-14 w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium text-muted-foreground"
              aria-haspopup="dialog"
            >
              <Menu className="size-5" />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent variant="drawer-left" className="border-sidebar-border bg-sidebar text-sidebar-foreground [&_button[aria-label=Close]]:text-sidebar-muted">
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogDescription className="sr-only">All sections of the app</DialogDescription>
          <div className="flex justify-center px-4 pb-3 pt-6">
            <Logo tone="light" className="w-full" />
          </div>
          <SidebarLinks role={user.role} counts={counts} onNavigate={() => setMoreOpen(false)} />
          <div className="space-y-1 border-t border-sidebar-border p-3 pb-safe">
            <Link
              href="/profile"
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold text-sidebar-foreground/90 hover:bg-white/15"
            >
              <UserRound className="size-[1.125rem] text-sidebar-muted" /> Profile
            </Link>
            <form action={signOut}>
              <button type="submit" className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15">
                <LogOut className="size-[1.125rem]" /> Sign out
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
