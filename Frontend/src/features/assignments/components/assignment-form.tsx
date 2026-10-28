'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Paperclip, TriangleAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input, SwitchField, Textarea } from '@/components/ui/form'
import { Notice, Progress } from '@/components/ui/feedback'
import { FileDropzone } from '@/components/shared/file-dropzone'
import { Markdown } from '@/components/shared/markdown'
import { createResourceUpload } from '@/features/resources/actions'
import { createClient } from '@/lib/supabase/client'
import { uploadToSignedUrl } from '@/lib/upload'
import { cn, fromLocalInputValue, toLocalInputValue } from '@/lib/utils'
import { createAssignment, updateAssignment } from '../actions'
import { assignmentFormSchema, assignmentSchema, updateAssignmentSchema, type AssignmentFormValues } from '../schemas'

export type EditableAssignment = {
  id: string
  title: string
  instructions: string | null
  due_at: string
  max_marks: number
  allow_late: boolean
  is_published: boolean
  attachment_name: string | null
}

function defaultDue() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  d.setHours(23, 59, 0, 0)
  return toLocalInputValue(d.toISOString())
}

/** Create or edit an assignment. The optional attachment uploads straight to Storage. */
export function AssignmentForm({
  courseId,
  assignment,
  hasGraded = false,
}: {
  courseId: string
  assignment?: EditableAssignment
  hasGraded?: boolean
}) {
  const router = useRouter()
  const editing = !!assignment
  const [file, setFile] = useState<File | null>(null)
  const [removeAttachment, setRemoveAttachment] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const defaults = useMemo<AssignmentFormValues>(
    () => ({
      title: assignment?.title ?? '',
      instructions: assignment?.instructions ?? '',
      dueAt: assignment ? toLocalInputValue(assignment.due_at) : defaultDue(),
      maxMarks: assignment ? String(assignment.max_marks) : '100',
      allowLate: assignment?.allow_late ?? false,
      publish: assignment?.is_published ?? false,
    }),
    [assignment],
  )

  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    formState: { errors },
  } = useForm<AssignmentFormValues>({ resolver: zodResolver(assignmentFormSchema), defaultValues: defaults })

  const instructions = watch('instructions')
  const maxChanged = editing && hasGraded && Number(watch('maxMarks')) !== assignment.max_marks

  const onSubmit = handleSubmit(async (v) => {
    setBusy(true)
    let uploadedPath: string | null = null
    try {
      let attachment: { path: string; fileName: string; fileSize: number; mimeType: string } | undefined
      if (file) {
        const meta = { fileName: file.name, fileSize: file.size, mimeType: file.type }
        const ticket = await createResourceUpload({ courseId, ...meta })
        if (!ticket.ok) return void toast.error(ticket.error)
        setProgress(0)
        await uploadToSignedUrl('resources', ticket.data, file, setProgress)
        uploadedPath = ticket.data.path
        attachment = { path: ticket.data.path, ...meta }
      }

      const base = {
        title: v.title,
        instructions: v.instructions || undefined,
        dueAt: v.dueAt ? fromLocalInputValue(v.dueAt) : '',
        maxMarks: Number(v.maxMarks),
        allowLate: v.allowLate,
      }

      if (editing) {
        const payload = { id: assignment.id, ...base, attachment, removeAttachment: removeAttachment && !attachment }
        const check = updateAssignmentSchema.safeParse(payload)
        if (!check.success) return void fail(check.error.issues[0])
        const res = await updateAssignment(payload)
        if (!res.ok) throw new Error(res.error)
        toast.success('Assignment updated')
        router.push(`/courses/${courseId}/assignments/${assignment.id}`)
      } else {
        const payload = { courseId, ...base, attachment, publish: v.publish }
        const check = assignmentSchema.safeParse(payload)
        if (!check.success) return void fail(check.error.issues[0])
        const res = await createAssignment(payload)
        if (!res.ok) throw new Error(res.error)
        toast.success(v.publish ? 'Assignment published' : 'Draft saved')
        router.push(`/courses/${courseId}/assignments/${res.data.id}`)
      }
      router.refresh()
    } catch (e) {
      if (uploadedPath) await createClient().storage.from('resources').remove([uploadedPath])
      toast.error(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
      setProgress(null)
    }

    function fail(issue: { path: PropertyKey[]; message: string } | undefined) {
      const key = issue?.path[0]
      const map: Record<string, keyof AssignmentFormValues> = { dueAt: 'dueAt', maxMarks: 'maxMarks', title: 'title', instructions: 'instructions' }
      setError(typeof key === 'string' && map[key] ? map[key] : 'title', { message: issue?.message })
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardContent className="space-y-5 pt-6">
          <Field label="Title" htmlFor="a-title" required error={errors.title?.message}>
            <Input id="a-title" maxLength={150} aria-invalid={!!errors.title} {...register('title')} />
          </Field>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="a-instr" className="text-sm font-medium">Instructions</label>
              <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs font-medium" role="group" aria-label="Editor mode">
                {[false, true].map((p) => (
                  <button key={String(p)} type="button" aria-pressed={preview === p} onClick={() => setPreview(p)} className={cn('rounded-md px-2.5 py-1 transition', preview === p ? 'bg-card shadow-[var(--shadow-soft)]' : 'text-muted-foreground')}>
                    {p ? 'Preview' : 'Write'}
                  </button>
                ))}
              </div>
            </div>
            {preview ? (
              <div className="min-h-32 rounded-lg border bg-card p-4 text-sm">
                {instructions.trim() ? <Markdown>{instructions}</Markdown> : <p className="text-muted-foreground">Nothing to preview.</p>}
              </div>
            ) : (
              <Textarea id="a-instr" rows={7} placeholder="Markdown is supported: **bold**, lists, links…" {...register('instructions')} />
            )}
            {errors.instructions && <p role="alert" className="text-[0.8125rem] text-danger">{errors.instructions.message}</p>}
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Attachment <span className="font-normal text-muted-foreground">(optional)</span></span>
            {assignment?.attachment_name && !removeAttachment && !file && (
              <div className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm">
                <Paperclip className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{assignment.attachment_name}</span>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove attachment" onClick={() => setRemoveAttachment(true)}><X /></Button>
              </div>
            )}
            <FileDropzone bucket="resources" file={file} onChange={setFile} disabled={busy} id="a-file" label="Drop a file here, or browse" />
            {progress !== null && (
              <div className="space-y-1">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground" aria-live="polite">Uploading… {progress}%</p>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Due date and time" htmlFor="a-due" required error={errors.dueAt?.message} hint="Shown to everyone in their own time zone.">
              <Input id="a-due" type="datetime-local" aria-invalid={!!errors.dueAt} {...register('dueAt')} />
            </Field>
            <Field label="Maximum marks" htmlFor="a-max" required error={errors.maxMarks?.message}>
              <Input id="a-max" type="number" inputMode="decimal" min="0.01" step="0.01" aria-invalid={!!errors.maxMarks} {...register('maxMarks')} />
            </Field>
          </div>

          {maxChanged && (
            <Notice tone="warning" className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>Some work is already graded. Changing the maximum does not rescale existing marks.</span>
            </Notice>
          )}

          <div className="grid gap-3">
            <Controller control={control} name="allowLate" render={({ field }) => (
              <SwitchField id="a-late" label="Allow late submissions" description="Late work is accepted after the deadline and marked Late." checked={field.value} onCheckedChange={field.onChange} />
            )} />
            {!editing && (
              <Controller control={control} name="publish" render={({ field }) => (
                <SwitchField id="a-publish" label="Publish now" description="Drafts are invisible to students." checked={field.value} onCheckedChange={field.onChange} />
              )} />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={busy}>Cancel</Button>
        <Button type="submit" loading={busy}>{editing ? 'Save changes' : 'Create assignment'}</Button>
      </div>
    </form>
  )
}
