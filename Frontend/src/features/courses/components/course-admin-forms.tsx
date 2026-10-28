'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAction } from '@/hooks/use-action'
import { createCourse, setCourseActive, setCourseTeacher, updateCourse } from '../actions'
import { courseFormSchema, createCourseSchema, updateCourseSchema, type CourseFormValues } from '../schemas'

export type TeacherOption = { id: string; name: string }

export function CreateCourseDialog({ teachers, trigger }: { teachers: TeacherOption[]; trigger: React.ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { pending, run } = useAction()
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<CourseFormValues>({ resolver: zodResolver(courseFormSchema), defaultValues: { code: '', title: '', description: '', teacherId: '' } })

  const onSubmit = handleSubmit((v) => {
    const payload = { code: v.code, title: v.title, description: v.description || undefined, teacherId: v.teacherId }
    const check = createCourseSchema.safeParse(payload)
    if (!check.success) {
      const issue = check.error.issues[0]
      return setError((issue?.path[0] as keyof CourseFormValues) ?? 'code', { message: issue?.message })
    }
    run(() => createCourse(payload), {
      success: 'Course created',
      onSuccess: (data) => {
        setOpen(false)
        reset()
        router.push(`/admin/courses/${data.id}`)
      },
    })
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add course</DialogTitle>
          <DialogDescription>You can enrol students on the next screen.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
              <Field label="Code" htmlFor="c-code" required error={errors.code?.message}>
                <Input id="c-code" placeholder="CS-101" className="uppercase" autoCapitalize="characters" aria-invalid={!!errors.code} {...register('code')} />
              </Field>
              <Field label="Title" htmlFor="c-title" required error={errors.title?.message}>
                <Input id="c-title" aria-invalid={!!errors.title} {...register('title')} />
              </Field>
            </div>
            <Field label="Description" htmlFor="c-desc" error={errors.description?.message} hint="Optional">
              <Textarea id="c-desc" rows={3} {...register('description')} />
            </Field>
            <Field label="Teacher" htmlFor="c-teacher" required error={errors.teacherId?.message}>
              <Select id="c-teacher" aria-invalid={!!errors.teacherId} {...register('teacherId')}>
                <option value="">Choose a teacher…</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" loading={pending}>Create course</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CourseDetailsForm({ course }: { course: { id: string; code: string; title: string; description: string | null } }) {
  const router = useRouter()
  const { pending, run } = useAction()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: { code: course.code, title: course.title, description: course.description ?? '', teacherId: '' },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Course details</CardTitle>
        <CardDescription>The code must be unique. It is always stored in uppercase.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          className="space-y-4"
          onSubmit={handleSubmit((v) => {
            const payload = { id: course.id, code: v.code, title: v.title, description: v.description || undefined }
            const check = updateCourseSchema.safeParse(payload)
            if (!check.success) return setError((check.error.issues[0]?.path[0] as keyof CourseFormValues) ?? 'code', { message: check.error.issues[0]?.message })
            run(() => updateCourse(payload), { success: 'Course updated', onSuccess: () => router.refresh() })
          })}
        >
          <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
            <Field label="Code" htmlFor="d-code" required error={errors.code?.message}>
              <Input id="d-code" className="uppercase" aria-invalid={!!errors.code} {...register('code')} />
            </Field>
            <Field label="Title" htmlFor="d-title" required error={errors.title?.message}>
              <Input id="d-title" aria-invalid={!!errors.title} {...register('title')} />
            </Field>
          </div>
          <Field label="Description" htmlFor="d-desc" error={errors.description?.message}>
            <Textarea id="d-desc" rows={4} {...register('description')} />
          </Field>
          <Button type="submit" loading={pending} disabled={!isDirty}>Save details</Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function CourseTeacherForm({ courseId, teacherId, teachers }: { courseId: string; teacherId: string; teachers: TeacherOption[] }) {
  const router = useRouter()
  const { pending, run } = useAction()
  const [value, setValue] = useState(teacherId)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Teacher</CardTitle>
        <CardDescription>Changing the teacher takes effect immediately. The new teacher sees the course and its data; the previous one loses access.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Course teacher" htmlFor="t-teacher">
          <Select id="t-teacher" value={value} onChange={(e) => setValue(e.target.value)}>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </Field>
        <Button
          loading={pending}
          disabled={value === teacherId}
          onClick={() => run(() => setCourseTeacher({ id: courseId, teacherId: value }), { success: 'Teacher updated', onSuccess: () => router.refresh() })}
        >
          Save teacher
        </Button>
      </CardContent>
    </Card>
  )
}

export function CourseActiveToggle({ courseId, active }: { courseId: string; active: boolean }) {
  const router = useRouter()
  const { run } = useAction()
  const apply = () =>
    run(() => setCourseActive(courseId, !active), {
      success: active ? 'Course deactivated' : 'Course reactivated',
      onSuccess: () => router.refresh(),
    })

  return active ? (
    <ConfirmDialog
      trigger={<Button variant="outline"><Power /> Deactivate</Button>}
      title="Deactivate this course?"
      description="Students and the teacher will no longer see it. All data is kept and you can reactivate it at any time."
      confirmLabel="Deactivate course"
      onConfirm={apply}
    />
  ) : (
    <Button onClick={apply}><Power /> Reactivate</Button>
  )
}
