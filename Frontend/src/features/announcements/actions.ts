'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ActionError, authedAction, parse, unwrap } from '@/lib/actions'
import { requireCourseManager } from '@/features/shared/guards'
import {
  createAnnouncementSchema,
  markReadSchema,
  updateAnnouncementSchema,
  type CreateAnnouncementInput,
  type UpdateAnnouncementInput,
} from './schemas'

const idSchema = z.uuid()

const refresh = (courseId: string | null) => {
  if (courseId) revalidatePath(`/courses/${courseId}/announcements`)
  revalidatePath('/announcements')
  revalidatePath('/admin/announcements')
  revalidatePath('/dashboard')
}

/** Teachers post to their own courses; only admins may post global announcements (course = null). */
export async function createAnnouncement(input: CreateAnnouncementInput) {
  return authedAction('createAnnouncement', ['admin', 'teacher'], async (ctx) => {
    const v = parse(createAnnouncementSchema, input)
    if (v.courseId) await requireCourseManager(ctx, v.courseId)
    else if (ctx.user.profile.role !== 'admin') throw new ActionError('Only administrators can post global announcements.')

    unwrap(
      await ctx.supabase.from('announcements').insert({ course_id: v.courseId, author_id: ctx.user.id, title: v.title, body: v.body, is_pinned: v.isPinned }),
    )
    refresh(v.courseId)
    return undefined
  })
}

/** Only the author (in their own course) or an admin can edit. Enforced here and by RLS. */
export async function updateAnnouncement(input: UpdateAnnouncementInput) {
  return authedAction('updateAnnouncement', ['admin', 'teacher'], async (ctx) => {
    const v = parse(updateAnnouncementSchema, input)
    const existing = unwrap(await ctx.supabase.from('announcements').select('id, course_id, author_id').eq('id', v.id).maybeSingle())
    if (!existing) throw new ActionError('Announcement not found.')
    if (ctx.user.profile.role !== 'admin' && existing.author_id !== ctx.user.id) throw new ActionError('You can only edit your own announcements.')

    const updated = unwrap(await ctx.supabase.from('announcements').update({ title: v.title, body: v.body, is_pinned: v.isPinned }).eq('id', v.id).select('id'))
    if (!updated || updated.length === 0) throw new ActionError('You cannot edit this announcement.')
    refresh(existing.course_id)
    return undefined
  })
}

export async function deleteAnnouncement(announcementId: string) {
  return authedAction('deleteAnnouncement', ['admin', 'teacher'], async (ctx) => {
    const id = parse(idSchema, announcementId)
    const existing = unwrap(await ctx.supabase.from('announcements').select('id, course_id, author_id').eq('id', id).maybeSingle())
    if (!existing) throw new ActionError('Announcement not found.')
    if (ctx.user.profile.role !== 'admin' && existing.author_id !== ctx.user.id) throw new ActionError('You can only delete your own announcements.')

    const removed = unwrap(await ctx.supabase.from('announcements').delete().eq('id', id).select('id'))
    if (!removed || removed.length === 0) throw new ActionError('You cannot delete this announcement.')
    refresh(existing.course_id)
    return undefined
  })
}

/** Marks several announcements read for the current user (one row each, never duplicated). */
export async function markAnnouncementsRead(input: { ids: string[] }) {
  return authedAction('markAnnouncementsRead', null, async ({ user, supabase }) => {
    const v = parse(markReadSchema, input)
    unwrap(
      await supabase
        .from('announcement_reads')
        .upsert(v.ids.map((announcement_id) => ({ announcement_id, user_id: user.id })), { onConflict: 'announcement_id,user_id', ignoreDuplicates: true }),
    )
    return undefined
  })
}
