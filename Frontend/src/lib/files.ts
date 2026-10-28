/** Upload rules per bucket (spec Section 5). Shared by the browser form and the server actions. */

export type BucketName = 'resources' | 'submissions' | 'avatars'

const MB = 1024 * 1024

type Rule = { maxBytes: number; mimes: Record<string, string>; label: string }

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const BUCKET_RULES: Record<BucketName, Rule> = {
  resources: {
    maxBytes: 50 * MB,
    mimes: {
      'application/pdf': 'pdf',
      [DOCX]: 'docx',
      [PPTX]: 'pptx',
      [XLSX]: 'xlsx',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'video/mp4': 'mp4',
      'application/zip': 'zip',
      'application/x-zip-compressed': 'zip',
    },
    label: 'PDF, DOCX, PPTX, XLSX, PNG, JPG, MP4 or ZIP up to 50 MB',
  },
  submissions: {
    maxBytes: 25 * MB,
    mimes: {
      'application/pdf': 'pdf',
      [DOCX]: 'docx',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'application/zip': 'zip',
      'application/x-zip-compressed': 'zip',
    },
    label: 'PDF, DOCX, PNG, JPG or ZIP up to 25 MB',
  },
  avatars: {
    maxBytes: 2 * MB,
    mimes: { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' },
    label: 'PNG, JPG or WEBP up to 2 MB',
  },
}

export type FileMeta = { name: string; size: number; type: string }

/** Returns an error message, or null when the file is acceptable. */
export function validateFile(bucket: BucketName, file: FileMeta): string | null {
  const rule = BUCKET_RULES[bucket]
  if (file.size <= 0) return 'The file is empty.'
  if (file.size > rule.maxBytes) return `File is too large. Allowed: ${rule.label}.`
  if (!(file.type in rule.mimes)) return `This file type is not allowed. Allowed: ${rule.label}.`
  return null
}

export function extensionFor(bucket: BucketName, mime: string): string {
  return BUCKET_RULES[bucket].mimes[mime] ?? 'bin'
}

/** Keeps the original name readable but safe for a storage path. */
export function safeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(-80)
  return cleaned || 'file'
}

export function fileIconKind(mime: string | null | undefined, name?: string | null): 'pdf' | 'doc' | 'slides' | 'sheet' | 'image' | 'video' | 'archive' | 'file' {
  const m = mime ?? ''
  const ext = (name ?? '').split('.').pop()?.toLowerCase()
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (m.includes('wordprocessingml') || ext === 'docx') return 'doc'
  if (m.includes('presentationml') || ext === 'pptx') return 'slides'
  if (m.includes('spreadsheetml') || ext === 'xlsx') return 'sheet'
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('video/')) return 'video'
  if (m.includes('zip') || ext === 'zip') return 'archive'
  return 'file'
}
