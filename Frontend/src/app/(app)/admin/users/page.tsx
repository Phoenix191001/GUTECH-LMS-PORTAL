import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { Badge, type Tone } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, PageHeader } from '@/components/ui/feedback'
import { Pagination, parsePage } from '@/components/shared/pagination'
import { ResponsiveTable, type Column } from '@/components/shared/responsive-table'
import { SearchInput } from '@/components/shared/search-input'
import { Avatar } from '@/components/shared/avatar'
import { BulkImportDialog } from '@/features/users/components/bulk-import-dialog'
import { UserDialog } from '@/features/users/components/user-dialog'
import { UserRowActions } from '@/features/users/components/user-row-actions'
import { cn, PAGE_SIZE } from '@/lib/utils'
import type { Row, UserRole } from '@/types/database'

export const metadata: Metadata = { title: 'Users' }

const ROLE_TONE: Record<UserRole, Tone> = { admin: 'primary', teacher: 'info', student: 'neutral' }

type SearchParams = Promise<{ q?: string; role?: string; status?: string; page?: string }>

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireUser('admin')
  const sp = await searchParams
  const page = parsePage(sp.page)
  const q = (sp.q ?? '').replace(/[,()*\\%_]/g, ' ').trim()
  const role = sp.role === 'admin' || sp.role === 'teacher' || sp.role === 'student' ? sp.role : undefined
  const status = sp.status === 'active' || sp.status === 'inactive' ? sp.status : undefined

  let query = me.supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('full_name')
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,roll_no.ilike.%${q}%`)
  if (role) query = query.eq('role', role)
  if (status) query = query.eq('is_active', status === 'active')

  const { data: users, count, error } = await query

  const filterHref = (patch: Record<string, string | undefined>) => {
    const s = new URLSearchParams()
    const merged = { q: q || undefined, role, status, ...patch }
    for (const [k, v] of Object.entries(merged)) if (v) s.set(k, v)
    const qs = s.toString()
    return `/admin/users${qs ? `?${qs}` : ''}`
  }

  const columns: Column<Row<'profiles'>>[] = [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.full_name} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium">{u.full_name}</p>
            <p className="truncate text-xs text-muted-foreground md:hidden">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'email', header: 'Email', hideOnMobile: true, cell: (u) => <span className="text-muted-foreground">{u.email}</span> },
    { key: 'role', header: 'Role', cell: (u) => <Badge tone={ROLE_TONE[u.role]} className="capitalize">{u.role}</Badge> },
    { key: 'roll', header: 'Roll no.', cell: (u) => u.roll_no ?? <span className="text-muted-foreground">–</span> },
    {
      key: 'status',
      header: 'Status',
      cell: (u) => (
        <span className="inline-flex flex-wrap justify-end gap-1.5">
          <Badge tone={u.is_active ? 'success' : 'danger'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
          {u.must_change_password && <Badge tone="warning">Temp password</Badge>}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      actions: true,
      className: 'text-right',
      cell: (u) => (
        <UserRowActions
          isSelf={u.id === me.id}
          user={{ id: u.id, full_name: u.full_name, email: u.email, role: u.role, roll_no: u.roll_no, is_active: u.is_active }}
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        description="Accounts are created here only. There is no public sign-up."
        actions={
          <>
            <BulkImportDialog />
            <UserDialog
              trigger={
                <Button>
                  <Plus /> Add user
                </Button>
              }
            />
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput placeholder="Search name, email or roll number" className="lg:max-w-sm lg:flex-1" />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filters">
          {[
            [undefined, 'All roles'],
            ['student', 'Students'],
            ['teacher', 'Teachers'],
            ['admin', 'Admins'],
          ].map(([value, label]) => (
            <Link
              key={label}
              href={filterHref({ role: value, page: undefined })}
              aria-current={role === value ? 'true' : undefined}
              className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition', role === value ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
            >
              {label}
            </Link>
          ))}
          <Link
            href={filterHref({ status: status === 'inactive' ? undefined : 'inactive', page: undefined })}
            aria-current={status === 'inactive' ? 'true' : undefined}
            className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition', status === 'inactive' ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'bg-card text-muted-foreground hover:text-foreground')}
          >
            Inactive only
          </Link>
        </div>
      </div>

      {error ? (
        <ErrorState description="We could not load the users. Please refresh the page." />
      ) : (users ?? []).length === 0 ? (
        <EmptyState icon={Users} title="No users found" description="Try a different search, or add the first user." />
      ) : (
        <ResponsiveTable columns={columns} rows={users ?? []} rowKey={(u) => u.id} caption="Users" />
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/admin/users" params={{ q: q || undefined, role, status }} />
    </>
  )
}
