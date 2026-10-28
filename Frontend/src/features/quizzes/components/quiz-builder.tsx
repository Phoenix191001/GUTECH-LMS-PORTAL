'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { ArrowDown, ArrowUp, BarChart3, CheckCircle2, Circle, Copy, CopyPlus, Eye, EyeOff, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Card } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { EmptyState, Notice } from '@/components/ui/feedback'
import { useAction } from '@/hooks/use-action'
import { cn, num } from '@/lib/utils'
import { copyQuiz, deleteQuestion, deleteQuiz, duplicateQuestion, publishQuiz, reorderQuestions } from '../actions'
import { totalMarks, validateForPublish } from '../logic'
import { QUESTION_LABELS } from '../schemas'
import { QuestionEditor, type BuilderQuestion } from './question-editor'

type Quiz = { id: string; course_id: string; title: string; is_published: boolean; opens_at: string; closes_at: string }

/**
 * Question list + publish controls. Reordering uses up/down buttons (keyboard and touch
 * friendly, no extra drag library); the order is saved atomically in Postgres.
 */
export function QuizBuilder({ quiz, questions, hasAttempts }: { quiz: Quiz; questions: BuilderQuestion[]; hasAttempts: boolean }) {
  const router = useRouter()
  const { pending, run } = useAction()
  const [editor, setEditor] = useState<{ open: boolean; question: BuilderQuestion | null; nonce: number }>({ open: false, question: null, nonce: 0 })

  const locked = hasAttempts
  const total = totalMarks(questions)
  const problems = validateForPublish(
    quiz,
    questions.map((q) => ({ position: q.position, type: q.type, prompt: q.prompt, options: q.options })),
  )

  const move = (index: number, dir: -1 | 1) => {
    const ids = questions.map((q) => q.id)
    const target = index + dir
    if (target < 0 || target >= ids.length) return
    ;[ids[index], ids[target]] = [ids[target]!, ids[index]!]
    run(() => reorderQuestions({ quizId: quiz.id, orderedIds: ids }), { onSuccess: () => router.refresh() })
  }

  const base = `/courses/${quiz.course_id}/quizzes/${quiz.id}`

  return (
    <div className="space-y-6">
      {locked && (
        <Notice tone="warning" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2">
            <Lock className="mt-0.5 size-4 shrink-0" />
            This quiz already has attempts, so its questions are locked to keep marks fair. Unpublish it to hide it, or create an editable copy.
          </span>
          <Button
            size="sm"
            variant="outline"
            loading={pending}
            onClick={() => run(() => copyQuiz(quiz.id), { success: 'Copy created', onSuccess: (d) => router.push(`/courses/${quiz.course_id}/quizzes/${d.id}/edit`) })}
          >
            <CopyPlus /> Create a copy
          </Button>
        </Notice>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total marks</p>
            <p className="font-display text-2xl font-semibold" aria-live="polite">{num(total)}</p>
          </div>
          <div className="h-9 w-px bg-border" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Questions</p>
            <p className="font-display text-2xl font-semibold">{questions.length}</p>
          </div>
          <Badge tone={quiz.is_published ? 'success' : 'neutral'}>{quiz.is_published ? 'Published' : 'Draft'}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`${base}/results`} className={buttonVariants({ variant: 'outline' })}>
            <BarChart3 /> Results
          </Link>
          <Button
            variant={quiz.is_published ? 'outline' : 'default'}
            loading={pending}
            onClick={() =>
              run(() => publishQuiz(quiz.id, !quiz.is_published), {
                success: quiz.is_published ? 'Unpublished. Students can no longer see it.' : 'Quiz published',
                onSuccess: () => router.refresh(),
              })
            }
          >
            {quiz.is_published ? <EyeOff /> : <Eye />} {quiz.is_published ? 'Unpublish' : 'Publish'}
          </Button>
          <ConfirmDialog
            trigger={<Button variant="outline" className="text-danger hover:bg-danger-soft"><Trash2 /> Delete</Button>}
            title="Delete this quiz?"
            description="The quiz, its questions, every attempt and all marks from it will be permanently removed."
            requireText={hasAttempts ? quiz.title : undefined}
            confirmLabel="Delete quiz"
            onConfirm={async () => {
              const res = await deleteQuiz(quiz.id)
              if (res.ok) {
                toast.success('Quiz deleted')
                router.replace(`/courses/${quiz.course_id}/quizzes`)
                router.refresh()
              } else toast.error(res.error)
            }}
          />
        </div>
      </div>

      {!quiz.is_published && problems.length > 0 && questions.length > 0 && (
        <Notice tone="info">
          <p className="mb-1 font-medium">Before you can publish:</p>
          <ul className="list-disc space-y-0.5 pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </Notice>
      )}

      {questions.length === 0 ? (
        <EmptyState
          title="No questions yet"
          description="Add multiple choice, true/false or short answer questions."
          action={!locked && <Button onClick={() => setEditor((e) => ({ open: true, question: null, nonce: e.nonce + 1 }))}><Plus /> Add question</Button>}
        />
      ) : (
        <ol className="space-y-3">
          {questions.map((q, i) => (
            <li key={q.id}>
              <Card className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-sm font-semibold text-primary-soft-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone="info">{QUESTION_LABELS[q.type]}</Badge>
                      <Badge>{num(q.marks)} mark{Number(q.marks) === 1 ? '' : 's'}</Badge>
                    </div>
                    <p className="whitespace-pre-wrap text-[0.9375rem] font-medium">{q.prompt}</p>
                    {q.options.length > 0 && (
                      <ul className="mt-3 space-y-1.5">
                        {q.options.map((o) => (
                          <li key={o.id} className={cn('flex items-start gap-2 text-sm', o.is_correct ? 'font-medium text-success' : 'text-muted-foreground')}>
                            {o.is_correct ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <Circle className="mt-0.5 size-4 shrink-0" />}
                            <span>{o.text}</span>
                            {o.is_correct && <span className="sr-only">(correct)</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                {!locked && (
                  <div className="mt-4 flex flex-wrap items-center gap-1 border-t pt-3">
                    <Button variant="ghost" size="icon-sm" aria-label={`Move question ${i + 1} up`} disabled={i === 0 || pending} onClick={() => move(i, -1)}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Move question ${i + 1} down`} disabled={i === questions.length - 1 || pending} onClick={() => move(i, 1)}><ArrowDown /></Button>
                    <span className="flex-1" />
                    <Button variant="ghost" size="sm" onClick={() => setEditor((e) => ({ open: true, question: q, nonce: e.nonce + 1 }))}><Pencil /> Edit</Button>
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => duplicateQuestion(q.id), { success: 'Question duplicated', onSuccess: () => router.refresh() })}><Copy /> Duplicate</Button>
                    <ConfirmDialog
                      trigger={<Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft"><Trash2 /> Delete</Button>}
                      title={`Delete question ${i + 1}?`}
                      description="This cannot be undone."
                      confirmLabel="Delete question"
                      onConfirm={async () => {
                        const res = await deleteQuestion(q.id)
                        if (res.ok) {
                          toast.success('Question deleted')
                          router.refresh()
                        } else toast.error(res.error)
                      }}
                    />
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ol>
      )}

      {!locked && questions.length > 0 && (
        <Button variant="soft" size="lg" className="w-full" onClick={() => setEditor((e) => ({ open: true, question: null, nonce: e.nonce + 1 }))}>
          <Plus /> Add question
        </Button>
      )}

      {editor.open && (
        <QuestionEditor key={editor.nonce} quizId={quiz.id} question={editor.question} open={editor.open} onOpenChange={(open) => setEditor((e) => ({ ...e, open }))} />
      )}
    </div>
  )
}
