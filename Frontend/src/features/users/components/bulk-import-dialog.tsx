'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/card'
import { Notice } from '@/components/ui/feedback'
import { toCsv } from '@/lib/csv'
import { importStudents, previewStudentImport, type ImportResult } from '../actions'

type Preview = Awaited<ReturnType<typeof previewStudentImport>>
type Rows = Extract<Preview, { ok: true }>['data']

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  URL.revokeObjectURL(url)
}

/** CSV (full_name,email,roll_no) -> preview with per-row errors -> create. Passwords are shown/downloaded once. */
export function BulkImportDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Rows | null>(null)
  const [results, setResults] = useState<ImportResult[] | null>(null)
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setCsv('')
    setFileName('')
    setRows(null)
    setResults(null)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    setCsv(text)
    setFileName(file.name)
    setResults(null)
    setBusy(true)
    const res = await previewStudentImport({ csv: text })
    setBusy(false)
    if (res.ok) setRows(res.data)
    else {
      setRows(null)
      toast.error(res.error)
    }
  }

  const ready = rows?.filter((r) => r.status === 'ready').length ?? 0

  const commit = async () => {
    setBusy(true)
    const res = await importStudents({ csv })
    setBusy(false)
    if (!res.ok) return void toast.error(res.error)
    setResults(res.data)
    const created = res.data.filter((r) => r.ok).length
    toast.success(`${created} student${created === 1 ? '' : 's'} created`)
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return
        setOpen(v)
        if (!v) reset() // generated passwords are forgotten when the dialog closes
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload /> Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import students</DialogTitle>
          <DialogDescription>Upload a CSV with the columns <code>full_name,email,roll_no</code>. You can review it before anything is created.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {results ? (
            <>
              <Notice tone="warning">
                Temporary passwords are shown only now. Download the list and share each one securely. Students must change it at first sign-in.
              </Notice>
              <Button
                variant="outline"
                onClick={() =>
                  download('new-students.csv', toCsv([['full_name', 'email', 'temporary_password', 'result'], ...results.map((r) => [r.fullName, r.email, r.password ?? '', r.ok ? 'created' : (r.error ?? 'failed')])]))
                }
              >
                <Download /> Download credentials (CSV)
              </Button>
              <ResultList results={results} />
            </>
          ) : (
            <>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition hover:border-primary/60 hover:bg-muted/50">
                <FileSpreadsheet className="size-7 text-primary" />
                <span className="text-sm font-medium">{fileName || 'Choose a CSV file'}</span>
                <span className="text-xs text-muted-foreground">Up to 300 rows</span>
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
              </label>
              {rows && (
                <>
                  <p className="text-sm" aria-live="polite">
                    <strong>{ready}</strong> ready · <strong>{rows.length - ready}</strong> with problems
                  </p>
                  <ul className="max-h-72 divide-y overflow-y-auto rounded-xl border text-sm">
                    {rows.map((r) => (
                      <li key={r.line} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{r.fullName || '(no name)'}</span>
                          <span className="block truncate text-xs text-muted-foreground">{r.email}{r.rollNo ? ` · ${r.rollNo}` : ''}</span>
                        </span>
                        {r.status === 'ready' ? <Badge tone="success">Ready</Badge> : <Badge tone="danger" title={r.message}>{r.message}</Badge>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          {results ? (
            <Button onClick={() => { setOpen(false); reset() }}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={commit} loading={busy} disabled={ready === 0}>
                Create {ready || ''} student{ready === 1 ? '' : 's'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResultList({ results }: { results: ImportResult[] }) {
  return (
    <ul className="max-h-72 divide-y overflow-y-auto rounded-xl border text-sm">
      {results.map((r) => (
        <li key={r.line} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <span className="min-w-0">
            <span className="block truncate font-medium">{r.fullName}</span>
            <span className="block truncate text-xs text-muted-foreground">{r.email}</span>
          </span>
          {r.ok ? <Badge tone="success">Created</Badge> : <Badge tone="danger">{r.error}</Badge>}
        </li>
      ))}
    </ul>
  )
}
