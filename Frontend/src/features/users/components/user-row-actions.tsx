'use client'

import { useState } from 'react'
import { KeyRound, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResetPasswordDialog } from './reset-password-dialog'
import { UserDialog, type EditableUser } from './user-dialog'

export function UserRowActions({ user, isSelf }: { user: EditableUser; isSelf: boolean }) {
  const [editOpen, setEditOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil /> Edit
      </Button>
      {!isSelf && (
        <Button variant="ghost" size="sm" onClick={() => setResetOpen(true)}>
          <KeyRound /> Reset password
        </Button>
      )}
      <UserDialog user={user} isSelf={isSelf} open={editOpen} onOpenChange={setEditOpen} />
      <ResetPasswordDialog userId={user.id} userName={user.full_name} open={resetOpen} onOpenChange={setResetOpen} />
    </div>
  )
}
