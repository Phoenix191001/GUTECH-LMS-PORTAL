'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input, SwitchField, Textarea } from '@/components/ui/form'
import { useAction } from '@/hooks/use-action'
import { fromLocalInputValue, toLocalInputValue } from '@/lib/utils'
import { createQuiz, updateQuiz } from '../actions'
import { createQuizSchema, quizFormSchema, updateQuizSchema, type QuizFormValues } from '../schemas'

export type EditableQuiz = {
  id: string
  title: string
  description: string | null
  duration_minutes: number
  opens_at: string
  closes_at: string
  max_attempts: number
  shuffle_questions: boolean
  show_answers_after_close: boolean
}

function inDays(days: number, hour: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 0, 0, 0)
  return toLocalInputValue(d.toISOString())
}

/** Quiz settings: time limit, window, attempts, shuffle, show answers after close. */
export function QuizSettingsForm({ courseId, quiz, onSaved }: { courseId: string; quiz?: EditableQuiz; onSaved?: () => void }) {
  const router = useRouter()
  const editing = !!quiz
  const { pending, run } = useAction()
  const defaults = useMemo<QuizFormValues>(
    () => ({
      title: quiz?.title ?? '',
      description: quiz?.description ?? '',
      durationMinutes: String(quiz?.duration_minutes ?? 30),
      opensAt: quiz ? toLocalInputValue(quiz.opens_at) : inDays(1, 9),
      closesAt: quiz ? toLocalInputValue(quiz.closes_at) : inDays(2, 9),
      maxAttempts: String(quiz?.max_attempts ?? 1),
      shuffleQuestions: quiz?.shuffle_questions ?? false,
      showAnswersAfterClose: quiz?.show_answers_after_close ?? true,
    }),
    [quiz],
  )
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isDirty },
  } = useForm<QuizFormValues>({ resolver: zodResolver(quizFormSchema), defaultValues: defaults })

  const onSubmit = handleSubmit((v) => {
    const base = {
      title: v.title,
      description: v.description || undefined,
      durationMinutes: Number(v.durationMinutes),
      opensAt: fromLocalInputValue(v.opensAt),
      closesAt: fromLocalInputValue(v.closesAt),
      maxAttempts: Number(v.maxAttempts),
      shuffleQuestions: v.shuffleQuestions,
      showAnswersAfterClose: v.showAnswersAfterClose,
    }
    const payload = editing ? { id: quiz.id, ...base } : { courseId, ...base }
    const check = (editing ? updateQuizSchema : createQuizSchema).safeParse(payload)
    if (!check.success) {
      const issue = check.error.issues[0]
      const key = String(issue?.path[0] ?? 'title')
      const map: Record<string, keyof QuizFormValues> = { durationMinutes: 'durationMinutes', opensAt: 'opensAt', closesAt: 'closesAt', maxAttempts: 'maxAttempts', title: 'title' }
      return setError(map[key] ?? 'title', { message: issue?.message })
    }
    if (editing) {
      run(() => updateQuiz({ id: quiz.id, ...base }), { success: 'Quiz settings saved', onSuccess: () => { router.refresh(); onSaved?.() } })
    } else {
      run(() => createQuiz({ courseId, ...base }), {
        success: 'Quiz created. Now add questions.',
        onSuccess: (data) => router.push(`/courses/${courseId}/quizzes/${data.id}/edit`),
      })
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardContent className="space-y-5 pt-6">
          <Field label="Title" htmlFor="q-title" required error={errors.title?.message}>
            <Input id="q-title" maxLength={150} aria-invalid={!!errors.title} {...register('title')} />
          </Field>
          <Field label="Description" htmlFor="q-desc" error={errors.description?.message} hint="Optional. Shown before students start.">
            <Textarea id="q-desc" rows={3} {...register('description')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Opens" htmlFor="q-open" required error={errors.opensAt?.message}>
              <Input id="q-open" type="datetime-local" aria-invalid={!!errors.opensAt} {...register('opensAt')} />
            </Field>
            <Field label="Closes" htmlFor="q-close" required error={errors.closesAt?.message}>
              <Input id="q-close" type="datetime-local" aria-invalid={!!errors.closesAt} {...register('closesAt')} />
            </Field>
            <Field label="Time limit (minutes)" htmlFor="q-dur" required error={errors.durationMinutes?.message} hint="Counted from when each student starts.">
              <Input id="q-dur" type="number" inputMode="numeric" min={1} max={600} aria-invalid={!!errors.durationMinutes} {...register('durationMinutes')} />
            </Field>
            <Field label="Attempts allowed" htmlFor="q-att" required error={errors.maxAttempts?.message} hint="The best attempt counts in the gradebook.">
              <Input id="q-att" type="number" inputMode="numeric" min={1} max={20} aria-invalid={!!errors.maxAttempts} {...register('maxAttempts')} />
            </Field>
          </div>
          <div className="grid gap-3">
            <Controller control={control} name="shuffleQuestions" render={({ field }) => (
              <SwitchField id="q-shuffle" label="Shuffle questions" description="Each student sees the questions in a different order." checked={field.value} onCheckedChange={field.onChange} />
            )} />
            <Controller control={control} name="showAnswersAfterClose" render={({ field }) => (
              <SwitchField id="q-show" label="Show correct answers after the quiz closes" checked={field.value} onCheckedChange={field.onChange} />
            )} />
          </div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" loading={pending} disabled={editing && !isDirty}>
          {editing ? 'Save settings' : 'Create and add questions'}
        </Button>
      </div>
    </form>
  )
}
