'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { FileSpreadsheet, Search, UserMinus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Checkbox, Input } from '@/components/ui/form'
import { Badge } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { enrollStudents, importEnrollmentsCsv, previewEnrollmentCsv, removeEnrollment, type CsvPreview } from '../actions'

export type Candidate = { id: string; name: string; rollNo: string | null; email: string }

/** Multi-select of active students who are not enrolled yet. */
export function EnrollStudentsDialog({ courseId, candidates, truncated }: { courseId: string; candidates: Candidate[]; truncated: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? candidates.filter((c) => `${c.name} ${c.rollNo ?? ''} ${c.email}`.toLowerCase().includes(needle)) : candidates
  }, [q, candidates])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = async () => {
    setBusy(true)
    const res = await enrollStudents({ courseId, studentIds: [...selected] })
    setBusy(false)
    if (!res.ok) return void toast.error(res.error)
    toast.success(
      res.data.alreadyEnrolled > 0 ? `${res.data.added} added, ${res.data.alreadyEnrolled} already enrolled` : `${res.data.added} student${res.data.added === 1 ? '' : 's'} enrolled`,
    )
    setOpen(false)
    setSelected(new Set())
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
      <DialogTrigger asChild>
        <Button><UserPlus /> Add students</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add students</DialogTitle>
          <DialogDescription>Active students who are not in this course yet.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" aria-label="Search students" placeholder="Search name, roll number or email" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground" aria-live="polite">{selected.size} selected</span>
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id)))}
            >
              {selected.size === filtered.length && filtered.length > 0 ? 'Clear' : 'Select all shown'}
            </button>
          </div>
          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No students to add.</p>
          ) : (
            <ul className="max-h-80 divide-y overflow-y-auto rounded-xl border">
              {filtered.map((c) => (
                <li key={c.id}>
                  <label className={cn('flex cursor-pointer items-center gap-3 px-3.5 py-3 transition-colors hover:bg-muted/50', selected.has(c.id) && 'bg-primary-soft/60')}>
                    <Checkbox checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{c.rollNo ? `${c.rollNo} · ` : ''}{c.email}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {truncated && <p className="text-xs text-muted-foreground">Showing the first {candidates.length} students. Use search or the CSV import for others.</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} loading={busy} disabled={selected.size === 0}>Enrol {selected.size || ''}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** CSV with an email or roll_no column -> preview in three groups -> commit after confirmation. */
export function EnrollCsvDialog({ courseId }: { courseId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<CsvPreview | null>(null)
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setCsv('')
    setFileName('')
    setPreview(null)
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    setCsv(text)
    setFileName(file.name)
    setBusy(true)
    const res = await previewEnrollmentCsv({ courseId, csv: text })
    setBusy(false)
    if (res.ok) setPreview(res.data)
    else {
      setPreview(null)
      toast.error(res.error)
    }
  }

  const commit = async () => {
    setBusy(true)
    const res = await importEnrollmentsCsv({ courseId, csv })
    setBusy(false)
    if (!res.ok) return void toast.error(res.error)
    toast.success(`${res.data.added} enrolled · ${res.data.alreadyEnrolled} already enrolled · ${res.data.notFound} not found`)
    setOpen(false)
    reset()
    router.refresh()
  }

  const groups = preview
    ? ([
        ['Will be added', preview.willAdd, 'success'],
        ['Already enrolled', preview.alreadyEnrolled, 'neutral'],
        ['Not found', preview.notFound, 'danger'],
      ] as const)
    : []

  return (
    <Dialog open={open} onOpenChange={(v) => { if (busy) return; setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <Button variant="outline"><FileSpreadsheet /> Import CSV</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Enrol from CSV</DialogTitle>
          <DialogDescription>A file with a column named <code>email</code> or <code>roll_no</code>. Nothing is saved until you confirm.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition hover:border-primary/60 hover:bg-muted/50">
            <FileSpreadsheet className="size-7 text-primary" />
            <span className="text-sm font-medium">{fileName || 'Choose a CSV file'}</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {groups.map(([label, people, tone]) => (
            <section key={label} aria-label={label}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                {label} <Badge tone={tone}>{people.length}</Badge>
              </h3>
              {people.length > 0 && (
                <ul className="max-h-40 divide-y overflow-y-auto rounded-xl border text-sm">
                  {people.map((p, i) => (
                    <li key={`${p.key}-${i}`} className="px-3.5 py-2">
                      {p.name ?? p.key}
                      {p.rollNo && <span className="ml-2 text-xs text-muted-foreground">{p.rollNo}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={commit} loading={busy} disabled={!preview || preview.willAdd.length === 0}>
            Enrol {preview?.willAdd.length || ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RemoveEnrollmentButton({ enrollmentId, name }: { enrollmentId: string; name: string }) {
  const router = useRouter()
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft">
          <UserMinus /> Remove
        </Button>
      }
      title={`Remove ${name}?`}
      description="They lose access to this course immediately. Their submissions, quiz attempts and chat messages are kept and stay visible to the teacher, marked as removed."
      confirmLabel="Remove from course"
      onConfirm={async () => {
        const res = await removeEnrollment(enrollmentId)
        if (res.ok) {
          toast.success('Student removed')
          router.refresh()
        } else toast.error(res.error)
      }}
    />
  )
}
