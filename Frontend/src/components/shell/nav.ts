import {
  BookOpen,
  Flag,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  ShieldAlert,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from '@/types/database'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Badge key resolved against shell counts. */
  badge?: 'announcements' | 'complaints'
}

export type NavGroup = { label?: string; items: NavItem[] }

/** Sidebar links depend on role (spec Section 17). */
export function navFor(role: UserRole): NavGroup[] {
  const common: NavItem[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/courses', label: 'Courses', icon: BookOpen },
    { href: '/announcements', label: 'Announcements', icon: Megaphone, badge: 'announcements' },
    { href: '/complaints', label: 'Complaints', icon: Flag, badge: 'complaints' },
  ]
  if (role !== 'admin') return [{ items: common }]
  return [
    { items: common },
    {
      label: 'Administration',
      items: [
        { href: '/admin/users', label: 'Users', icon: Users },
        { href: '/admin/courses', label: 'Manage courses', icon: GraduationCap },
        { href: '/admin/announcements', label: 'Post announcements', icon: Megaphone },
        { href: '/admin/complaints', label: 'Review complaints', icon: ShieldAlert },
      ],
    },
  ]
}

/** Items pinned to the phone bottom bar; everything else lives under "More". */
export function bottomNavFor(role: UserRole): NavItem[] {
  const all = navFor(role).flatMap((g) => g.items)
  const pick = (href: string) => all.find((i) => i.href === href)
  const items =
    role === 'admin'
      ? ['/dashboard', '/courses', '/admin/users', '/admin/complaints']
      : ['/dashboard', '/courses', '/announcements', '/complaints']
  return items.map(pick).filter((i): i is NavItem => !!i)
}

export function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}
