import { describe, expect, it } from 'vitest'
import { quizState, totalMarks, validateForPublish } from './logic'
import { questionSchema, quizSettingsSchema } from './schemas'

const window = { opens_at: '2026-01-01T10:00:00Z', closes_at: '2026-01-01T12:00:00Z' }
const q = (over: Partial<Parameters<typeof validateForPublish>[1][number]> = {}) => ({
  position: 1,
  type: 'mcq_single' as const,
  prompt: 'What?',
  options: [{ is_correct: true }, { is_correct: false }],
  ...over,
})

describe('validateForPublish', () => {
  it('accepts a valid quiz', () => {
    expect(validateForPublish(window, [q(), q({ position: 2, type: 'short_answer', options: [] })])).toEqual([])
  })
  it('requires at least one question', () => {
    expect(validateForPublish(window, [])).toContain('Add at least one question.')
  })
  it('requires closes_at after opens_at', () => {
    const bad = { opens_at: window.closes_at, closes_at: window.opens_at }
    expect(validateForPublish(bad, [q()]).join()).toMatch(/closing time/)
  })
  it('rejects an MCQ with fewer than two options or no correct option', () => {
    expect(validateForPublish(window, [q({ options: [{ is_correct: true }] })]).join()).toMatch(/at least 2 options/)
    expect(validateForPublish(window, [q({ options: [{ is_correct: false }, { is_correct: false }] })]).join()).toMatch(/correct option/)
  })
  it('requires exactly one correct option for mcq_single, but not mcq_multi', () => {
    const two = [{ is_correct: true }, { is_correct: true }]
    expect(validateForPublish(window, [q({ options: two })]).join()).toMatch(/exactly one/)
    expect(validateForPublish(window, [q({ type: 'mcq_multi', options: two })])).toEqual([])
  })
})

describe('questionSchema', () => {
  const base = { quizId: crypto.randomUUID(), prompt: 'Q', marks: 1 }
  it('mcq_single needs exactly one correct option', () => {
    const r = questionSchema.safeParse({ ...base, type: 'mcq_single', options: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: true }] })
    expect(r.success).toBe(false)
  })
  it('true_false needs an answer; short_answer needs no options', () => {
    expect(questionSchema.safeParse({ ...base, type: 'true_false' }).success).toBe(false)
    expect(questionSchema.safeParse({ ...base, type: 'true_false', trueFalseAnswer: false }).success).toBe(true)
    expect(questionSchema.safeParse({ ...base, type: 'short_answer' }).success).toBe(true)
  })
})

describe('quizSettingsSchema', () => {
  it('rejects closing before opening', () => {
    const r = quizSettingsSchema.safeParse({
      title: 'Quiz',
      durationMinutes: 30,
      opensAt: '2026-01-02T00:00:00Z',
      closesAt: '2026-01-01T00:00:00Z',
      maxAttempts: 1,
      shuffleQuestions: false,
      showAnswersAfterClose: true,
    })
    expect(r.success).toBe(false)
  })
})

describe('quizState', () => {
  const quiz = { ...window, max_attempts: 2 }
  const at = (iso: string) => new Date(iso).getTime()

  it('is upcoming before the window', () => {
    expect(quizState(quiz, [], at('2026-01-01T09:00:00Z'))).toMatchObject({ state: 'upcoming', canStart: false })
  })
  it('is open inside the window with attempts left', () => {
    expect(quizState(quiz, [], at('2026-01-01T11:00:00Z'))).toMatchObject({ state: 'open', canStart: true, attemptsLeft: 2 })
  })
  it('resumes an in-progress attempt', () => {
    const r = quizState(quiz, [{ status: 'in_progress', started_at: window.opens_at }], at('2026-01-01T11:00:00Z'))
    expect(r).toMatchObject({ state: 'in_progress', canStart: true })
  })
  it('shows submitted but not startable when no attempts remain', () => {
    const r = quizState({ ...quiz, max_attempts: 1 }, [{ status: 'graded', started_at: window.opens_at }], at('2026-01-01T11:00:00Z'))
    expect(r).toMatchObject({ state: 'submitted', canStart: false })
  })
  it('is closed after the window if nothing was submitted', () => {
    expect(quizState(quiz, [], at('2026-01-01T13:00:00Z'))).toMatchObject({ state: 'closed', canStart: false })
  })
})

describe('totalMarks', () => {
  it('sums question marks', () => expect(totalMarks([{ marks: 1.5 }, { marks: 2 }])).toBe(3.5))
})
