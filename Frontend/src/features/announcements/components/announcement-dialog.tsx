'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, Input, SwitchField, Textarea } from '@/components/ui/form'
import { useAction } from '@/hooks/use-action'
import { createAnnouncement, updateAnnouncement } from '../actions'
import { announcementFormSchema, type AnnouncementFormValues } from '../schemas'

export type EditableAnnouncement = { id: string; title: string; body: string; isPinned: boolean }

/** Compose or edit an announcement. `courseId = null` posts to everyone (admin only). */
export function AnnouncementDialog({
  courseId,
  announcement,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  courseId: string | null
  announcement?: EditableAnnouncement
  trigger?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const router = useRouter()
  const editing = !!announcement
  const [innerOpen, setInnerOpen] = useState(false)
  const open = controlledOpen ?? innerOpen
  const setOpen = (v: boolean) => {
    setInnerOpen(v)
    onOpenChange?.(v)
  }
  const { pending, run } = useAction()
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<AnnouncementFormValues>({
    resolver: zodResolver(announcementFormSchema),
    defaultValues: { title: announcement?.title ?? '', body: announcement?.body ?? '', isPinned: announcement?.isPinned ?? false },
  })
  const body = useWatch({ control, name: 'body' })

  const onSubmit = handleSubmit((v) => {
    const done = {
      success: editing ? 'Announcement updated' : 'Announcement posted',
      onSuccess: () => {
        setOpen(false)
        if (!editing) reset()
        router.refresh()
      },
    }
    if (editing) run(() => updateAnnouncement({ id: announcement.id, ...v }), done)
    else run(() => createAnnouncement({ courseId, ...v }), done)
  })

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit announcement' : courseId ? 'New announcement' : 'New global announcement'}</DialogTitle>
          <DialogDescription>{courseId ? 'Visible to everyone in this course.' : 'Visible to every user on their dashboard.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            <Field label="Title" htmlFor="an-title" required error={errors.title?.message}>
              <Input id="an-title" maxLength={120} aria-invalid={!!errors.title} {...register('title')} />
            </Field>
            <Field label="Message" htmlFor="an-body" required error={errors.body?.message} hint={`Markdown supported · ${body.length}/5000`}>
              <Textarea id="an-body" rows={7} maxLength={5000} aria-invalid={!!errors.body} {...register('body')} />
            </Field>
            <Controller control={control} name="isPinned" render={({ field }) => (
              <SwitchField id="an-pin" label="Pin to the top" description="Pinned posts stay above newer ones." checked={field.value} onCheckedChange={field.onChange} />
            )} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" loading={pending}>{editing ? 'Save changes' : 'Post'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
