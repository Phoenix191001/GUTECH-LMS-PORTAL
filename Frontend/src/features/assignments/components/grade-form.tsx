'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowRight, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/form'
import { useAction } from '@/hooks/use-action'
import { gradeSubmission } from '../actions'

/** Marks (0..max) + written feedback. "Save & next" keeps grading fast. */
export function GradeForm({
  assignmentId,
  studentId,
  maxMarks,
  initialMarks,
  initialFeedback,
  nextHref,
}: {
  assignmentId: string
  studentId: string
  maxMarks: number
  initialMarks: number | null
  initialFeedback: string | null
  nextHref: string | null
}) {
  const router = useRouter()
  const { pending, run } = useAction()
  const [marks, setMarks] = useState(initialMarks === null ? '' : String(initialMarks))
  const [feedback, setFeedback] = useState(initialFeedback ?? '')
  const [error, setError] = useState<string | undefined>()

  const save = (goNext: boolean) => {
    const n = Number(marks)
    if (marks.trim() === '' || Number.isNaN(n)) return setError('Enter marks')
    if (n < 0 || n > maxMarks) return setError(`Marks must be between 0 and ${maxMarks}`)
    setError(undefined)
    run(() => gradeSubmission({ assignmentId, studentId, marks: n, feedback }), {
      success: 'Marks saved',
      onSuccess: () => {
        if (goNext && nextHref) router.push(nextHref)
        else router.refresh()
      },
      onError: (msg, fields) => setError(fields?.marks?.[0] ?? msg),
    })
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        save(false)
      }}
      className="space-y-4"
    >
      <Field label={`Marks (out of ${maxMarks})`} htmlFor="g-marks" required error={error}>
        <Input
          id="g-marks"
          type="number"
          inputMode="decimal"
          min={0}
          max={maxMarks}
          step="0.01"
          value={marks}
          onChange={(e) => setMarks(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? 'g-marks-msg' : undefined}
          className="max-w-40"
        />
      </Field>
      <Field label="Feedback" htmlFor="g-feedback" hint="Visible to the student as soon as you save.">
        <Textarea id="g-feedback" rows={6} value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={5000} />
      </Field>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" loading={pending}>
          <Save /> Save
        </Button>
        {nextHref && (
          <Button type="button" variant="soft" onClick={() => save(true)} disabled={pending}>
            Save &amp; next <ArrowRight />
          </Button>
        )}
      </div>
    </form>
  )
}
