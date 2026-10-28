'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ActionError, authedAction, parse, unwrap } from '@/lib/actions'
import type { Supabase } from '@/lib/auth'
import { assertUploaded, issueSignedUpload, removeObject, requireCourseManager } from '@/features/shared/guards'
import {
  assignmentSchema,
  deleteAssignmentSchema,
  gradeSchema,
  submissionUploadSchema,
  submitAssignmentSchema,
  updateAssignmentSchema,
  type AssignmentInput,
  type GradeInput,
  type SubmitAssignmentInput,
  type UpdateAssignmentInput,
} from './schemas'

const idSchema = z.uuid()

const refresh = (courseId: string, assignmentId?: string) => {
  revalidatePath(`/courses/${courseId}/assignments`)
  if (assignmentId) revalidatePath(`/courses/${courseId}/assignments/${assignmentId}`, 'layout')
  revalidatePath(`/courses/${courseId}/marks`)
  revalidatePath('/dashboard')
}

async function loadAssignmentForManager(ctx: Parameters<typeof requireCourseManager>[0], assignmentId: string) {
  const assignment = unwrap(await ctx.supabase.from('assignments').select('*').eq('id', assignmentId).maybeSingle())
  if (!assignment) throw new ActionError('Assignment not found.')
  await requireCourseManager(ctx, assignment.course_id)
  return assignment
}

/** Lists every stored file for an assignment's submissions (folders are per student). */
async function listSubmissionFiles(supabase: Supabase, assignmentId: string): Promise<string[]> {
  const bucket = supabase.storage.from('submissions')
  const { data: folders } = await bucket.list(assignmentId, { limit: 1000 })
  const paths: string[] = []
  for (const folder of folders ?? []) {
    const { data: files } = await bucket.list(`${assignmentId}/${folder.name}`, { limit: 1000 })
    for (const f of files ?? []) paths.push(`${assignmentId}/${folder.name}/${f.name}`)
  }
  return paths
}

export async function createAssignment(input: AssignmentInput) {
  return authedAction('createAssignment', ['admin', 'teacher'], async (ctx) => {
    const v = parse(assignmentSchema, input)
    await requireCourseManager(ctx, v.courseId)
    if (v.attachment) await assertUploaded(ctx.supabase, 'resources', v.attachment.path, v.courseId)

    const { data, error } = await ctx.supabase
      .from('assignments')
      .insert({
        course_id: v.courseId,
        created_by: ctx.user.id,
        title: v.title,
        instructions: v.instructions || null,
        attachment_path: v.attachment?.path ?? null,
        attachment_name: v.attachment?.fileName ?? null,
        due_at: v.dueAt,
        max_marks: v.maxMarks,
        allow_late: v.allowLate,
        is_published: v.publish,
      })
      .select('id')
      .single()
    if (error) {
      if (v.attachment) await removeObject(ctx.supabase, 'resources', v.attachment.path)
      throw new ActionError('Could not create the assignment.')
    }
    refresh(v.courseId)
    return { id: data.id }
  })
}

export async function updateAssignment(input: UpdateAssignmentInput) {
  return authedAction('updateAssignment', ['admin', 'teacher'], async (ctx) => {
    const v = parse(updateAssignmentSchema, input)
    const existing = await loadAssignmentForManager(ctx, v.id)
    if (v.attachment) await assertUploaded(ctx.supabase, 'resources', v.attachment.path, existing.course_id)

    const patch: Partial<typeof existing> = {
      title: v.title,
      instructions: v.instructions || null,
      due_at: v.dueAt,
      max_marks: v.maxMarks,
      allow_late: v.allowLate,
    }
    if (v.attachment) {
      patch.attachment_path = v.attachment.path
      patch.attachment_name = v.attachment.fileName
    } else if (v.removeAttachment) {
      patch.attachment_path = null
      patch.attachment_name = null
    }

    const { error } = await ctx.supabase.from('assignments').update(patch).eq('id', v.id)
    if (error) {
      if (v.attachment) await removeObject(ctx.supabase, 'resources', v.attachment.path)
      throw new ActionError('Could not save the assignment.')
    }
    if ((v.attachment || v.removeAttachment) && existing.attachment_path) {
      await removeObject(ctx.supabase, 'resources', existing.attachment_path)
    }
    refresh(existing.course_id, v.id)
    return undefined
  })
}

export async function setAssignmentPublished(assignmentId: string, published: boolean) {
  return authedAction('setAssignmentPublished', ['admin', 'teacher'], async (ctx) => {
    const id = parse(idSchema, assignmentId)
    const existing = await loadAssignmentForManager(ctx, id)
    unwrap(await ctx.supabase.from('assignments').update({ is_published: published }).eq('id', id))
    refresh(existing.course_id, id)
    return undefined
  })
}

/**
 * Deleting an assignment that has submissions requires typing its title, and removes the
 * stored submission files and the attachment as well.
 */
export async function deleteAssignment(input: { id: string; confirmTitle?: string }) {
  return authedAction('deleteAssignment', ['admin', 'teacher'], async (ctx) => {
    const v = parse(deleteAssignmentSchema, input)
    const existing = await loadAssignmentForManager(ctx, v.id)
    const { count } = await ctx.supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('assignment_id', v.id)
    if ((count ?? 0) > 0 && v.confirmTitle?.trim() !== existing.title.trim()) {
      throw new ActionError('Type the assignment title exactly to confirm deleting its submissions.')
    }

    const files = await listSubmissionFiles(ctx.supabase, v.id)
    unwrap(await ctx.supabase.from('assignments').delete().eq('id', v.id))
    if (files.length > 0) await ctx.supabase.storage.from('submissions').remove(files)
    await removeObject(ctx.supabase, 'resources', existing.attachment_path)
    refresh(existing.course_id)
    return { courseId: existing.course_id }
  })
}

/* ------------------------------ students ------------------------------ */

/** Signed upload URL for a student's file. Checks enrolment and the (server-clock) deadline first. */
export async function createSubmissionUpload(input: z.infer<typeof submissionUploadSchema>) {
  return authedAction('createSubmissionUpload', ['student'], async ({ user, supabase }) => {
    const v = parse(submissionUploadSchema, input)
    const assignment = unwrap(await supabase.from('assignments').select('*').eq('id', v.assignmentId).maybeSingle())
    if (!assignment || !assignment.is_published) throw new ActionError('Assignment not found.')
    if (new Date() > new Date(assignment.due_at) && !assignment.allow_late) {
      throw new ActionError('The deadline for this assignment has passed.')
    }
    return issueSignedUpload(supabase, 'submissions', `${v.assignmentId}/${user.id}`, v)
  })
}

export async function submitAssignment(input: SubmitAssignmentInput) {
  return authedAction('submitAssignment', ['student'], async ({ user, supabase }) => {
    const v = parse(submitAssignmentSchema, input)
    const assignment = unwrap(await supabase.from('assignments').select('*').eq('id', v.assignmentId).maybeSingle())
    if (!assignment || !assignment.is_published) throw new ActionError('Assignment not found.')

    // Server clock, never the browser's. Postgres re-checks this in a trigger.
    if (new Date() > new Date(assignment.due_at) && !assignment.allow_late) {
      if (v.file) await removeObject(supabase, 'submissions', v.file.path)
      throw new ActionError('The deadline for this assignment has passed, so this can no longer be submitted.')
    }

    const text = v.textAnswer?.trim() || null
    const existing = unwrap(
      await supabase.from('submissions').select('*').eq('assignment_id', v.assignmentId).eq('student_id', user.id).maybeSingle(),
    )
    if (existing?.graded_at) {
      if (v.file) await removeObject(supabase, 'submissions', v.file.path)
      throw new ActionError('This submission has been graded and can no longer be changed.')
    }
    if (v.file) await assertUploaded(supabase, 'submissions', v.file.path, `${v.assignmentId}/${user.id}`)

    const filePath = v.file?.path ?? existing?.file_path ?? null
    const fileName = v.file?.fileName ?? existing?.file_name ?? null
    if (!text && !filePath) throw new ActionError('Add some text or a file before submitting.')

    const row = { text_answer: text, file_path: filePath, file_name: fileName }
    if (existing) {
      const updated = unwrap(await supabase.from('submissions').update(row).eq('id', existing.id).select('id'))
      if (!updated || updated.length === 0) {
        if (v.file) await removeObject(supabase, 'submissions', v.file.path)
        throw new ActionError('This submission can no longer be changed.')
      }
      // replaced file -> delete the old one
      if (v.file && existing.file_path && existing.file_path !== v.file.path) {
        await removeObject(supabase, 'submissions', existing.file_path)
      }
    } else {
      const { error } = await supabase.from('submissions').insert({ assignment_id: v.assignmentId, student_id: user.id, ...row })
      if (error) {
        if (v.file) await removeObject(supabase, 'submissions', v.file.path)
        throw error.code === 'P0001' ? new ActionError(error.message) : new ActionError('Could not submit your work.')
      }
    }
    refresh(assignment.course_id, assignment.id)
    return { late: new Date() > new Date(assignment.due_at) }
  })
}

/* ------------------------------ grading ------------------------------ */

/**
 * Saves marks + feedback. For a student with no submission this creates an empty
 * submission row (so 0 marks can be recorded). Marks are validated 0..max here and in Postgres.
 */
export async function gradeSubmission(input: GradeInput) {
  return authedAction('gradeSubmission', ['admin', 'teacher'], async (ctx) => {
    const v = parse(gradeSchema, input)
    const assignment = await loadAssignmentForManager(ctx, v.assignmentId)
    if (v.marks > assignment.max_marks) throw new ActionError(`Marks cannot be more than ${assignment.max_marks}.`, { marks: [`Maximum is ${assignment.max_marks}`] })

    const existing = unwrap(
      await ctx.supabase.from('submissions').select('id').eq('assignment_id', v.assignmentId).eq('student_id', v.studentId).maybeSingle(),
    )
    if (existing) {
      const updated = unwrap(
        await ctx.supabase.from('submissions').update({ marks_obtained: v.marks, feedback: v.feedback || null }).eq('id', existing.id).select('id'),
      )
      if (!updated || updated.length === 0) throw new ActionError('Could not save the marks.')
    } else {
      const enrolled = unwrap(
        await ctx.supabase.from('enrollments').select('id').eq('course_id', assignment.course_id).eq('student_id', v.studentId).maybeSingle(),
      )
      if (!enrolled) throw new ActionError('This student is not enrolled in the course.')
      const { error } = await ctx.supabase
        .from('submissions')
        .insert({ assignment_id: v.assignmentId, student_id: v.studentId, marks_obtained: v.marks, feedback: v.feedback || null })
      if (error) throw new ActionError(error.code === 'P0001' ? error.message : 'Could not save the marks.')
    }
    refresh(assignment.course_id, assignment.id)
    return undefined
  })
}
