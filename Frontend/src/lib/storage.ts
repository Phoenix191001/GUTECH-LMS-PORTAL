import 'server-only'
import type { Supabase } from '@/lib/auth'
import type { BucketName } from '@/lib/files'

/** Signed URLs last 60 minutes (spec Section 5). Buckets are private. */
export const SIGNED_URL_TTL = 60 * 60

export async function signedUrl(supabase: Supabase, bucket: BucketName, path: string | null | undefined, download?: string | boolean) {
  if (!path) return null
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL, download ? { download } : undefined)
  return data?.signedUrl ?? null
}

/** Batch version; returns a map path -> url (missing paths are omitted). */
export async function signedUrls(supabase: Supabase, bucket: BucketName, paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))]
  const map = new Map<string, string>()
  if (unique.length === 0) return map
  const { data } = await supabase.storage.from(bucket).createSignedUrls(unique, SIGNED_URL_TTL)
  for (const item of data ?? []) if (item.path && item.signedUrl) map.set(item.path, item.signedUrl)
  return map
}
