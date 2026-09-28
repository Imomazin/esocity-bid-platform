'use client'

import { Loader2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type * as React from 'react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button, type ButtonProps } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldError, FieldHint, Label, Textarea } from '@/components/ui/input'
import { api, ApiError, newIdempotencyKey } from '@/lib/client/api'

export interface AdminActionProps extends Omit<ButtonProps, 'onClick'> {
  endpoint: string
  method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: Record<string, unknown>
  /** When set, a dialog asks for confirmation (and optionally a reason) before submitting. */
  confirm?: {
    title: string
    description?: string
    confirmLabel?: string
    danger?: boolean
    /** Name of the body field that receives the operator's reason, e.g. "reason" or "note". */
    reasonField?: string
    reasonLabel?: string
    reasonRequired?: boolean
  }
  successMessage: string
  idempotent?: boolean
  children: React.ReactNode
}

/**
 * A button that performs one operator mutation against the admin API, then refreshes the page.
 * Errors from the server (permissions, locked fields, invalid transitions) are shown verbatim.
 */
export function AdminAction({
  endpoint,
  method = 'POST',
  body,
  confirm,
  successMessage,
  idempotent,
  children,
  ...buttonProps
}: AdminActionProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = useRef<string | null>(null)

  const submit = async () => {
    setPending(true)
    setError(null)
    if (idempotent) key.current ??= newIdempotencyKey()
    try {
      await api(endpoint, {
        method,
        body: {
          ...(body ?? {}),
          ...(confirm?.reasonField ? { [confirm.reasonField]: reason.trim() } : {}),
        },
        idempotencyKey: idempotent ? (key.current ?? undefined) : undefined,
      })
      key.current = null
      toast.success(successMessage)
      setOpen(false)
      setReason('')
      router.refresh()
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null
      if (apiError?.code !== 'NETWORK') key.current = null
      const message = apiError?.message ?? 'The action could not be completed.'
      if (confirm) setError(message)
      else toast.error(message)
    } finally {
      setPending(false)
    }
  }

  const reasonMissing =
    !!confirm?.reasonField && (confirm.reasonRequired ?? true) && reason.trim().length < 5
  return (
    <>
      <Button
        {...buttonProps}
        disabled={pending || buttonProps.disabled}
        onClick={() => (confirm ? setOpen(true) : void submit())}
      >
        {pending && !confirm ? <Loader2Icon className="animate-spin" /> : null}
        {children}
      </Button>
      {confirm ? (
        <Dialog open={open} onOpenChange={(next) => (pending ? null : setOpen(next))}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirm.title}</DialogTitle>
              {confirm.description ? (
                <DialogDescription>{confirm.description}</DialogDescription>
              ) : null}
            </DialogHeader>
            {confirm.reasonField ? (
              <div className="space-y-1.5">
                <Label htmlFor="admin-action-reason">{confirm.reasonLabel ?? 'Reason'}</Label>
                <Textarea
                  id="admin-action-reason"
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={300}
                  autoFocus
                />
                <FieldHint>Recorded in the immutable audit log with your role.</FieldHint>
              </div>
            ) : null}
            {error ? <FieldError>{error}</FieldError> : null}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button
                variant={confirm.danger ? 'danger' : 'primary'}
                onClick={submit}
                disabled={pending || reasonMissing}
              >
                {pending ? <Loader2Icon className="animate-spin" /> : null}
                {confirm.confirmLabel ?? 'Confirm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
