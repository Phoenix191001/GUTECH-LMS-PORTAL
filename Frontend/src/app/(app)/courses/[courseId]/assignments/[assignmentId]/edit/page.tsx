import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/feedback'
import { canManage } from '@/features/courses/queries'
import { getAssignmentOrNotFound } from '@/features/assignments/queries'
import { AssignmentForm } from '@/features/assignments/components/assignment-form'

export const metadata: Metadata = { title: 'Edit assignment' }

export default async function EditAssignmentPage({ params }: { params: Promise<{ courseId: string; assignmentId: string }> }) {
  const { courseId, assignmentId } = await params
  const { user, course, assignment } = await getAssignmentOrNotFound(courseId, assignmentId)
  if (!canManage(user, course)) redirect(`/courses/${courseId}/assignments/${assignmentId}`)

  const { count } = await user.supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('assignment_id', assignmentId)
    .not('marks_obtained', 'is', null)

  return (
    <>
      <PageHeader title="Edit assignment" description={assignment.title} />
      <AssignmentForm courseId={courseId} assignment={assignment} hasGraded={(count ?? 0) > 0} />
    </>
  )
}
