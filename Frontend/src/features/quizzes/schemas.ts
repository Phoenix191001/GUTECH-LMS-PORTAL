import { z } from 'zod'

const title = z.string().trim().min(2, 'Enter a title').max(150, 'Keep the title under 150 characters')
const iso = z.iso.datetime({ offset: true, error: 'Choose a date and time' })

export const QUESTION_TYPES = ['mcq_single', 'mcq_multi', 'true_false', 'short_answer'] as const
export type QuestionKind = (typeof QUESTION_TYPES)[number]

export const QUESTION_LABELS: Record<QuestionKind, string> = {
  mcq_single: 'Multiple choice (one answer)',
  mcq_multi: 'Multiple choice (several answers)',
  true_false: 'True / False',
  short_answer: 'Short answer (graded by hand)',
}

export const quizSettingsSchema = z
  .object({
    title,
    description: z.string().trim().max(2000, 'Description is too long').optional(),
    durationMinutes: z.number({ error: 'Enter minutes' }).int('Whole minutes only').min(1, 'At least 1 minute').max(600, 'At most 600 minutes'),
    opensAt: iso,
    closesAt: iso,
    maxAttempts: z.number({ error: 'Enter a number' }).int().min(1, 'At least 1').max(20, 'At most 20'),
    shuffleQuestions: z.boolean(),
    showAnswersAfterClose: z.boolean(),
  })
  .refine((v) => new Date(v.closesAt) > new Date(v.opensAt), { path: ['closesAt'], message: 'Closing time must be after the opening time' })

export const createQuizSchema = quizSettingsSchema.safeExtend({ courseId: z.uuid() })
export type CreateQuizInput = z.input<typeof createQuizSchema>

export const updateQuizSchema = quizSettingsSchema.safeExtend({ id: z.uuid() })
export type UpdateQuizInput = z.input<typeof updateQuizSchema>

const optionSchema = z.object({
  text: z.string().trim().min(1, 'Option text is required').max(500, 'Option is too long'),
  isCorrect: z.boolean(),
})

/**
 * Rules per type (also re-checked before publishing):
 *  - mcq_single: 2-8 options, exactly 1 correct
 *  - mcq_multi: 2-8 options, at least 1 correct
 *  - true_false: two fixed options (True/False), the correct one is chosen via `trueFalseAnswer`
 *  - short_answer: no options
 */
export const questionSchema = z
  .object({
    quizId: z.uuid(),
    id: z.uuid().optional(),
    type: z.enum(QUESTION_TYPES),
    prompt: z.string().trim().min(1, 'Write the question').max(2000, 'Question is too long'),
    marks: z.number({ error: 'Enter marks' }).min(0, 'Marks cannot be negative').max(100, 'At most 100 marks per question'),
    options: z.array(optionSchema).max(8, 'At most 8 options').default([]),
    trueFalseAnswer: z.boolean().optional(),
  })
  .superRefine((q, ctx) => {
    const correct = q.options.filter((o) => o.isCorrect).length
    if (q.type === 'mcq_single' || q.type === 'mcq_multi') {
      if (q.options.length < 2) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least 2 options' })
      else if (correct < 1) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Mark at least one correct option' })
      else if (q.type === 'mcq_single' && correct !== 1) ctx.addIssue({ code: 'custom', path: ['options'], message: 'Choose exactly one correct option' })
    }
    if (q.type === 'true_false' && q.trueFalseAnswer === undefined) {
      ctx.addIssue({ code: 'custom', path: ['trueFalseAnswer'], message: 'Choose the correct answer' })
    }
  })
export type QuestionInput = z.input<typeof questionSchema>

export const reorderSchema = z.object({ quizId: z.uuid(), orderedIds: z.array(z.uuid()).min(1).max(200) })

export const saveAnswerSchema = z.object({
  attemptId: z.uuid(),
  questionId: z.uuid(),
  optionIds: z.array(z.uuid()).max(8),
  text: z.string().max(5000).nullable().optional(),
})
export type SaveAnswerInput = z.input<typeof saveAnswerSchema>

export const gradeShortAnswerSchema = z.object({ answerId: z.uuid(), marks: z.number({ error: 'Enter marks' }).min(0, 'Marks cannot be negative').max(100) })

/** Client settings form (string inputs). */
export const quizFormSchema = z.object({
  title,
  description: z.string().max(2000),
  durationMinutes: z.string().min(1, 'Enter the time limit'),
  opensAt: z.string().min(1, 'Choose when it opens'),
  closesAt: z.string().min(1, 'Choose when it closes'),
  maxAttempts: z.string().min(1, 'Enter the number of attempts'),
  shuffleQuestions: z.boolean(),
  showAnswersAfterClose: z.boolean(),
})
export type QuizFormValues = z.infer<typeof quizFormSchema>

/* ---------- what get_attempt_questions / get_attempt_review return ---------- */

export const attemptPayloadSchema = z.discriminatedUnion('finished', [
  z.object({ finished: z.literal(true), attempt_id: z.string(), quiz_id: z.string() }),
  z.object({
    finished: z.literal(false),
    attempt_id: z.string(),
    quiz: z.object({ id: z.string(), title: z.string(), description: z.string().nullable(), course_id: z.string() }),
    expires_at: z.string(),
    server_now: z.string(),
    questions: z.array(
      z.object({
        id: z.string(),
        position: z.number(),
        type: z.enum(QUESTION_TYPES),
        prompt: z.string(),
        marks: z.number(),
        // NOTE: no is_correct here, by design. The database never sends it while an attempt is open.
        options: z.array(z.object({ id: z.string(), text: z.string() })),
      }),
    ),
    answers: z.array(z.object({ question_id: z.string(), selected_option_ids: z.array(z.string()), text_answer: z.string().nullable() })),
  }),
])
export type AttemptPayload = Extract<z.infer<typeof attemptPayloadSchema>, { finished: false }>

export const reviewPayloadSchema = z.object({
  attempt: z.object({ id: z.string(), status: z.enum(['in_progress', 'submitted', 'graded']), score: z.number().nullable(), started_at: z.string(), submitted_at: z.string().nullable() }),
  quiz: z.object({ id: z.string(), title: z.string(), course_id: z.string(), closes_at: z.string(), max_marks: z.number() }),
  review_allowed: z.boolean(),
  questions: z.array(
    z.object({
      id: z.string(),
      position: z.number(),
      type: z.enum(QUESTION_TYPES),
      prompt: z.string(),
      marks: z.number(),
      options: z.array(z.object({ id: z.string(), text: z.string(), is_correct: z.boolean() })),
      selected_option_ids: z.array(z.string()),
      text_answer: z.string().nullable(),
      marks_awarded: z.number().nullable(),
    }),
  ),
})
export type ReviewPayload = z.infer<typeof reviewPayloadSchema>
