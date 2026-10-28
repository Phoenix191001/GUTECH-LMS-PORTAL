'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ActionError, authedAction, dbError, parse, unwrap, unwrapList } from '@/lib/actions'
import { requireCourseManager } from '@/features/shared/guards'
import { validateForPublish } from './logic'
import {
  createQuizSchema,
  gradeShortAnswerSchema,
  questionSchema,
  reorderSchema,
  saveAnswerSchema,
  updateQuizSchema,
  type CreateQuizInput,
  type QuestionInput,
  type SaveAnswerInput,
  type UpdateQuizInput,
} from './schemas'

const idSchema = z.uuid()

const refresh = (courseId: string, quizId?: string) => {
  revalidatePath(`/courses/${courseId}/quizzes`)
  if (quizId) revalidatePath(`/courses/${courseId}/quizzes/${quizId}`, 'layout')
  revalidatePath(`/courses/${courseId}/marks`)
  revalidatePath('/dashboard')
}

async function loadQuizForManager(ctx: Parameters<typeof requireCourseManager>[0], quizId: string) {
  const quiz = unwrap(await ctx.supabase.from('quizzes').select('*').eq('id', quizId).maybeSingle())
  if (!quiz) throw new ActionError('Quiz not found.')
  await requireCourseManager(ctx, quiz.course_id)
  return quiz
}

/* ------------------------------- teacher: quiz ------------------------------- */

export async function createQuiz(input: CreateQuizInput) {
  return authedAction('createQuiz', ['admin', 'teacher'], async (ctx) => {
    const v = parse(createQuizSchema, input)
    await requireCourseManager(ctx, v.courseId)
    const { data, error } = await ctx.supabase
      .from('quizzes')
      .insert({
        course_id: v.courseId,
        created_by: ctx.user.id,
        title: v.title,
        description: v.description || null,
        duration_minutes: v.durationMinutes,
        opens_at: v.opensAt,
        closes_at: v.closesAt,
        max_attempts: v.maxAttempts,
        shuffle_questions: v.shuffleQuestions,
        show_answers_after_close: v.showAnswersAfterClose,
        is_published: false,
      })
      .select('id')
      .single()
    if (error) throw new ActionError('Could not create the quiz.')
    refresh(v.courseId)
    return { id: data.id }
  })
}

export async function updateQuiz(input: UpdateQuizInput) {
  return authedAction('updateQuiz', ['admin', 'teacher'], async (ctx) => {
    const v = parse(updateQuizSchema, input)
    const quiz = await loadQuizForManager(ctx, v.id)
    unwrap(
      await ctx.supabase
        .from('quizzes')
        .update({
          title: v.title,
          description: v.description || null,
          duration_minutes: v.durationMinutes,
          opens_at: v.opensAt,
          closes_at: v.closesAt,
          max_attempts: v.maxAttempts,
          shuffle_questions: v.shuffleQuestions,
          show_answers_after_close: v.showAnswersAfterClose,
        })
        .eq('id', v.id),
    )
    refresh(quiz.course_id, v.id)
    return undefined
  })
}

/** Publishing validates the whole quiz first; unpublishing hides it from students. */
export async function publishQuiz(quizId: string, publish: boolean) {
  return authedAction('publishQuiz', ['admin', 'teacher'], async (ctx) => {
    const id = parse(idSchema, quizId)
    const quiz = await loadQuizForManager(ctx, id)

    if (publish) {
      const questions = unwrapList(
        await ctx.supabase.from('quiz_questions').select('position, type, prompt, quiz_options(is_correct)').eq('quiz_id', id).order('position'),
      )
      const problems = validateForPublish(
        quiz,
        questions.map((q) => ({ position: q.position, type: q.type, prompt: q.prompt, options: q.quiz_options })),
      )
      if (problems.length > 0) throw new ActionError(`Fix these before publishing: ${problems.join(' ')}`)
    }
    unwrap(await ctx.supabase.from('quizzes').update({ is_published: publish }).eq('id', id))
    refresh(quiz.course_id, id)
    return undefined
  })
}

export async function deleteQuiz(quizId: string) {
  return authedAction('deleteQuiz', ['admin', 'teacher'], async (ctx) => {
    const id = parse(idSchema, quizId)
    const quiz = await loadQuizForManager(ctx, id)
    unwrap(await ctx.supabase.from('quizzes').delete().eq('id', id))
    refresh(quiz.course_id)
    return { courseId: quiz.course_id }
  })
}

/** Copy of a quiz (questions included), unpublished. Needed once a quiz has attempts and is frozen. */
export async function copyQuiz(quizId: string) {
  return authedAction('copyQuiz', ['admin', 'teacher'], async (ctx) => {
    const id = parse(idSchema, quizId)
    const quiz = await loadQuizForManager(ctx, id)
    const copyId = unwrap(await ctx.supabase.rpc('copy_quiz', { p_quiz: id }))
    refresh(quiz.course_id)
    return { id: copyId }
  })
}

/* ------------------------------ teacher: questions ------------------------------ */

/** Creates or updates a question together with its options. */
export async function saveQuestion(input: QuestionInput) {
  return authedAction('saveQuestion', ['admin', 'teacher'], async (ctx) => {
    const v = parse(questionSchema, input)
    const quiz = await loadQuizForManager(ctx, v.quizId)

    const options =
      v.type === 'true_false'
        ? [
            { text: 'True', isCorrect: v.trueFalseAnswer === true },
            { text: 'False', isCorrect: v.trueFalseAnswer === false },
          ]
        : v.type === 'short_answer'
          ? []
          : v.options

    let questionId = v.id
    if (questionId) {
      const own = unwrap(await ctx.supabase.from('quiz_questions').select('id').eq('id', questionId).eq('quiz_id', v.quizId).maybeSingle())
      if (!own) throw new ActionError('Question not found.')
      unwrap(await ctx.supabase.from('quiz_questions').update({ type: v.type, prompt: v.prompt, marks: v.marks }).eq('id', questionId))
      unwrap(await ctx.supabase.from('quiz_options').delete().eq('question_id', questionId))
    } else {
      const last = unwrapList(await ctx.supabase.from('quiz_questions').select('position').eq('quiz_id', v.quizId).order('position', { ascending: false }).limit(1))
      const created = await ctx.supabase
        .from('quiz_questions')
        .insert({ quiz_id: v.quizId, position: (last[0]?.position ?? 0) + 1, type: v.type, prompt: v.prompt, marks: v.marks })
        .select('id')
        .single()
      if (created.error) throw dbError(created.error)
      questionId = created.data.id
    }

    if (options.length > 0) {
      const { error } = await ctx.supabase
        .from('quiz_options')
        .insert(options.map((o, i) => ({ question_id: questionId!, position: i + 1, text: o.text, is_correct: o.isCorrect })))
      if (error) {
        if (!v.id) await ctx.supabase.from('quiz_questions').delete().eq('id', questionId!) // no half-built question
        throw dbError(error)
      }
    }
    refresh(quiz.course_id, v.quizId)
    return { id: questionId }
  })
}

export async function deleteQuestion(questionId: string) {
  return authedAction('deleteQuestion', ['admin', 'teacher'], async (ctx) => {
    const id = parse(idSchema, questionId)
    const q = unwrap(await ctx.supabase.from('quiz_questions').select('quiz_id').eq('id', id).maybeSingle())
    if (!q) throw new ActionError('Question not found.')
    const quiz = await loadQuizForManager(ctx, q.quiz_id)
    unwrap(await ctx.supabase.from('quiz_questions').delete().eq('id', id))
    refresh(quiz.course_id, q.quiz_id)
    return undefined
  })
}

export async function duplicateQuestion(questionId: string) {
  return authedAction('duplicateQuestion', ['admin', 'teacher'], async (ctx) => {
    const id = parse(idSchema, questionId)
    const q = unwrap(await ctx.supabase.from('quiz_questions').select('quiz_id').eq('id', id).maybeSingle())
    if (!q) throw new ActionError('Question not found.')
    const quiz = await loadQuizForManager(ctx, q.quiz_id)
    unwrap(await ctx.supabase.rpc('duplicate_quiz_question', { p_question: id }))
    refresh(quiz.course_id, q.quiz_id)
    return undefined
  })
}

export async function reorderQuestions(input: { quizId: string; orderedIds: string[] }) {
  return authedAction('reorderQuestions', ['admin', 'teacher'], async (ctx) => {
    const v = parse(reorderSchema, input)
    const quiz = await loadQuizForManager(ctx, v.quizId)
    unwrap(await ctx.supabase.rpc('reorder_quiz_questions', { p_quiz: v.quizId, p_ids: v.orderedIds }))
    refresh(quiz.course_id, v.quizId)
    return undefined
  })
}

/** Manual marks for a short answer; the attempt's score and status are recomputed in Postgres. */
export async function gradeShortAnswer(input: { answerId: string; marks: number }) {
  return authedAction('gradeShortAnswer', ['admin', 'teacher'], async (ctx) => {
    const v = parse(gradeShortAnswerSchema, input)
    unwrap(await ctx.supabase.rpc('grade_short_answer', { p_answer: v.answerId, p_marks: v.marks }))
    revalidatePath('/courses', 'layout')
    return undefined
  })
}

/* ------------------------------- student: attempts ------------------------------- */

/** Starts a new attempt or resumes the open one (never two in parallel). Server clock only. */
export async function startAttempt(quizId: string) {
  return authedAction('startAttempt', ['student'], async ({ supabase }) => {
    const id = parse(idSchema, quizId)
    const attemptId = unwrap(await supabase.rpc('start_quiz_attempt', { p_quiz: id }))
    return { attemptId }
  })
}

/** Autosave. Returns { saved: false } when time ran out; the attempt is then finalized on the server. */
export async function saveAnswer(input: SaveAnswerInput) {
  return authedAction('saveAnswer', ['student'], async ({ supabase }) => {
    const v = parse(saveAnswerSchema, input)
    const saved = unwrap(
      await supabase.rpc('save_quiz_answer', { p_attempt: v.attemptId, p_question: v.questionId, p_option_ids: v.optionIds, p_text: v.text ?? null }),
    )
    return { saved }
  })
}

export async function submitAttempt(attemptId: string) {
  return authedAction('submitAttempt', ['student'], async ({ supabase }) => {
    const id = parse(idSchema, attemptId)
    unwrap(await supabase.rpc('submit_quiz_attempt', { p_attempt: id }))
    revalidatePath('/courses', 'layout')
    return undefined
  })
}
