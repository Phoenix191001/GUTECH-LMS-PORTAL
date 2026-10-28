import type { Metadata } from 'next'
import { ErrorState, PageHeader } from '@/components/ui/feedback'
import { Pagination, parsePage } from '@/components/shared/pagination'
import { requireUser } from '@/lib/auth'
import { MyComplaints, NewComplaintDialog, type ComplaintView } from '@/features/complaints/components/complaint-ui'
import { PAGE_SIZE } from '@/lib/utils'

export const metadata: Metadata = { title: 'Complaints' }
export const dynamic = 'force-dynamic'

export default async function ComplaintsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = parsePage((await searchParams).page)
  const { supabase, id } = await requireUser()

  const [list, courses] = await Promise.all([
    supabase
      .from('complaints')
      .select('*, courses(code)', { count: 'exact' })
      .eq('submitted_by', id)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('courses').select('id, code, title').eq('is_active', true).order('code').limit(200),
  ])
  if (list.error) return <ErrorState description="We could not load your complaints. Please refresh the page." />

  const complaints: ComplaintView[] = (list.data ?? []).map((c) => ({
    id: c.id,
    subject: c.subject,
    description: c.description,
    category: c.category,
    status: c.status,
    adminResponse: c.admin_response,
    createdAt: c.created_at,
    resolvedAt: c.resolved_at,
    courseCode: c.courses?.code ?? null,
  }))

  return (
    <>
      <PageHeader
        eyebrow="Support"
        title="Complaints"
        description="Tell the administration about a problem and follow what happens next. Only you and the administrators can see your complaints."
        actions={<NewComplaintDialog courses={courses.data ?? []} />}
      />
      <MyComplaints complaints={complaints} courses={courses.data ?? []} />
      <Pagination page={page} pageSize={PAGE_SIZE} total={list.count ?? 0} basePath="/complaints" />
    </>
  )
}
