import 'server-only'
import { ActionError, dbError, unwrap } from '@/lib/actions'
import type { AppUser, Supabase } from '@/lib/auth'
import { safeFileName, validateFile, type BucketName } from '@/lib/files'
import type { Row } from '@/types/database'

type Ctx = { user: AppUser; supabase: Supabase }

/**
 * Loads a course and re-checks, in code, that the caller may manage it (admin, or the
 * course's teacher). RLS enforces the same rule in the database; this gives a clear error.
 */
export async function requireCourseManager({ user, supabase }: Ctx, courseId: string): Promise<Row<'courses'>> {
  const course = unwrap(await supabase.from('courses').select('*').eq('id', courseId).maybeSingle())
  if (!course) throw new ActionError('Course not found.')
  const allowed = user.profile.role === 'admin' || (user.profile.role === 'teacher' && course.teacher_id === user.id)
  if (!allowed) throw new ActionError('You do not have permission to change this course.')
  return course
}

/** Loads a course the caller is a member of (admin, teacher of it, or enrolled student). */
export async function requireCourseMember({ supabase }: Ctx, courseId: string): Promise<Row<'courses'>> {
  const course = unwrap(await supabase.from('courses').select('*').eq('id', courseId).maybeSingle())
  if (!course) throw new ActionError('Course not found.')
  return course
}

export type SignedUploadResult = { path: string; token: string; signedUrl: string }

/**
 * Validates size/type server-side, then issues a one-time signed upload URL. The storage
 * policy re-checks who may write to this folder when the URL is created.
 */
export async function issueSignedUpload(
  supabase: Supabase,
  bucket: BucketName,
  folder: string,
  meta: { fileName: string; fileSize: number; mimeType: string },
): Promise<SignedUploadResult> {
  const problem = validateFile(bucket, { name: meta.fileName, size: meta.fileSize, type: meta.mimeType })
  if (problem) throw new ActionError(problem)

  const path = `${folder}/${crypto.randomUUID()}-${safeFileName(meta.fileName)}`
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path)
  if (error || !data) throw new ActionError('You do not have permission to upload here.')
  return { path: data.path ?? path, token: data.token, signedUrl: data.signedUrl }
}

/** The uploaded object must exist, live under the expected folder, and match the claimed size window. */
export async function assertUploaded(supabase: Supabase, bucket: BucketName, path: string, folderPrefix: string) {
  if (!path.startsWith(`${folderPrefix}/`) || path.includes('..')) throw new ActionError('Invalid upload.')
  const { data, error } = await supabase.storage.from(bucket).exists(path)
  if (error) throw dbError(error as unknown as { message: string })
  if (!data) throw new ActionError('The file was not uploaded. Please try again.')
}

export async function removeObject(supabase: Supabase, bucket: BucketName, path: string | null | undefined) {
  if (!path) return
  await supabase.storage.from(bucket).remove([path])
}
