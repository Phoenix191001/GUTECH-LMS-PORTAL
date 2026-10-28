'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, Input, Textarea } from '@/components/ui/form'
import { Progress } from '@/components/ui/feedback'
import { FileDropzone } from '@/components/shared/file-dropzone'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { uploadToSignedUrl } from '@/lib/upload'
import { createLinkResource, createResourceUpload, finalizeResource, updateResource } from '../actions'
import { externalUrlSchema, resourceFormSchema, type ResourceFormValues } from '../schemas'

export type EditableResource = {
  id: string
  title: string
  description: string | null
  kind: 'file' | 'link'
  external_url: string | null
}

/** Create (file or link) or edit a resource. Files go browser -> Storage via a signed URL. */
export function ResourceDialog({
  courseId,
  resource,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  courseId: string
  resource?: EditableResource
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const editing = !!resource
  const [innerOpen, setInnerOpen] = useState(false)
  const open = controlledOpen ?? innerOpen
  const setOpen = (v: boolean) => {
    setInnerOpen(v)
    onOpenChange?.(v)
  }
  const [mode, setMode] = useState<'file' | 'link'>(resource?.kind ?? 'file')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: { title: resource?.title ?? '', description: resource?.description ?? '', url: resource?.external_url ?? '' },
  })

  const close = () => {
    setOpen(false)
    setFile(null)
    setProgress(null)
    if (!editing) reset({ title: '', description: '', url: '' })
  }

  const onSubmit = handleSubmit(async (values) => {
    setBusy(true)
    let uploadedPath: string | null = null
    try {
      const description = values.description || undefined

      if (mode === 'link') {
        const parsed = externalUrlSchema.safeParse(values.url)
        if (!parsed.success) {
          setError('url', { message: parsed.error.issues[0]?.message ?? 'Enter a valid link' })
          return
        }
        const res = editing
          ? await updateResource({ id: resource.id, title: values.title, description, url: parsed.data })
          : await createLinkResource({ courseId, title: values.title, description, url: parsed.data })
        if (!res.ok) return void toast.error(res.error)
      } else {
        let uploaded: { path: string; fileName: string; fileSize: number; mimeType: string } | undefined
        if (file) {
          const meta = { fileName: file.name, fileSize: file.size, mimeType: file.type }
          const ticket = await createResourceUpload({ courseId, ...meta })
          if (!ticket.ok) return void toast.error(ticket.error)
          setProgress(0)
          await uploadToSignedUrl('resources', ticket.data, file, setProgress)
          uploadedPath = ticket.data.path
          uploaded = { path: ticket.data.path, ...meta }
        } else if (!editing) {
          return void toast.error('Choose a file to upload.')
        }
        const res = editing
          ? await updateResource({ id: resource.id, title: values.title, description, file: uploaded })
          : await finalizeResource({ courseId, title: values.title, description, file: uploaded! })
        if (!res.ok) {
          if (uploadedPath) await createClient().storage.from('resources').remove([uploadedPath]) // no orphan files
          return void toast.error(res.error)
        }
      }

      toast.success(editing ? 'Resource updated' : 'Resource added')
      close()
      router.refresh()
    } catch (e) {
      if (uploadedPath) await createClient().storage.from('resources').remove([uploadedPath])
      toast.error(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  })

  return (
    <Dialog open={open} onOpenChange={(v) => (busy ? undefined : v ? setOpen(true) : close())}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit resource' : 'Upload resource'}</DialogTitle>
          <DialogDescription>
            {editing ? 'Update the details, or replace the file.' : 'Share a file or a link with everyone in this course.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            {!editing && (
              <div role="tablist" aria-label="Resource type" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                {(['file', 'link'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    disabled={busy}
                    onClick={() => setMode(m)}
                    className={cn(
                      'rounded-lg py-2 text-sm font-medium transition',
                      mode === m ? 'bg-card shadow-[var(--shadow-soft)]' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {m === 'file' ? 'Upload a file' : 'Add a link'}
                  </button>
                ))}
              </div>
            )}

            <Field label="Title" htmlFor="res-title" required error={errors.title?.message}>
              <Input id="res-title" maxLength={150} aria-invalid={!!errors.title} aria-describedby={errors.title ? 'res-title-msg' : undefined} {...register('title')} />
            </Field>
            <Field label="Description" htmlFor="res-desc" error={errors.description?.message} hint="Optional">
              <Textarea id="res-desc" rows={3} maxLength={1000} {...register('description')} />
            </Field>

            {mode === 'link' ? (
              <Field label="Link" htmlFor="res-url" required error={errors.url?.message}>
                <Input id="res-url" type="url" inputMode="url" placeholder="https://" aria-invalid={!!errors.url} {...register('url')} />
              </Field>
            ) : (
              <div className="space-y-2">
                <span className="text-sm font-medium">{editing ? 'Replace file (optional)' : 'File'}</span>
                <FileDropzone bucket="resources" file={file} onChange={setFile} disabled={busy} id="res-file" />
                {progress !== null && (
                  <div className="space-y-1">
                    <Progress value={progress} />
                    <p className="text-xs text-muted-foreground" aria-live="polite">Uploading… {progress}%</p>
                  </div>
                )}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {editing ? 'Save changes' : 'Add resource'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
