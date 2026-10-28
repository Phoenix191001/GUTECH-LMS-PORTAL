'use server'

import { z } from 'zod'
import { ActionError, authedAction, parse, unwrap } from '@/lib/actions'
import { loadChatPage } from './queries'
import { loadMessagesSchema, sendMessageSchema, type ChatMessage } from './schemas'

const idSchema = z.uuid()

/**
 * Sends a message as the signed-in teacher/student. Membership is enforced by RLS and the
 * 20-messages-per-minute limit by a database trigger, so neither can be bypassed.
 */
export async function sendMessage(input: { courseId: string; body: string }) {
  return authedAction('sendMessage', ['teacher', 'student'], async ({ user, supabase }) => {
    const v = parse(sendMessageSchema, input)
    const { data, error } = await supabase.from('chat_messages').insert({ course_id: v.courseId, sender_id: user.id, body: v.body }).select('*').single()
    if (error) {
      if (error.code === 'P0001') throw new ActionError(error.message)
      throw new ActionError('Could not send your message. You may no longer have access to this chat.')
    }
    return data satisfies ChatMessage
  })
}

/** Soft delete: own messages, or any message for the course's teacher / an admin. */
export async function deleteMessage(messageId: string) {
  return authedAction('deleteMessage', null, async ({ supabase }) => {
    const id = parse(idSchema, messageId)
    const updated = unwrap(await supabase.from('chat_messages').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select('id'))
    if (!updated || updated.length === 0) throw new ActionError('You cannot delete this message.')
    return undefined
  })
}

/** Older history (or the latest page again after a dropped connection). */
export async function loadMessages(input: { courseId: string; before?: string }) {
  return authedAction('loadMessages', null, async ({ supabase }) => {
    const v = parse(loadMessagesSchema, input)
    return loadChatPage(supabase, v.courseId, v.before)
  })
}

/** Updates chat_last_read so the course tab's unread badge clears. */
export async function markChatRead(courseId: string) {
  return authedAction('markChatRead', null, async ({ supabase }) => {
    const id = parse(idSchema, courseId)
    unwrap(await supabase.rpc('mark_chat_read', { p_course: id }))
    return undefined
  })
}
