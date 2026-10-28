import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/feedback'
import { canManage, getCourseOrNotFound } from '@/features/courses/queries'
import { AssignmentForm } from '@/features/assignments/components/assignment-form'

export const metadata: Metadata = { title: 'New assignment' }

export default async function NewAssignmentPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params
  const { user, course } = await getCourseOrNotFound(courseId)
  if (!canManage(user, course)) redirect(`/courses/${courseId}/assignments`)
  return (
    <>
      <PageHeader title="New assignment" description="Drafts are hidden from students until you publish." />
      <AssignmentForm courseId={courseId} />
    </>
  )
}
