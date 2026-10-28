'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/form'
import { useAction } from '@/hooks/use-action'
import { cn } from '@/lib/utils'
import { saveQuestion } from '../actions'
import { QUESTION_LABELS, QUESTION_TYPES, questionSchema, type QuestionKind } from '../schemas'

export type BuilderQuestion = {
  id: string
  position: number
  type: QuestionKind
  prompt: string
  marks: number
  options: { id: string; position: number; text: string; is_correct: boolean }[]
}

type Draft = { text: string; isCorrect: boolean }

const blankOptions = (): Draft[] => [
  { text: '', isCorrect: true },
  { text: '', isCorrect: false },
]

/** Add or edit a question. Options carry a "correct" flag; true/false has two fixed options. */
export function QuestionEditor({
  quizId,
  question,
  open,
  onOpenChange,
}: {
  quizId: string
  question: BuilderQuestion | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const { pending, run } = useAction()
  const [type, setType] = useState<QuestionKind>(question?.type ?? 'mcq_single')
  const [prompt, setPrompt] = useState(question?.prompt ?? '')
  const [marks, setMarks] = useState(String(question?.marks ?? 1))
  const [options, setOptions] = useState<Draft[]>(
    question && (question.type === 'mcq_single' || question.type === 'mcq_multi')
      ? question.options.map((o) => ({ text: o.text, isCorrect: o.is_correct }))
      : blankOptions(),
  )
  const [tf, setTf] = useState<boolean>(question?.type === 'true_false' ? (question.options.find((o) => o.text === 'True')?.is_correct ?? true) : true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isMcq = type === 'mcq_single' || type === 'mcq_multi'

  const changeType = (next: QuestionKind) => {
    setType(next)
    // switching between single/multi: keep only the first correct option for single
    if (next === 'mcq_single') {
      let seen = false
      setOptions((prev) => prev.map((o) => (o.isCorrect && !seen ? ((seen = true), o) : { ...o, isCorrect: false })))
    }
  }

  const setCorrect = (i: number, value: boolean) =>
    setOptions((prev) => prev.map((o, idx) => (type === 'mcq_single' ? { ...o, isCorrect: idx === i } : idx === i ? { ...o, isCorrect: value } : o)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      quizId,
      id: question?.id,
      type,
      prompt,
      marks: Number(marks),
      options: isMcq ? options : [],
      trueFalseAnswer: type === 'true_false' ? tf : undefined,
    }
    const check = questionSchema.safeParse(payload)
    if (!check.success) {
      const next: Record<string, string> = {}
      for (const issue of check.error.issues) next[String(issue.path[0])] ??= issue.message
      return setErrors(next)
    }
    setErrors({})
    run(() => saveQuestion(payload), {
      success: question ? 'Question updated' : 'Question added',
      onSuccess: () => {
        onOpenChange(false)
        router.refresh()
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{question ? 'Edit question' : 'Add question'}</DialogTitle>
          <DialogDescription>Students never receive the correct answers while the quiz is open.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field label="Type" htmlFor="qe-type">
                <Select id="qe-type" value={type} onChange={(e) => changeType(e.target.value as QuestionKind)}>
                  {QUESTION_TYPES.map((t) => (
                    <option key={t} value={t}>{QUESTION_LABELS[t]}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Marks" htmlFor="qe-marks" error={errors.marks}>
                <Input id="qe-marks" type="number" inputMode="decimal" min={0} step="0.5" value={marks} onChange={(e) => setMarks(e.target.value)} aria-invalid={!!errors.marks} />
              </Field>
            </div>

            <Field label="Question" htmlFor="qe-prompt" required error={errors.prompt}>
              <Textarea id="qe-prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-invalid={!!errors.prompt} />
            </Field>

            {isMcq && (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">
                  Options <span className="font-normal text-muted-foreground">({type === 'mcq_single' ? 'select the one correct answer' : 'tick every correct answer'})</span>
                </legend>
                {options.map((o, i) => (
                  <div key={i} className={cn('flex items-center gap-2 rounded-xl border bg-card p-2 pl-3 transition-colors', o.isCorrect && 'border-success/50 bg-success-soft/40')}>
                    {type === 'mcq_single' ? (
                      <input type="radio" name="correct" checked={o.isCorrect} onChange={() => setCorrect(i, true)} aria-label={`Option ${i + 1} is correct`} className="size-4.5 accent-[var(--success)]" />
                    ) : (
                      <Checkbox checked={o.isCorrect} onChange={(e) => setCorrect(i, e.target.checked)} aria-label={`Option ${i + 1} is correct`} />
                    )}
                    <Input
                      aria-label={`Option ${i + 1} text`}
                      placeholder={`Option ${i + 1}`}
                      value={o.text}
                      onChange={(e) => setOptions((prev) => prev.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    />
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove option ${i + 1}`} disabled={options.length <= 2} onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}>
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                {errors.options && <p role="alert" className="text-[0.8125rem] text-danger">{errors.options}</p>}
                {options.length < 8 && (
                  <Button type="button" variant="soft" size="sm" onClick={() => setOptions((prev) => [...prev, { text: '', isCorrect: false }])}>
                    <Plus /> Add option
                  </Button>
                )}
              </fieldset>
            )}

            {type === 'true_false' && (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">Correct answer</legend>
                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map((v) => (
                    <label key={String(v)} className={cn('flex cursor-pointer items-center justify-center gap-2 rounded-xl border bg-card py-3 text-sm font-medium transition-colors', tf === v && 'border-success/60 bg-success-soft/50 text-success')}>
                      <input type="radio" name="tf" className="sr-only" checked={tf === v} onChange={() => setTf(v)} />
                      {v ? 'True' : 'False'}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {type === 'short_answer' && (
              <p className="rounded-xl bg-info-soft px-4 py-3 text-sm text-info">Short answers are not auto-graded. You award marks from 0 to this question&apos;s marks after students submit.</p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" loading={pending}>{question ? 'Save question' : 'Add question'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
