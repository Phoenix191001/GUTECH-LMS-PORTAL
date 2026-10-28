'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ActionError, authedAction, parse, unwrap } from '@/lib/actions'
import { extensionFor, validateFile } from '@/lib/files'
import { removeObject } from '@/features/shared/guards'

const nameSchema = z.object({ fullName: z.string().trim().min(2, 'Enter your full name').max(120, 'Name is too long') })
const avatarRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
})

const refresh = () => {
  revalidatePath('/profile')
  revalidatePath('/', 'layout') // avatar + name appear in the shell
}

/** Users can change only their own name (RLS + column grants allow full_name and avatar_url only). */
export async function updateProfileName(input: { fullName: string }) {
  return authedAction('updateProfileName', null, async ({ user, supabase }) => {
    const v = parse(nameSchema, input)
    const updated = unwrap(await supabase.from('profiles').update({ full_name: v.fullName }).eq('id', user.id).select('id'))
    if (!updated || updated.length === 0) throw new ActionError('Could not update your name.')
    refresh()
    return undefined
  })
}

/**
 * Avatars live in the private `avatars` bucket at {user_id}.{ext} (2 MB; png, jpg, webp).
 * Size and type are checked here before a signed upload URL is issued.
 */
export async function createAvatarUpload(input: z.infer<typeof avatarRequestSchema>) {
  return authedAction('createAvatarUpload', null, async ({ user, supabase }) => {
    const v = parse(avatarRequestSchema, input)
    const problem = validateFile('avatars', { name: v.fileName, size: v.fileSize, type: v.mimeType })
    if (problem) throw new ActionError(problem)
    const path = `${user.id}.${extensionFor('avatars', v.mimeType)}`
    const { data, error } = await supabase.storage.from('avatars').createSignedUploadUrl(path, { upsert: true })
    if (error || !data) throw new ActionError('You cannot upload a picture right now.')
    return { path, token: data.token, signedUrl: data.signedUrl }
  })
}

/** After the browser finished uploading: point the profile at the new file and drop the old one. */
export async function saveAvatar(input: { path: string }) {
  return authedAction('saveAvatar', null, async ({ user, supabase }) => {
    const { path } = parse(z.object({ path: z.string().max(200) }), input)
    if (!new RegExp(`^${user.id}\\.(png|jpg|webp)$`).test(path)) throw new ActionError('Invalid picture.')
    const { data: exists } = await supabase.storage.from('avatars').exists(path)
    if (!exists) throw new ActionError('The picture was not uploaded. Please try again.')

    const previous = user.profile.avatar_url
    const updated = unwrap(await supabase.from('profiles').update({ avatar_url: path }).eq('id', user.id).select('id'))
    if (!updated || updated.length === 0) throw new ActionError('Could not save your picture.')
    if (previous && previous !== path) await removeObject(supabase, 'avatars', previous)
    refresh()
    return undefined
  })
}

export async function removeAvatar() {
  return authedAction('removeAvatar', null, async ({ user, supabase }) => {
    const previous = user.profile.avatar_url
    unwrap(await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id))
    await removeObject(supabase, 'avatars', previous)
    refresh()
    return undefined
  })
}

/** Ends every other session of this account (this device stays signed in). */
export async function signOutOtherDevices() {
  return authedAction('signOutOtherDevices', null, async ({ supabase }) => {
    const { error } = await supabase.auth.signOut({ scope: 'others' })
    if (error) throw new ActionError('Could not sign out other devices.')
    return undefined
  })
}
