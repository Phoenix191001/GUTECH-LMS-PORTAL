'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Paperclip, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, Textarea } from '@/components/ui/form'
import { Progress } from '@/components/ui/feedback'
import { FileDropzone } from '@/components/shared/file-dropzone'
import { createClient } from '@/lib/supabase/client'
import { uploadToSignedUrl } from '@/lib/upload'
import { createSubmissionUpload, submitAssignment } from '../actions'

/**
 * Student submission: text and/or a file (max 25 MB). Resubmitting before the deadline
 * replaces the earlier work. The server clock makes the final on-time/late/closed decision.
 */
export function SubmitForm({
  assignmentId,
  existingText,
  existingFileName,
  isResubmit,
}: {
  assignmentId: string
  existingText: string | null
  existingFileName: string | null
  isResubmit: boolean
}) {
  const router = useRouter()
  const [text, setText] = useState(existingText ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!text.trim() && !file && !existingFileName) {
      setError('Add some text or a file before submitting.')
      return
    }
    setBusy(true)
    let uploadedPath: string | null = null
    try {
      let uploaded: { path: string; fileName: string; fileSize: number; mimeType: string } | undefined
      if (file) {
        const meta = { fileName: file.name, fileSize: file.size, mimeType: file.type }
        const ticket = await createSubmissionUpload({ assignmentId, ...meta })
        if (!ticket.ok) throw new Error(ticket.error)
        setProgress(0)
        await uploadToSignedUrl('submissions', ticket.data, file, setProgress)
        uploadedPath = ticket.data.path
        uploaded = { path: ticket.data.path, ...meta }
      }
      const res = await submitAssignment({ assignmentId, textAnswer: text, file: uploaded })
      if (!res.ok) throw new Error(res.error)
      toast.success(res.data.late ? 'Submitted. It was marked as late.' : isResubmit ? 'Submission updated' : 'Submitted. Good luck!')
      setFile(null)
      router.refresh()
    } catch (err) {
      if (uploadedPath) await createClient().storage.from('submissions').remove([uploadedPath])
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field label="Your answer" htmlFor="s-text" hint="Optional if you attach a file.">
        <Textarea id="s-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} maxLength={20000} disabled={busy} />
      </Field>

      <div className="space-y-2">
        <span className="text-sm font-medium">File <span className="font-normal text-muted-foreground">(optional)</span></span>
        {existingFileName && !file && (
          <p className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2.5 text-sm">
            <Paperclip className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{existingFileName}</span>
            <span className="text-xs text-muted-foreground">Upload a new file to replace it</span>
          </p>
        )}
        <FileDropzone bucket="submissions" file={file} onChange={setFile} disabled={busy} id="s-file" />
        {progress !== null && (
          <div className="space-y-1">
            <Progress value={progress} />
            <p className="text-xs text-muted-foreground" aria-live="polite">Uploading… {progress}%</p>
          </div>
        )}
      </div>

      {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}

      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={busy}>
        <Send /> {isResubmit ? 'Update submission' : 'Submit assignment'}
      </Button>
    </form>
  )
}
