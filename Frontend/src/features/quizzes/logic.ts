import type { QuestionKind } from './schemas'

/* ------------------------- validation before publish ------------------------- */

export type QuestionForValidation = {
  position: number
  type: QuestionKind
  prompt: string
  options: { is_correct: boolean }[]
}

/**
 * Spec Feature 5, req. 2: at least 1 question; every MCQ has >= 2 options and >= 1 correct;
 * mcq_single has exactly 1 correct; true/false has its two options with exactly 1 correct;
 * closes_at > opens_at. Returns human-readable problems (empty = publishable).
 */
export function validateForPublish(
  quiz: { opens_at: string; closes_at: string },
  questions: QuestionForValidation[],
): string[] {
  const problems: string[] = []
  if (questions.length === 0) problems.push('Add at least one question.')
  if (new Date(quiz.closes_at) <= new Date(quiz.opens_at)) problems.push('The closing time must be after the opening time.')

  for (const q of [...questions].sort((a, b) => a.position - b.position)) {
    const label = `Question ${q.position}`
    const correct = q.options.filter((o) => o.is_correct).length
    if (!q.prompt.trim()) problems.push(`${label} has no text.`)
    if (q.type === 'mcq_single' || q.type === 'mcq_multi') {
      if (q.options.length < 2) problems.push(`${label} needs at least 2 options.`)
      if (correct < 1) problems.push(`${label} needs at least one correct option.`)
      if (q.type === 'mcq_single' && correct > 1) problems.push(`${label} must have exactly one correct option.`)
    }
    if (q.type === 'true_false' && (q.options.length !== 2 || correct !== 1)) {
      problems.push(`${label} needs True and False options with one marked correct.`)
    }
  }
  return problems
}

export const totalMarks = (questions: { marks: number }[]) => questions.reduce((sum, q) => sum + Number(q.marks), 0)

/* ------------------------------ student list state ------------------------------ */

export type QuizState = 'upcoming' | 'open' | 'in_progress' | 'submitted' | 'closed'

type QuizWindow = { opens_at: string; closes_at: string; max_attempts: number }
type AttemptLite = { status: 'in_progress' | 'submitted' | 'graded'; started_at: string }

/**
 * Upcoming / Open / In progress / Submitted / Closed (spec Feature 5, req. 4).
 * The Start button shows only inside the window while attempts remain.
 */
export function quizState(quiz: QuizWindow, attempts: AttemptLite[], now = Date.now()): { state: QuizState; canStart: boolean; attemptsLeft: number } {
  const opens = new Date(quiz.opens_at).getTime()
  const closes = new Date(quiz.closes_at).getTime()
  const finished = attempts.filter((a) => a.status !== 'in_progress').length
  const attemptsLeft = Math.max(0, quiz.max_attempts - attempts.length)
  const inWindow = now >= opens && now < closes

  if (attempts.some((a) => a.status === 'in_progress') && inWindow) return { state: 'in_progress', canStart: true, attemptsLeft }
  if (now < opens) return { state: 'upcoming', canStart: false, attemptsLeft }
  if (inWindow && attemptsLeft > 0) return { state: 'open', canStart: true, attemptsLeft }
  if (finished > 0) return { state: 'submitted', canStart: false, attemptsLeft }
  return { state: 'closed', canStart: false, attemptsLeft }
}
