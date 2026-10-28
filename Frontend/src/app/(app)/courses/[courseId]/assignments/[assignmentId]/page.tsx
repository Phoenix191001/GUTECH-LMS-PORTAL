import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarClock, ChevronLeft, FileDown, Lock, Paperclip, Target } from 'lucide-react'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'
import { ResponsiveTable, type Column } from '@/components/shared/responsive-table'
import { Countdown, LocalTime } from '@/components/shared/local-time'
import { Markdown } from '@/components/shared/markdown'
import { canManage } from '@/features/courses/queries'
import { getAssignmentOrNotFound, loadRoster, type RosterEntry } from '@/features/assignments/queries'
import { AssignmentTeacherActions } from '@/features/assignments/components/teacher-actions'
import { SubmitForm } from '@/features/assignments/components/submit-form'
import { canSubmitNow, statusChip, studentStatus } from '@/features/assignments/status'
import { signedUrl } from '@/lib/storage'
import { num, percent } from '@/lib/utils'

export const metadata: Metadata = { title: 'Assignment' }

export default async function AssignmentPage({ params }: { params: Promise<{ courseId: string; assignmentId: string }> }) {
  const { courseId, assignmentId } = await params
  const { user, course, assignment } = await getAssignmentOrNotFound(courseId, assignmentId)
  const { supabase } = user
  const manage = canManage(user, course)
  const serverNow = new Date().toISOString()
  const attachmentUrl = await signedUrl(supabase, 'resources', assignment.attachment_path)

  const header = (
    <>
      <Link href={`/courses/${courseId}/assignments`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground">
        <ChevronLeft className="size-4" /> Assignments
      </Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold leading-tight text-balance sm:text-3xl">{assignment.title}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" /> Due <LocalTime iso={assignment.due_at} /></span>
            <span className="inline-flex items-center gap-1.5"><Target className="size-4" /> {num(assignment.max_marks)} marks</span>
            {assignment.allow_late && <Badge tone="warning">Late submissions allowed</Badge>}
            {manage && <Badge tone={assignment.is_published ? 'success' : 'neutral'}>{assignment.is_published ? 'Published' : 'Draft'}</Badge>}
          </p>
        </div>
      </div>
    </>
  )

  const body = (
    <Card className="mb-6">
      <CardHeader><CardTitle>Instructions</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {assignment.instructions ? <Markdown>{assignment.instructions}</Markdown> : <p className="text-sm text-muted-foreground">No written instructions.</p>}
        {attachmentUrl && (
          <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Paperclip /> {assignment.attachment_name ?? 'Attachment'}
          </a>
        )}
      </CardContent>
    </Card>
  )

  /* ----------------------------- teacher / admin ----------------------------- */
  if (manage) {
    const roster = await loadRoster(supabase, courseId, assignmentId)
    const submitted = roster.filter((r) => r.submission).length
    const graded = roster.filter((r) => r.submission?.marks_obtained !== null && r.submission?.marks_obtained !== undefined).length
    const late = roster.filter((r) => r.submission?.is_late).length
    const gradedMarks = roster.flatMap((r) => (r.submission?.marks_obtained != null ? [r.submission.marks_obtained] : []))
    const avg = gradedMarks.length ? gradedMarks.reduce((a, b) => a + b, 0) / gradedMarks.length : null

    const columns: Column<RosterEntry>[] = [
      {
        key: 'student',
        header: 'Student',
        primary: true,
        cell: (r) => (
          <Link href={`/courses/${courseId}/assignments/${assignmentId}/grade/${r.studentId}`} className="group">
            <span className="font-medium group-hover:text-primary">{r.name}</span>
            {r.removed && <Badge tone="neutral" className="ml-2">Removed</Badge>}
          </Link>
        ),
      },
      { key: 'roll', header: 'Roll no.', cell: (r) => r.rollNo ?? <span className="text-muted-foreground">–</span> },
      {
        key: 'status',
        header: 'Status',
        cell: (r) => {
          const s = r.submission
          if (!s) return <Badge>Not submitted</Badge>
          if (s.marks_obtained !== null) return <Badge tone="success">Graded</Badge>
          return s.is_late ? <Badge tone="warning">Late</Badge> : <Badge tone="info">Submitted</Badge>
        },
      },
      { key: 'at', header: 'Submitted', cell: (r) => (r.submission?.text_answer || r.submission?.file_path ? <LocalTime iso={r.submission.submitted_at} /> : <span className="text-muted-foreground">–</span>) },
      { key: 'marks', header: 'Marks', cell: (r) => (r.submission?.marks_obtained != null ? `${num(r.submission.marks_obtained)} / ${num(assignment.max_marks)}` : <span className="text-muted-foreground">–</span>) },
      {
        key: 'action',
        header: '',
        actions: true,
        className: 'text-right',
        cell: (r) => (
          <Link href={`/courses/${courseId}/assignments/${assignmentId}/grade/${r.studentId}`} className={buttonVariants({ variant: r.submission ? 'soft' : 'outline', size: 'sm' })}>
            {r.submission?.marks_obtained != null ? 'Review' : r.submission ? 'Grade' : 'Enter marks'}
          </Link>
        ),
      },
    ]

    return (
      <>
        {header}
        <div className="mb-6"><AssignmentTeacherActions courseId={courseId} assignmentId={assignmentId} title={assignment.title} published={assignment.is_published} submissionCount={roster.filter((r) => r.submission).length} /></div>
        {!assignment.is_published && <Notice tone="warning" className="mb-6">This is a draft. Students cannot see it until you publish.</Notice>}
        {body}
        <section aria-labelledby="roster-h">
          <h3 id="roster-h" className="mb-3 font-display text-xl font-semibold">Submissions</h3>
          <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Submitted', `${submitted}/${roster.filter((r) => !r.removed).length}`],
              ['Graded', String(graded)],
              ['Late', String(late)],
              ['Average', avg === null ? '–' : `${num(avg)} (${percent(avg, assignment.max_marks)}%)`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)]">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</dt>
                <dd className="mt-1 font-display text-2xl font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <ResponsiveTable columns={columns} rows={roster} rowKey={(r) => r.studentId} caption="Submissions by student" />
        </section>
      </>
    )
  }

  /* -------------------------------- student -------------------------------- */
  const { data: sub } = await supabase.from('submissions').select('*').eq('assignment_id', assignmentId).eq('student_id', user.id).maybeSingle()
  const open = canSubmitNow(assignment)
  const status = studentStatus(assignment, sub)
  const chip = statusChip(status, assignment, sub)
  const isGraded = status === 'graded'
  const submissionFileUrl = await signedUrl(supabase, 'submissions', sub?.file_path)
  const beforeDeadline = new Date(assignment.due_at).getTime() > Date.now()

  return (
    <>
      {header}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge tone={chip.tone} className="px-3 py-1 text-sm">{chip.label}</Badge>
        {beforeDeadline ? (
          <span className="text-sm text-muted-foreground">
            Time left: <Countdown targetIso={assignment.due_at} serverNow={serverNow} className="font-semibold tabular-nums text-foreground" />
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Deadline passed</span>
        )}
      </div>

      {body}

      {isGraded && sub && (
        <Card className="mb-6 border-success/40">
          <CardHeader><CardTitle>Your result</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="font-display text-4xl font-semibold text-success">
              {num(sub.marks_obtained)} <span className="text-xl text-muted-foreground">/ {num(assignment.max_marks)}</span>
            </p>
            <p className="text-sm text-muted-foreground">{percent(sub.marks_obtained ?? 0, assignment.max_marks)}%</p>
            {sub.feedback && (
              <div className="rounded-xl bg-muted/60 p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teacher feedback</p>
                <p className="whitespace-pre-wrap text-sm">{sub.feedback}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{sub ? 'Your submission' : 'Submit your work'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {sub && (
            <p className="text-sm text-muted-foreground">
              Submitted <LocalTime iso={sub.submitted_at} />
              {sub.is_late && <Badge tone="warning" className="ml-2">Late</Badge>}
            </p>
          )}
          {isGraded || !open ? (
            <>
              {!isGraded && !sub && (
                <Notice tone="danger" className="flex items-start gap-2"><Lock className="mt-0.5 size-4 shrink-0" /> The deadline has passed and late submissions are not accepted.</Notice>
              )}
              {isGraded && <Notice tone="info" className="flex items-start gap-2"><Lock className="mt-0.5 size-4 shrink-0" /> This submission has been graded and is now locked.</Notice>}
              {sub?.text_answer && <p className="whitespace-pre-wrap rounded-xl border bg-muted/30 p-4 text-sm">{sub.text_answer}</p>}
              {submissionFileUrl && (
                <a href={submissionFileUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  <FileDown /> {sub?.file_name ?? 'Your file'}
                </a>
              )}
            </>
          ) : (
            <>
              {!beforeDeadline && <Notice tone="warning">The deadline has passed. Your submission will be marked as late.</Notice>}
              {submissionFileUrl && (
                <a href={submissionFileUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                  <FileDown /> View current file
                </a>
              )}
              <SubmitForm assignmentId={assignmentId} existingText={sub?.text_answer ?? null} existingFileName={sub?.file_name ?? null} isResubmit={!!sub} />
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}
