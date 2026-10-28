import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft, ChevronRight, FileDown, ImageIcon } from 'lucide-react'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { LocalTime } from '@/components/shared/local-time'
import { Markdown } from '@/components/shared/markdown'
import { canManage } from '@/features/courses/queries'
import { getAssignmentOrNotFound, loadRoster } from '@/features/assignments/queries'
import { GradeForm } from '@/features/assignments/components/grade-form'
import { signedUrl } from '@/lib/storage'
import { num } from '@/lib/utils'

export const metadata: Metadata = { title: 'Grade submission' }

export default async function GradePage({ params }: { params: Promise<{ courseId: string; assignmentId: string; studentId: string }> }) {
  const { courseId, assignmentId, studentId } = await params
  const { user, course, assignment } = await getAssignmentOrNotFound(courseId, assignmentId)
  if (!canManage(user, course)) redirect(`/courses/${courseId}/assignments/${assignmentId}`)

  const roster = await loadRoster(user.supabase, courseId, assignmentId)
  const index = roster.findIndex((r) => r.studentId === studentId)
  if (index === -1) notFound()
  const entry = roster[index]!
  const sub = entry.submission
  const base = `/courses/${courseId}/assignments/${assignmentId}`
  const prev = roster[index - 1]
  const next = roster[index + 1]
  const fileUrl = await signedUrl(user.supabase, 'submissions', sub?.file_path)
  const isImage = /\.(png|jpe?g)$/i.test(sub?.file_name ?? '')
  const isPdf = /\.pdf$/i.test(sub?.file_name ?? '')

  return (
    <>
      <Link href={base} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground">
        <ChevronLeft className="size-4" /> All submissions
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{assignment.title}</p>
          <h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
            {entry.name} {entry.removed && <Badge className="ml-1 align-middle">Removed</Badge>}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {entry.rollNo ?? 'No roll number'} · {index + 1} of {roster.length}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={prev ? `${base}/grade/${prev.studentId}` : '#'} aria-disabled={!prev} className={buttonVariants({ variant: 'outline', size: 'sm', className: !prev ? 'pointer-events-none opacity-50' : '' })}>
            <ChevronLeft /> Previous
          </Link>
          <Link href={next ? `${base}/grade/${next.studentId}` : '#'} aria-disabled={!next} className={buttonVariants({ variant: 'outline', size: 'sm', className: !next ? 'pointer-events-none opacity-50' : '' })}>
            Next <ChevronRight />
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Submission</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!sub || (!sub.text_answer && !sub.file_path) ? (
              <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                {sub ? 'This record has marks but no submitted work.' : 'Nothing submitted yet. You can still enter marks (for example 0).'}
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Submitted <LocalTime iso={sub.submitted_at} />
                  {sub.is_late && <Badge tone="warning" className="ml-2">Late</Badge>}
                </p>
                {sub.text_answer && (
                  <div className="rounded-xl border bg-muted/30 p-4 text-sm"><Markdown>{sub.text_answer}</Markdown></div>
                )}
                {fileUrl && (
                  <div className="space-y-3">
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                      <FileDown /> {sub.file_name ?? 'Download file'}
                    </a>
                    {isImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl} alt={`Submission by ${entry.name}`} className="max-h-[32rem] w-full rounded-xl border object-contain" />
                    )}
                    {isPdf && <iframe src={fileUrl} title={`Submission by ${entry.name}`} className="h-[32rem] w-full rounded-xl border" />}
                    {!isImage && !isPdf && (
                      <p className="flex items-center gap-2 text-xs text-muted-foreground"><ImageIcon className="size-3.5" /> No inline preview for this file type. Download it to review.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Grade</CardTitle>
          </CardHeader>
          <CardContent>
            <GradeForm
              key={studentId}
              assignmentId={assignmentId}
              studentId={studentId}
              maxMarks={Number(assignment.max_marks)}
              initialMarks={sub?.marks_obtained ?? null}
              initialFeedback={sub?.feedback ?? null}
              nextHref={next ? `${base}/grade/${next.studentId}` : null}
            />
            {sub?.graded_at && <p className="mt-4 text-xs text-muted-foreground">Last graded <LocalTime iso={sub.graded_at} /> · max {num(assignment.max_marks)}</p>}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
