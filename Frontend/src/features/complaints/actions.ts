'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ActionError, authedAction, parse, unwrap } from '@/lib/actions'
import { canTransition, createComplaintSchema, updateComplaintSchema, type CreateComplaintInput, type UpdateComplaintInput } from './schemas'

const idSchema = z.uuid()

const refresh = () => {
  revalidatePath('/complaints')
  revalidatePath('/admin/complaints')
}

/**
 * Any signed-in user can file a complaint, optionally about one of their own courses.
 * 5 per user per day is enforced by a database trigger. Nobody but the submitter and the
 * administrators can ever read it (RLS), including a teacher it names.
 */
export async function createComplaint(input: CreateComplaintInput) {
  return authedAction('createComplaint', null, async ({ user, supabase }) => {
    const v = parse(createComplaintSchema, input)
    if (v.courseId) {
      const course = unwrap(await supabase.from('courses').select('id').eq('id', v.courseId).maybeSingle())
      if (!course) throw new ActionError('Choose one of your own courses, or leave it blank.')
    }
    const { data, error } = await supabase
      .from('complaints')
      .insert({ submitted_by: user.id, course_id: v.courseId, category: v.category, subject: v.subject, description: v.description })
      .select('id')
      .single()
    if (error) throw new ActionError(error.code === 'P0001' ? error.message : 'Could not file your complaint. Please try again.')
    refresh()
    return { id: data.id }
  })
}

/** The complainant can withdraw only their own *open* complaint: it becomes rejected ("Withdrawn by user"). */
export async function withdrawComplaint(complaintId: string) {
  return authedAction('withdrawComplaint', null, async ({ supabase }) => {
    const id = parse(idSchema, complaintId)
    unwrap(await supabase.rpc('withdraw_complaint', { p_id: id }))
    refresh()
    return undefined
  })
}

/** Admin: move along the allowed flow and write the response (required to resolve/reject). */
export async function updateComplaintStatus(input: UpdateComplaintInput) {
  return authedAction('updateComplaintStatus', ['admin'], async ({ supabase }) => {
    const v = parse(updateComplaintSchema, input)
    const current = unwrap(await supabase.from('complaints').select('id, status').eq('id', v.id).maybeSingle())
    if (!current) throw new ActionError('Complaint not found.')
    if (!canTransition(current.status, v.status)) {
      throw new ActionError(`A ${current.status.replace('_', ' ')} complaint cannot move to ${v.status.replace('_', ' ')}.`)
    }
    const { error } = await supabase.from('complaints').update({ status: v.status, admin_response: v.response || null }).eq('id', v.id)
    if (error) throw new ActionError(error.code === 'P0001' ? error.message : 'Could not update the complaint.')
    refresh()
    return undefined
  })
}

/** Clears the notification dot on /complaints. */
export async function markComplaintsSeen() {
  return authedAction('markComplaintsSeen', null, async ({ supabase }) => {
    unwrap(await supabase.rpc('mark_complaints_seen'))
    return undefined
  })
}
