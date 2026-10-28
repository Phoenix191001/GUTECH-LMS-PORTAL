'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Check, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/form'
import { useAction } from '@/hooks/use-action'
import { gradeShortAnswer } from '../actions'

/** One short-answer response: shows the text and lets the teacher award 0..max marks. */
export function ShortAnswerGrader({
  answerId,
  studentName,
  text,
  maxMarks,
  initial,
}: {
  answerId: string
  studentName: string
  text: string | null
  maxMarks: number
  initial: number | null
}) {
  const router = useRouter()
  const { pending, run } = useAction()
  const [marks, setMarks] = useState(initial === null ? '' : String(initial))
  const [error, setError] = useState<string>()
  const id = `marks-${answerId}`

  const save = () => {
    const n = Number(marks)
    if (marks.trim() === '' || Number.isNaN(n) || n < 0 || n > maxMarks) return setError(`Enter 0 to ${maxMarks}`)
    setError(undefined)
    run(() => gradeShortAnswer({ answerId, marks: n }), { success: 'Marks saved', onSuccess: () => router.refresh(), onError: setError })
  }

  return (
    <li className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)]">
      <p className="text-sm font-semibold">{studentName}</p>
      <p className="mt-2 whitespace-pre-wrap rounded-xl bg-muted/50 p-3.5 text-sm">{text?.trim() || <span className="text-muted-foreground">No answer</span>}</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor={id} className="text-xs font-medium text-muted-foreground">Marks (max {maxMarks})</label>
          <Input id={id} type="number" inputMode="decimal" min={0} max={maxMarks} step="0.5" value={marks} onChange={(e) => setMarks(e.target.value)} aria-invalid={!!error} className="w-28" />
        </div>
        <Button size="md" variant={initial === null ? 'default' : 'outline'} onClick={save} loading={pending}>
          {initial === null ? <Save /> : <Check />} {initial === null ? 'Save' : 'Update'}
        </Button>
        {error && <p role="alert" className="pb-2.5 text-[0.8125rem] text-danger">{error}</p>}
      </div>
    </li>
  )
}
