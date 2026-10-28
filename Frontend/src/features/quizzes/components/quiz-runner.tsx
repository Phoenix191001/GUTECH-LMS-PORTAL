'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, ChevronLeft, ChevronRight, Cloud, CloudOff, Grid3x3, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/form'
import { Countdown } from '@/components/shared/local-time'
import { cn, num } from '@/lib/utils'
import { saveAnswer, submitAttempt } from '../actions'
import type { AttemptPayload } from '../schemas'

type AnswerState = { optionIds: string[]; text: string }
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

/**
 * Timed quiz runner.
 * - The countdown comes from the server's expires_at, so a refresh never resets it.
 * - Answers autosave on every option change and shortly after typing stops.
 * - The server rejects saves after expiry and scores only what was saved before it.
 * - Question data contains NO correct-answer flags (the database never sends them).
 */
export function QuizRunner({ payload, courseId }: { payload: AttemptPayload; courseId: string }) {
  const router = useRouter()
  const { questions } = payload
  const quizId = payload.quiz.id
  const resultHref = `/courses/${courseId}/quizzes/${quizId}/result/${payload.attempt_id}`

  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() => {
    const initial: Record<string, AnswerState> = {}
    for (const q of questions) initial[q.id] = { optionIds: [], text: '' }
    for (const a of payload.answers) initial[a.question_id] = { optionIds: a.selected_option_ids, text: a.text_answer ?? '' }
    return initial
  })
  const [index, setIndex] = useState(0)
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const answersRef = useRef(answers)
  const dirty = useRef(new Set<string>())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const chain = useRef<Promise<void>>(Promise.resolve())
  const done = useRef(false)

  const goToResult = useCallback(() => {
    if (done.current) return
    done.current = true
    setFinishing(true)
    router.replace(resultHref)
    router.refresh()
  }, [router, resultHref])

  /** Saves the latest value of one question. Calls are chained so they reach the server in order. */
  const persist = useCallback(
    (qid: string) => {
      dirty.current.add(qid)
      chain.current = chain.current.then(async () => {
        if (done.current || !dirty.current.has(qid)) return
        dirty.current.delete(qid)
        const a = answersRef.current[qid]
        if (!a) return
        setStatus('saving')
        const res = await saveAnswer({ attemptId: payload.attempt_id, questionId: qid, optionIds: a.optionIds, text: a.text || null })
        if (!res.ok) {
          dirty.current.add(qid)
          setStatus('error')
          return
        }
        if (!res.data.saved) {
          toast.info('Time is up. Your saved answers were submitted.')
          goToResult()
          return
        }
        setStatus(dirty.current.size === 0 ? 'saved' : 'saving')
      })
      return chain.current
    },
    [payload.attempt_id, goToResult],
  )

  const flush = useCallback(async () => {
    for (const [qid, t] of timers.current) {
      clearTimeout(t)
      timers.current.delete(qid)
      dirty.current.add(qid)
    }
    await Promise.all([...dirty.current].map((qid) => persist(qid)))
    await chain.current
  }, [persist])

  useEffect(() => {
    const map = timers.current
    return () => map.forEach((t) => clearTimeout(t))
  }, [])

  const update = (qid: string, next: AnswerState, immediate: boolean) => {
    const merged = { ...answersRef.current, [qid]: next }
    answersRef.current = merged
    setAnswers(merged)
    setStatus('saving')
    const existing = timers.current.get(qid)
    if (existing) clearTimeout(existing)
    if (immediate) {
      timers.current.delete(qid)
      void persist(qid)
    } else {
      timers.current.set(
        qid,
        setTimeout(() => {
          timers.current.delete(qid)
          void persist(qid)
        }, 1200),
      )
    }
  }

  const q = questions[index]!
  const a = answers[q.id] ?? { optionIds: [], text: '' }
  const isAnswered = (qid: string) => {
    const x = answers[qid]
    return !!x && (x.optionIds.length > 0 || x.text.trim().length > 0)
  }
  const unanswered = useMemo(() => questions.filter((x) => !isAnswered(x.id)).length, [questions, answers]) // eslint-disable-line react-hooks/exhaustive-deps
  const answeredCount = questions.length - unanswered

  const toggleOption = (optionId: string) => {
    const multi = q.type === 'mcq_multi'
    const next = multi ? (a.optionIds.includes(optionId) ? a.optionIds.filter((id) => id !== optionId) : [...a.optionIds, optionId]) : [optionId]
    update(q.id, { ...a, optionIds: next }, true)
  }

  const go = async (to: number) => {
    await flush() // save before moving on
    setIndex(Math.max(0, Math.min(questions.length - 1, to)))
    setPaletteOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const finish = async () => {
    setFinishing(true)
    await flush()
    const res = await submitAttempt(payload.attempt_id)
    if (!res.ok) {
      setFinishing(false)
      toast.error(res.error)
      return
    }
    goToResult()
  }

  const onElapsed = useCallback(async () => {
    if (done.current) return
    toast.info('Time is up. Submitting your quiz…')
    await submitAttempt(payload.attempt_id) // server scores only answers saved before expiry
    goToResult()
  }, [payload.attempt_id, goToResult])

  const palette = (
    <ol className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
      {questions.map((x, i) => (
        <li key={x.id}>
          <button
            type="button"
            onClick={() => go(i)}
            aria-label={`Question ${i + 1}, ${isAnswered(x.id) ? 'answered' : 'not answered'}${i === index ? ', current' : ''}`}
            aria-current={i === index ? 'step' : undefined}
            className={cn(
              'grid aspect-square w-full place-items-center rounded-xl border text-sm font-semibold transition-colors',
              i === index ? 'border-primary bg-primary text-primary-foreground shadow-[var(--shadow-glow)]' : isAnswered(x.id) ? 'border-success/40 bg-success-soft text-success' : 'bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            {i + 1}
          </button>
        </li>
      ))}
    </ol>
  )

  const SaveIcon = status === 'saving' ? Loader2 : status === 'error' ? CloudOff : status === 'saved' ? Check : Cloud

  return (
    <div className="-mx-4 -mt-6 sm:mx-0 sm:mt-0">
      {/* Sticky status bar */}
      <div className="glass sticky top-16 z-10 border-b px-4 py-3 sm:rounded-2xl sm:border">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{payload.quiz.title}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
              <SaveIcon className={cn('size-3.5', status === 'saving' && 'animate-spin', status === 'error' && 'text-danger')} />
              {status === 'saving' ? 'Saving…' : status === 'error' ? 'Not saved. Retrying…' : status === 'saved' ? 'All answers saved' : `${answeredCount} of ${questions.length} answered`}
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-1.5 text-primary-soft-foreground">
            <Countdown targetIso={payload.expires_at} serverNow={payload.server_now} onElapsed={onElapsed} className="font-mono text-lg font-semibold tabular-nums" />
          </div>
        </div>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(answeredCount / questions.length) * 100}%` }} />
        </div>
      </div>

      <div className="grid gap-6 px-4 pt-5 sm:px-0 lg:grid-cols-[1fr_16rem]">
        <section aria-labelledby="question-h" className="min-w-0 pb-28 lg:pb-6">
          <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p id="question-h" className="text-sm font-semibold text-primary">Question {index + 1} of {questions.length}</p>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{num(q.marks)} mark{Number(q.marks) === 1 ? '' : 's'}</span>
            </div>
            <p className="whitespace-pre-wrap text-lg font-medium leading-relaxed">{q.prompt}</p>
            {q.type === 'mcq_multi' && <p className="mt-2 text-sm text-muted-foreground">Select all that apply.</p>}

            <div className="mt-6">
              {q.type === 'short_answer' ? (
                <div className="space-y-1.5">
                  <label htmlFor="sa" className="text-sm font-medium">Your answer</label>
                  <Textarea
                    id="sa"
                    rows={8}
                    value={a.text}
                    maxLength={5000}
                    onChange={(e) => update(q.id, { ...a, text: e.target.value }, false)}
                    onBlur={() => void flush()}
                  />
                </div>
              ) : (
                <fieldset>
                  <legend className="sr-only">Answer options</legend>
                  <div className="space-y-2.5">
                    {q.options.map((o) => {
                      const selected = a.optionIds.includes(o.id)
                      return (
                        <label
                          key={o.id}
                          className={cn(
                            'flex min-h-14 cursor-pointer items-center gap-3.5 rounded-xl border-2 bg-card px-4 py-3 transition-all active:scale-[0.99]',
                            selected ? 'border-primary bg-primary-soft/60 shadow-[var(--shadow-soft)]' : 'border-border hover:border-primary/40 hover:bg-muted/40',
                          )}
                        >
                          <input
                            type={q.type === 'mcq_multi' ? 'checkbox' : 'radio'}
                            name={`q-${q.id}`}
                            checked={selected}
                            onChange={() => toggleOption(o.id)}
                            className="size-5 shrink-0 accent-[var(--primary)]"
                          />
                          <span className="text-[0.9375rem]">{o.text}</span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              )}
            </div>
          </div>
        </section>

        {/* Desktop palette */}
        <aside className="hidden lg:block" aria-label="Question palette">
          <div className="sticky top-44 space-y-4 rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)]">
            <h3 className="font-display text-base font-semibold">Questions</h3>
            {palette}
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><span className="size-3 rounded border border-success/40 bg-success-soft" /> Answered</li>
              <li className="flex items-center gap-2"><span className="size-3 rounded border bg-card" /> Not answered</li>
            </ul>
            <SubmitButton unanswered={unanswered} busy={finishing} onConfirm={finish} className="w-full" />
          </div>
        </aside>
      </div>

      {/* Phone bottom bar */}
      <div className="glass pb-safe fixed inset-x-0 bottom-0 z-20 border-t px-4 py-3 lg:static lg:mt-2 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-6xl items-center gap-2 lg:max-w-none lg:justify-between lg:px-0">
          <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0 || finishing}>
            <ChevronLeft /> <span className="hidden sm:inline">Previous</span>
          </Button>
          <Button variant="outline" className="lg:hidden" onClick={() => setPaletteOpen(true)} aria-label="Open question palette">
            <Grid3x3 /> {answeredCount}/{questions.length}
          </Button>
          <span className="flex-1 lg:hidden" />
          {index < questions.length - 1 ? (
            <Button onClick={() => go(index + 1)} disabled={finishing}>
              Next <ChevronRight />
            </Button>
          ) : (
            <SubmitButton unanswered={unanswered} busy={finishing} onConfirm={finish} className="lg:hidden" />
          )}
        </div>
      </div>

      <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Questions</DialogTitle>
            <DialogDescription>{answeredCount} of {questions.length} answered</DialogDescription>
          </DialogHeader>
          <DialogBody>{palette}</DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SubmitButton({ unanswered, busy, onConfirm, className }: { unanswered: number; busy: boolean; onConfirm: () => Promise<void>; className?: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button className={className} loading={busy}>
          <Send /> Submit quiz
        </Button>
      }
      destructive={false}
      title="Submit your quiz?"
      description={
        <span className="flex items-start gap-2">
          {unanswered > 0 && <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />}
          <span>{unanswered > 0 ? `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. You cannot change your answers after submitting.` : 'You have answered every question. You cannot change your answers after submitting.'}</span>
        </span>
      }
      confirmLabel="Submit now"
      onConfirm={onConfirm}
    />
  )
}
