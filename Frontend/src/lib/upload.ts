'use client'

import { createClient } from '@/lib/supabase/client'
import { publicEnv } from '@/lib/env'
import type { BucketName } from '@/lib/files'

export type SignedUpload = { path: string; token: string; signedUrl: string }

/**
 * Uploads straight from the browser to a signed upload URL issued by a server action
 * (which already checked the role, size and type). Uses XHR so we can show progress;
 * if that fails for any reason it retries once through the SDK (no progress), whose
 * error is final.
 */
export async function uploadToSignedUrl(
  bucket: BucketName,
  upload: SignedUpload,
  file: File,
  onProgress?: (percent: number) => void,
  options: { upsert?: boolean } = {},
): Promise<void> {
  const upsert = options.upsert ?? false
  try {
    await xhrUpload(upload.signedUrl, file, upsert, onProgress)
  } catch {
    onProgress?.(0)
    const supabase = createClient()
    const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(upload.path, upload.token, file, { upsert })
    if (error) throw new Error('The upload failed. Check your connection and the file type, then try again.')
  }
  onProgress?.(100)
}

function xhrUpload(url: string, file: File, upsert: boolean, onProgress?: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = new FormData()
    body.append('cacheControl', '3600')
    body.append('', file)

    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('apikey', publicEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY)
    xhr.setRequestHeader('x-upsert', String(upsert))
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.min(99, Math.round((e.loaded / e.total) * 100)))
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)))
    xhr.onerror = () => reject(new Error('Network error during upload.'))
    xhr.send(body)
  })
}
