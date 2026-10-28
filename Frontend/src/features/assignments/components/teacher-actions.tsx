'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Download, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { useAction } from '@/hooks/use-action'
import { deleteAssignment, setAssignmentPublished } from '../actions'

export function AssignmentTeacherActions({
  courseId,
  assignmentId,
  title,
  published,
  submissionCount,
}: {
  courseId: string
  assignmentId: string
  title: string
  published: boolean
  submissionCount: number
}) {
  const router = useRouter()
  const { pending, run } = useAction()
  const base = `/courses/${courseId}/assignments/${assignmentId}`

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`${base}/edit`} className={buttonVariants({ variant: 'outline' })}>
        <Pencil /> Edit
      </Link>
      <Button
        variant="outline"
        loading={pending}
        onClick={() =>
          run(() => setAssignmentPublished(assignmentId, !published), {
            success: published ? 'Unpublished. Students can no longer see it.' : 'Published',
            onSuccess: () => router.refresh(),
          })
        }
      >
        {published ? <EyeOff /> : <Eye />} {published ? 'Unpublish' : 'Publish'}
      </Button>
      <a href={`${base}/export`} className={buttonVariants({ variant: 'outline' })} download>
        <Download /> Export CSV
      </a>
      <ConfirmDialog
        trigger={
          <Button variant="outline" className="text-danger hover:bg-danger-soft">
            <Trash2 /> Delete
          </Button>
        }
        title="Delete this assignment?"
        description={
          submissionCount > 0
            ? `This permanently removes the assignment, its ${submissionCount} submission${submissionCount === 1 ? '' : 's'}, marks and all uploaded files.`
            : 'This permanently removes the assignment and its attachment.'
        }
        requireText={submissionCount > 0 ? title : undefined}
        confirmLabel="Delete assignment"
        onConfirm={async () => {
          const res = await deleteAssignment({ id: assignmentId, confirmTitle: submissionCount > 0 ? title : undefined })
          if (res.ok) {
            toast.success('Assignment deleted')
            router.replace(`/courses/${courseId}/assignments`)
            router.refresh()
          } else toast.error(res.error)
        }}
      />
    </div>
  )
}
