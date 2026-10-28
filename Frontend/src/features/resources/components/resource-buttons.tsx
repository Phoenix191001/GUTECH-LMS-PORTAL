'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ExternalLink, Download, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { deleteResource, openResource } from '../actions'
import { ResourceDialog, type EditableResource } from './resource-dialog'

/** Opens a resource in a new tab. Marks it seen (students) and always asks for a fresh signed URL. */
export function OpenResourceButton({ id, kind }: { id: string; kind: 'file' | 'link' }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const open = async () => {
    // Open the tab synchronously so popup blockers allow it, then point it at the URL.
    const tab = window.open('about:blank', '_blank')
    setBusy(true)
    const res = await openResource(id)
    setBusy(false)
    if (!res.ok) {
      tab?.close()
      toast.error(res.error)
      return
    }
    if (tab) {
      tab.opener = null
      tab.location.href = res.data.url
    } else {
      window.location.href = res.data.url
    }
    router.refresh() // clears the "New" badge
  }

  return (
    <Button size="sm" variant="outline" onClick={open} loading={busy}>
      {kind === 'link' ? <ExternalLink /> : <Download />}
      {kind === 'link' ? 'Open link' : 'Open'}
    </Button>
  )
}

export function ResourceMenu({ courseId, resource }: { courseId: string; resource: EditableResource }) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${resource.title}`}>
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResourceDialog courseId={courseId} resource={resource} open={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this resource?"
        description={`"${resource.title}" and its file will be removed for everyone, including the record of who has seen it.`}
        confirmLabel="Delete resource"
        onConfirm={async () => {
          const res = await deleteResource(resource.id)
          if (res.ok) {
            toast.success('Resource deleted')
            router.refresh()
          } else toast.error(res.error)
        }}
      />
    </>
  )
}
