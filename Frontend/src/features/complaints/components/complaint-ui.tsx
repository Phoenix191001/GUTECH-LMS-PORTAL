'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, ChevronRight, Flag, MessageSquareReply, Plus, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, type Tone } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/form'
import { EmptyState, Notice } from '@/components/ui/feedback'
import { LocalTime } from '@/components/shared/local-time'
import { useAction } from '@/hooks/use-action'
import { cn } from '@/lib/utils'
import type { ComplaintCategory, ComplaintStatus } from '@/types/database'
import { markComplaintsSeen, createComplaint, updateComplaintStatus, withdrawComplaint } from '../actions'
import {
  CATEGORIES,
  CATEGORY_LABEL,
  NEXT_STATUSES,
  STATUS_LABEL,
  complaintFormSchema,
  createComplaintSchema,
  needsResponse,
  referenceOf,
  type ComplaintFormValues,
} from '../schemas'

export type ComplaintView = {
  id: string
  subject: string
  description: string
  category: ComplaintCategory
  status: ComplaintStatus
  adminResponse: string | null
  createdAt: string
  resolvedAt: string | null
  courseCode: string | null
  submitterName?: string
  submitterRole?: string
}

const STATUS_TONE: Record<ComplaintStatus, Tone> = { open: 'info', in_review: 'warning', resolved: 'success', rejected: 'danger' }

export function StatusChip({ status }: { status: ComplaintStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
}

/* ------------------------------ file a complaint ------------------------------ */

export function NewComplaintDialog({ courses, trigger }: { courses: { id: string; code: string; title: string }[]; trigger?: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reference, setReference] = useState<string | null>(null)
  const { pending, run } = useAction()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<ComplaintFormValues>({
    resolver: zodResolver(complaintFormSchema),
    defaultValues: { category: 'academic', courseId: '', subject: '', description: '' },
  })

  const onSubmit = handleSubmit((v) => {
    const payload = { category: v.category, courseId: v.courseId || null, subject: v.subject, description: v.description }
    const check = createComplaintSchema.safeParse(payload)
    if (!check.success) return setError((check.error.issues[0]?.path[0] as keyof ComplaintFormValues) ?? 'subject', { message: check.error.issues[0]?.message })
    run(() => createComplaint(payload), {
      onSuccess: (data) => {
        setReference(referenceOf(data.id))
        reset()
        router.refresh()
      },
    })
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (pending) return
        setOpen(v)
        if (!v) setReference(null)
      }}
    >
      <DialogTrigger asChild>{trigger ?? <Button><Plus /> New complaint</Button>}</DialogTrigger>
      <DialogContent>
        {reference ? (
          <>
            <DialogHeader>
              <DialogTitle>Complaint received</DialogTitle>
              <DialogDescription>The administration will review it. You will see updates under Complaints.</DialogDescription>
            </DialogHeader>
            <DialogBody className="py-8 text-center">
              <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-success-soft text-success"><CheckCircle2 className="size-7" /></span>
              <p className="text-sm text-muted-foreground">Your reference number</p>
              <p className="mt-1 font-mono text-3xl font-semibold tracking-wider">{reference}</p>
            </DialogBody>
            <DialogFooter><Button onClick={() => { setOpen(false); setReference(null) }}>Done</Button></DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New complaint</DialogTitle>
              <DialogDescription>Only you and the administrators can see this. Not even a teacher you mention can.</DialogDescription>
            </DialogHeader>
            <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
              <DialogBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Category" htmlFor="cp-cat" required>
                    <Select id="cp-cat" {...register('category')}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                    </Select>
                  </Field>
                  <Field label="Course" htmlFor="cp-course" hint="Optional">
                    <Select id="cp-course" {...register('courseId')}>
                      <option value="">Not about a course</option>
                      {courses.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.title}</option>)}
                    </Select>
                  </Field>
                </div>
                <Field label="Subject" htmlFor="cp-subject" required error={errors.subject?.message}>
                  <Input id="cp-subject" maxLength={150} aria-invalid={!!errors.subject} {...register('subject')} />
                </Field>
                <Field label="Description" htmlFor="cp-desc" required error={errors.description?.message} hint={`${watch('description').length}/3000`}>
                  <Textarea id="cp-desc" rows={6} maxLength={3000} aria-invalid={!!errors.description} {...register('description')} />
                </Field>
              </DialogBody>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
                <Button type="submit" loading={pending}>Submit complaint</Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------- my complaints -------------------------------- */

export function MyComplaints({ complaints, courses }: { complaints: ComplaintView[]; courses: { id: string; code: string; title: string }[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<ComplaintView | null>(null)

  // opening this page counts as "seen": clears the notification dot
  useEffect(() => {
    void markComplaintsSeen().then(() => router.refresh())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (complaints.length === 0) {
    return <EmptyState icon={Flag} title="No complaints" description="If something is wrong, tell the administration. Only you and the administrators will see it." action={<NewComplaintDialog courses={courses} />} />
  }

  return (
    <>
      <ul className="space-y-3">
        {complaints.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setSelected(c)}
              className="group flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] sm:p-5"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-foreground"><Flag className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium group-hover:text-primary">{c.subject}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>{CATEGORY_LABEL[c.category]}</span><span aria-hidden>·</span>
                  <LocalTime iso={c.createdAt} mode="date" /><span aria-hidden>·</span>
                  <span className="font-mono">#{referenceOf(c.id)}</span>
                </span>
              </span>
              <StatusChip status={c.status} />
              <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
            </button>
          </li>
        ))}
      </ul>
      {selected && <ComplaintDetail complaint={selected} onClose={() => setSelected(null)} canWithdraw />}
    </>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  )
}

function ComplaintDetail({ complaint: c, onClose, canWithdraw }: { complaint: ComplaintView; onClose: () => void; canWithdraw?: boolean }) {
  const router = useRouter()
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent variant="drawer-right">
        <DialogHeader>
          <DialogTitle>{c.subject}</DialogTitle>
          <DialogDescription>Reference <span className="font-mono">#{referenceOf(c.id)}</span></DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={c.status} />
            <Badge>{CATEGORY_LABEL[c.category]}</Badge>
            {c.courseCode && <Badge tone="info">{c.courseCode}</Badge>}
          </div>
          <dl className="space-y-4">
            <Detail label="Filed"><LocalTime iso={c.createdAt} /></Detail>
            <Detail label="Your description"><p className="whitespace-pre-wrap">{c.description}</p></Detail>
            <Detail label="Response from the administration">
              {c.adminResponse ? (
                <p className="whitespace-pre-wrap rounded-xl bg-muted/60 p-3.5">{c.adminResponse}</p>
              ) : (
                <span className="text-muted-foreground">No response yet.</span>
              )}
            </Detail>
            {c.resolvedAt && <Detail label="Closed"><LocalTime iso={c.resolvedAt} /></Detail>}
          </dl>
        </DialogBody>
        {canWithdraw && c.status === 'open' && (
          <DialogFooter>
            <ConfirmDialog
              trigger={<Button variant="outline"><Undo2 /> Withdraw complaint</Button>}
              title="Withdraw this complaint?"
              description="It will be closed with the response “Withdrawn by user”. You can file a new one later if needed."
              confirmLabel="Withdraw"
              onConfirm={async () => {
                const res = await withdrawComplaint(c.id)
                if (res.ok) {
                  toast.success('Complaint withdrawn')
                  onClose()
                  router.refresh()
                } else toast.error(res.error)
              }}
            />
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* --------------------------------- admin review --------------------------------- */

export function AdminReviewButton({ complaint }: { complaint: ComplaintView }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={complaint.status === 'open' ? 'default' : 'outline'} size="sm" onClick={() => setOpen(true)}>
        <MessageSquareReply /> {complaint.status === 'resolved' || complaint.status === 'rejected' ? 'View' : 'Review'}
      </Button>
      {open && <AdminReviewDrawer complaint={complaint} onClose={() => setOpen(false)} />}
    </>
  )
}

function AdminReviewDrawer({ complaint: c, onClose }: { complaint: ComplaintView; onClose: () => void }) {
  const router = useRouter()
  const next = NEXT_STATUSES[c.status]
  const [status, setStatus] = useState<ComplaintStatus | ''>(next[0] ?? '')
  const [response, setResponse] = useState(c.adminResponse ?? '')
  const [error, setError] = useState<string>()
  const { pending, run } = useAction()
  const closed = next.length === 0

  const save = () => {
    if (!status) return
    if (needsResponse(status) && !response.trim()) return setError('A response is required to resolve or reject a complaint.')
    setError(undefined)
    run(() => updateComplaintStatus({ id: c.id, status, response }), {
      success: `Marked as ${STATUS_LABEL[status].toLowerCase()}`,
      onSuccess: () => {
        onClose()
        router.refresh()
      },
      onError: setError,
    })
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !pending && onClose()}>
      <DialogContent variant="drawer-right">
        <DialogHeader>
          <DialogTitle>{c.subject}</DialogTitle>
          <DialogDescription>Reference <span className="font-mono">#{referenceOf(c.id)}</span></DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={c.status} />
            <Badge>{CATEGORY_LABEL[c.category]}</Badge>
            {c.courseCode && <Badge tone="info">{c.courseCode}</Badge>}
          </div>
          <dl className="space-y-4">
            <Detail label="Submitted by">{c.submitterName ?? 'Unknown'} <span className="capitalize text-muted-foreground">({c.submitterRole ?? 'user'})</span></Detail>
            <Detail label="Filed"><LocalTime iso={c.createdAt} /></Detail>
            <Detail label="Description"><p className="whitespace-pre-wrap">{c.description}</p></Detail>
            {closed && <Detail label="Response">{c.adminResponse ? <p className="whitespace-pre-wrap rounded-xl bg-muted/60 p-3.5">{c.adminResponse}</p> : '–'}</Detail>}
          </dl>

          {!closed && (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault()
                save()
              }}
              className="space-y-4 border-t pt-5"
            >
              <Field label="Move to" htmlFor="rv-status">
                <Select id="rv-status" value={status} onChange={(e) => setStatus(e.target.value as ComplaintStatus)}>
                  {next.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </Select>
              </Field>
              <Field
                label={status && needsResponse(status) ? 'Response (required)' : 'Response'}
                htmlFor="rv-response"
                error={error}
                hint="Visible to the person who filed the complaint."
              >
                <Textarea id="rv-response" rows={6} maxLength={3000} value={response} onChange={(e) => setResponse(e.target.value)} aria-invalid={!!error} />
              </Field>
              <Button type="submit" loading={pending} className={cn('w-full')}>Save</Button>
            </form>
          )}
          {closed && <Notice tone="info">This complaint is closed and can no longer be changed.</Notice>}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
