import type { Metadata } from 'next'
import Link from 'next/link'
import { FolderOpen, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { EmptyState, ErrorState } from '@/components/ui/feedback'
import { Pagination, parsePage } from '@/components/shared/pagination'
import { SearchInput } from '@/components/shared/search-input'
import { FileKindIcon } from '@/components/shared/file-icon'
import { LocalTime } from '@/components/shared/local-time'
import { canManage, getCourseOrNotFound } from '@/features/courses/queries'
import { loadDirectory } from '@/features/shared/directory'
import { OpenResourceButton, ResourceMenu } from '@/features/resources/components/resource-buttons'
import { ResourceDialog } from '@/features/resources/components/resource-dialog'
import { SeenByDialog } from '@/features/resources/components/seen-by-dialog'
import { cn, escapeLike, formatBytes, PAGE_SIZE } from '@/lib/utils'

export const metadata: Metadata = { title: 'Resources' }

type SearchParams = Promise<{ q?: string; type?: string; page?: string }>

export default async function ResourcesPage({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: SearchParams }) {
  const { courseId } = await params
  const sp = await searchParams
  const { user, course } = await getCourseOrNotFound(courseId)
  const { supabase } = user
  const manage = canManage(user, course)
  const isStudent = user.profile.role === 'student'

  const page = parsePage(sp.page)
  const q = sp.q?.trim() ?? ''
  const type = sp.type === 'file' || sp.type === 'link' ? sp.type : undefined

  let query = supabase
    .from('resources')
    .select('*, resource_views(count)', { count: 'exact' })
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
  if (q) query = query.ilike('title', `%${escapeLike(q)}%`)
  if (type) query = query.eq('kind', type)

  const { data: resources, count, error } = await query
  if (error) return <ErrorState description="We could not load the resources. Please refresh the page." />

  const ids = (resources ?? []).map((r) => r.id)
  const [dir, mine, enrolled] = await Promise.all([
    loadDirectory(supabase, (resources ?? []).map((r) => r.uploaded_by)),
    isStudent && ids.length
      ? supabase.from('resource_views').select('resource_id').eq('student_id', user.id).in('resource_id', ids)
      : Promise.resolve({ data: [] as { resource_id: string }[] }),
    manage ? supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('course_id', courseId) : Promise.resolve({ count: 0 }),
  ])
  const seenByMe = new Set((mine.data ?? []).map((v) => v.resource_id))
  const studentCount = enrolled.count ?? 0

  const filterHref = (t?: string) => {
    const s = new URLSearchParams()
    if (q) s.set('q', q)
    if (t) s.set('type', t)
    const qs = s.toString()
    return `/courses/${courseId}/resources${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput placeholder="Search resources" className="sm:max-w-xs sm:flex-1" />
        <div className="flex items-center gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Filter by type">
          {[
            [undefined, 'All'],
            ['file', 'Files'],
            ['link', 'Links'],
          ].map(([value, label]) => (
            <Link
              key={label}
              href={filterHref(value)}
              aria-current={type === value ? 'true' : undefined}
              className={cn('rounded-lg px-3.5 py-1.5 text-sm font-medium transition', type === value ? 'bg-card shadow-[var(--shadow-soft)]' : 'text-muted-foreground hover:text-foreground')}
            >
              {label}
            </Link>
          ))}
        </div>
        {manage && (
          <ResourceDialog
            courseId={courseId}
            trigger={
              <Button className="sm:ml-auto">
                <Plus /> Upload resource
              </Button>
            }
          />
        )}
      </div>

      {(resources ?? []).length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={q || type ? 'No matching resources' : 'No resources yet'}
          description={
            q || type
              ? 'Try a different search or clear the filter.'
              : manage
                ? 'Upload slides, readings or links for your students.'
                : 'Your teacher has not shared anything yet.'
          }
          action={
            q || type ? (
              <Link href={`/courses/${courseId}/resources`} className={buttonVariants({ variant: 'outline' })}>
                Clear filters
              </Link>
            ) : manage ? (
              <ResourceDialog
                courseId={courseId}
                trigger={
                  <Button>
                    <Plus /> Upload resource
                  </Button>
                }
              />
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {(resources ?? []).map((r, i) => {
            const isNew = isStudent && !seenByMe.has(r.id)
            const seen = r.resource_views[0]?.count ?? 0
            return (
              <li
                key={r.id}
                className={cn(
                  'animate-rise rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-lift)] sm:p-5',
                  isNew && 'border-primary/40',
                )}
                style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
              >
                <div className="flex items-start gap-3.5">
                  <FileKindIcon mime={r.mime_type} name={r.file_name} link={r.kind === 'link'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium leading-snug">{r.title}</h2>
                      {isNew && <Badge tone="primary">New</Badge>}
                      {r.kind === 'link' && <Badge tone="info">Link</Badge>}
                    </div>
                    {r.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.description}</p>}
                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{dir.get(r.uploaded_by)?.full_name ?? 'Unknown'}</span>
                      <span aria-hidden>·</span>
                      <LocalTime iso={r.created_at} mode="date" />
                      {r.file_size ? (
                        <>
                          <span aria-hidden>·</span>
                          <span>{formatBytes(r.file_size)}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  {manage && (
                    <ResourceMenu
                      courseId={courseId}
                      resource={{ id: r.id, title: r.title, description: r.description, kind: r.kind, external_url: r.external_url }}
                    />
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  {manage ? (
                    <div className="flex items-center gap-2">
                      <SeenByDialog resourceId={r.id} seenCount={seen} title={r.title} />
                      <span className="text-xs text-muted-foreground">
                        {seen} of {studentCount} students
                      </span>
                    </div>
                  ) : (
                    <span />
                  )}
                  <OpenResourceButton id={r.id} kind={r.kind} />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath={`/courses/${courseId}/resources`} params={{ q: q || undefined, type }} />
    </div>
  )
}
