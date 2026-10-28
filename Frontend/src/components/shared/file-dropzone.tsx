'use client'

import { useRef, useState } from 'react'
import { FileUp, X } from 'lucide-react'
import { cn, formatBytes } from '@/lib/utils'
import { BUCKET_RULES, validateFile, type BucketName } from '@/lib/files'
import { Button } from '@/components/ui/button'

/** Drag-and-drop (or click / tap) file picker with client-side size and type checks. */
export function FileDropzone({
  bucket,
  file,
  onChange,
  disabled,
  id = 'file',
  label = 'Drop a file here, or browse',
}: {
  bucket: BucketName
  file: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
  id?: string
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rule = BUCKET_RULES[bucket]

  const accept = (candidate: File | undefined) => {
    if (!candidate) return
    const problem = validateFile(bucket, { name: candidate.name, size: candidate.size, type: candidate.type })
    setError(problem)
    if (!problem) onChange(candidate)
  }

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-soft-foreground">
          <FileUp className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove file" disabled={disabled} onClick={() => onChange(null)}>
          <X />
        </Button>
      </div>
    )
  }

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          if (!disabled) accept(e.dataTransfer.files[0])
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-card px-4 py-8 text-center transition-colors',
          over ? 'border-primary bg-primary-soft' : 'border-input hover:border-primary/60 hover:bg-muted/50',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        <span className="grid size-11 place-items-center rounded-full bg-primary-soft text-primary-soft-foreground">
          <FileUp className="size-5" />
        </span>
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{rule.label}</span>
        <input
          ref={inputRef}
          id={id}
          type="file"
          className="sr-only"
          disabled={disabled}
          accept={Object.keys(rule.mimes).join(',')}
          onChange={(e) => {
            accept(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </label>
      {error && (
        <p role="alert" className="mt-2 text-[0.8125rem] text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
