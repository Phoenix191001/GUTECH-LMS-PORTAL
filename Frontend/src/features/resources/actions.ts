'use server'

import { revalidatePath } from 'next/cache'
import { ActionError, authedAction, parse, unwrap, unwrapList } from '@/lib/actions'
import { signedUrl } from '@/lib/storage'
import { loadDirectory } from '@/features/shared/directory'
import { assertUploaded, issueSignedUpload, removeObject, requireCourseManager } from '@/features/shared/guards'
import {
  createLinkSchema,
  finalizeResourceSchema,
  updateResourceSchema,
  uploadRequestSchema,
  type CreateLinkInput,
  type FinalizeResourceInput,
  type UpdateResourceInput,
} from './schemas'
import { z } from 'zod'
import type { Row } from '@/types/database'

const idSchema = z.uuid()
const refresh = (courseId: string) => revalidatePath(`/courses/${courseId}/resources`)

/** Step 1 of an upload: check the user teaches the course, then hand back a signed upload URL. */
export async function createResourceUpload(input: z.infer<typeof uploadRequestSchema>) {
  return authedAction('createResourceUpload', ['admin', 'teacher'], async (ctx) => {
    const v = parse(uploadRequestSchema, input)
    await requireCourseManager(ctx, v.courseId)
    return issueSignedUpload(ctx.supabase, 'resources', v.courseId, v)
  })
}

/** Step 2: the browser finished uploading; insert the row. If that fails, delete the orphan file. */
export async function finalizeResource(input: FinalizeResourceInput) {
  return authedAction('finalizeResource', ['admin', 'teacher'], async (ctx) => {
    const v = parse(finalizeResourceSchema, input)
    await requireCourseManager(ctx, v.courseId)
    await assertUploaded(ctx.supabase, 'resources', v.file.path, v.courseId)

    const { error } = await ctx.supabase.from('resources').insert({
      course_id: v.courseId,
      uploaded_by: ctx.user.id,
      title: v.title,
      description: v.description || null,
      kind: 'file',
      storage_path: v.file.path,
      file_name: v.file.fileName,
      file_size: v.file.fileSize,
      mime_type: v.file.mimeType,
    })
    if (error) {
      await removeObject(ctx.supabase, 'resources', v.file.path)
      throw new ActionError('Could not save the resource. The upload was discarded.')
    }
    refresh(v.courseId)
    return undefined
  })
}

export async function createLinkResource(input: CreateLinkInput) {
  return authedAction('createLinkResource', ['admin', 'teacher'], async (ctx) => {
    const v = parse(createLinkSchema, input)
    await requireCourseManager(ctx, v.courseId)
    unwrap(
      await ctx.supabase.from('resources').insert({
        course_id: v.courseId,
        uploaded_by: ctx.user.id,
        title: v.title,
        description: v.description || null,
        kind: 'link',
        external_url: v.url,
      }),
    )
    refresh(v.courseId)
    return undefined
  })
}

/**
 * Students: records "seen" once (unique per student/resource) and returns a 60-minute
 * signed URL (or the external link). Teacher/admin opens are not recorded.
 */
export async function openResource(resourceId: string) {
  return authedAction('openResource', null, async ({ user, supabase }) => {
    const id = parse(idSchema, resourceId)
    const resource = unwrap(await supabase.from('resources').select('*').eq('id', id).maybeSingle())
    if (!resource) throw new ActionError('This resource is no longer available.')

    if (user.profile.role === 'student') {
      unwrap(
        await supabase
          .from('resource_views')
          .upsert({ resource_id: id, student_id: user.id }, { onConflict: 'resource_id,student_id', ignoreDuplicates: true }),
      )
      refresh(resource.course_id)
    }

    if (resource.kind === 'link') return { url: resource.external_url ?? '' }
    const url = await signedUrl(supabase, 'resources', resource.storage_path)
    if (!url) throw new ActionError('Could not open the file. Please try again.')
    return { url }
  })
}

export async function updateResource(input: UpdateResourceInput) {
  return authedAction('updateResource', ['admin', 'teacher'], async (ctx) => {
    const v = parse(updateResourceSchema, input)
    const existing = unwrap(await ctx.supabase.from('resources').select('*').eq('id', v.id).maybeSingle())
    if (!existing) throw new ActionError('Resource not found.')
    await requireCourseManager(ctx, existing.course_id)

    const patch: Partial<Row<'resources'>> = { title: v.title, description: v.description || null }
    if (existing.kind === 'link' && v.url) patch.external_url = v.url
    if (existing.kind === 'file' && v.file) {
      await assertUploaded(ctx.supabase, 'resources', v.file.path, existing.course_id)
      Object.assign(patch, {
        storage_path: v.file.path,
        file_name: v.file.fileName,
        file_size: v.file.fileSize,
        mime_type: v.file.mimeType,
      })
    }

    const { error } = await ctx.supabase.from('resources').update(patch).eq('id', v.id)
    if (error) {
      if (v.file) await removeObject(ctx.supabase, 'resources', v.file.path)
      throw new ActionError('Could not save your changes.')
    }
    if (existing.kind === 'file' && v.file) await removeObject(ctx.supabase, 'resources', existing.storage_path)
    refresh(existing.course_id)
    return undefined
  })
}

/** Deletes the row (views cascade) and its Storage object. */
export async function deleteResource(resourceId: string) {
  return authedAction('deleteResource', ['admin', 'teacher'], async (ctx) => {
    const id = parse(idSchema, resourceId)
    const existing = unwrap(await ctx.supabase.from('resources').select('*').eq('id', id).maybeSingle())
    if (!existing) throw new ActionError('Resource not found.')
    await requireCourseManager(ctx, existing.course_id)
    unwrap(await ctx.supabase.from('resources').delete().eq('id', id))
    await removeObject(ctx.supabase, 'resources', existing.storage_path)
    refresh(existing.course_id)
    return undefined
  })
}

export type Viewer = { id: string; name: string; rollNo: string | null; seenAt: string | null }

/** "Seen by 12 of 30" panel data: who has opened the resource and who has not. */
export async function getResourceViewers(resourceId: string) {
  return authedAction('getResourceViewers', ['admin', 'teacher'], async (ctx) => {
    const id = parse(idSchema, resourceId)
    const resource = unwrap(await ctx.supabase.from('resources').select('id, course_id').eq('id', id).maybeSingle())
    if (!resource) throw new ActionError('Resource not found.')
    await requireCourseManager(ctx, resource.course_id)

    const [enrolled, views] = await Promise.all([
      ctx.supabase.from('enrollments').select('student_id').eq('course_id', resource.course_id).limit(1000),
      ctx.supabase.from('resource_views').select('student_id, seen_at').eq('resource_id', id).limit(1000),
    ])
    const studentIds = unwrapList(enrolled).map((e) => e.student_id)
    const seenMap = new Map(unwrapList(views).map((v) => [v.student_id, v.seen_at]))
    const dir = await loadDirectory(ctx.supabase, [...studentIds, ...seenMap.keys()])

    const toViewer = (sid: string): Viewer => ({
      id: sid,
      name: dir.get(sid)?.full_name ?? 'Former member',
      rollNo: dir.get(sid)?.roll_no ?? null,
      seenAt: seenMap.get(sid) ?? null,
    })
    const seen = [...seenMap.keys()].map(toViewer).sort((a, b) => (b.seenAt ?? '').localeCompare(a.seenAt ?? ''))
    const notSeen = studentIds.filter((s) => !seenMap.has(s)).map(toViewer).sort((a, b) => a.name.localeCompare(b.name))
    return { seen, notSeen, total: studentIds.length }
  })
}
