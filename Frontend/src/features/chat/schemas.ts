import { z } from 'zod'

export const MAX_MESSAGE = 2000
export const PAGE = 50

/** Trim whitespace; empty messages are rejected. */
export const messageBody = z.string().trim().min(1, 'Type a message first').max(MAX_MESSAGE, `Messages can be at most ${MAX_MESSAGE} characters`)

export const sendMessageSchema = z.object({ courseId: z.uuid(), body: messageBody })
export const loadMessagesSchema = z.object({ courseId: z.uuid(), before: z.iso.datetime({ offset: true }).optional() })

export type ChatMessage = {
  id: string
  course_id: string
  sender_id: string
  body: string
  created_at: string
  deleted_at: string | null
}

export type ChatPerson = { name: string; avatarUrl: string | null; role: 'admin' | 'teacher' | 'student' }
export type ChatPage = { messages: ChatMessage[]; people: Record<string, ChatPerson>; hasMore: boolean }
