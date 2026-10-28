'use client'

import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Notice } from '@/components/ui/feedback'
import { CopyButton } from '@/components/shared/copy-button'
import { adminResetPassword } from '../actions'

/**
 * Generates a temporary password for another user. It is shown exactly once (never stored
 * or logged); the user must change it at next sign-in.
 */
export function ResetPasswordDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: {
  userId: string
  userName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState<string | null>(null)

  const close = (v: boolean) => {
    if (busy) return
    onOpenChange(v)
    if (!v) setPassword(null) // forget the secret as soon as the dialog closes
  }

  const generate = async () => {
    setBusy(true)
    const res = await adminResetPassword({ id: userId })
    setBusy(false)
    if (res.ok) setPassword(res.data.password)
    else toast.error(res.error)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>{userName}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {password ? (
            <>
              <Notice tone="warning">This password is shown only once. Copy it now and share it securely. {userName} must change it at next sign-in.</Notice>
              <div className="flex items-center gap-2 rounded-xl border bg-muted/50 p-3">
                <code className="min-w-0 flex-1 select-all break-all font-mono text-base" data-testid="temp-password">{password}</code>
                <CopyButton value={password} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This creates a new temporary password and signs the account out of the old one. {userName} will be asked to choose a new password the next time they sign in.
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          {password ? (
            <Button onClick={() => close(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)} disabled={busy}>Cancel</Button>
              <Button onClick={generate} loading={busy}>
                <KeyRound /> Generate temporary password
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
