'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { slug: 'resources', label: 'Resources' },
  { slug: 'assignments', label: 'Assignments' },
  { slug: 'quizzes', label: 'Quizzes' },
  { slug: 'announcements', label: 'Announcements' },
  { slug: 'chat', label: 'Chat' },
  { slug: 'marks', label: 'Marks' },
  { slug: 'people', label: 'People' },
] as const

/** Horizontally scrollable tab bar: course sections as routes. */
export function CourseTabs({ courseId, chatUnread }: { courseId: string; chatUnread: number }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Course sections" className="-mx-4 mb-6 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 rounded-2xl border bg-card p-1.5 shadow-[var(--shadow-soft)]">
        {TABS.map((tab) => {
          const href = `/courses/${courseId}/${tab.slug}`
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={tab.slug}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-primary text-primary-foreground shadow-[var(--shadow-glow)]' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {tab.label}
                {tab.slug === 'chat' && chatUnread > 0 && !active && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-semibold text-primary-foreground">
                    {chatUnread > 99 ? '99+' : chatUnread}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
