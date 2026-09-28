'use client'

import { Loader2Icon, RotateCcwIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FieldError, FieldHint, Input, Label, Textarea } from '@/components/ui/input'
import { api, ApiError, newIdempotencyKey } from '@/lib/client/api'
import { minorToInput, parsePoundsInput } from '@/lib/client/money-input'
import { formatMinor } from '@/lib/money'

/**
 * Full or partial refund. The idempotency key is kept across retries of the same attempt, so a
 * double-click or network retry can never refund twice.
 */
export function RefundForm({
  orderId,
  reference,
  refundableMinor,
}: {
  orderId: string
  reference: string
  refundableMinor: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(minorToInput(refundableMinor))
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = useRef<string | null>(null)

  const submit = async () => {
    const parsed = parsePoundsInput(amount)
    if (typeof parsed !== 'number' || parsed <= 0 || parsed > refundableMinor) {
      setError(`Enter an amount up to ${formatMinor(refundableMinor)}.`)
      return
    }
    if (reason.trim().length < 3) {
      setError('Add a reason for the refund.')
      return
    }
    setPending(true)
    setError(null)
    key.current ??= newIdempotencyKey()
    try {
      await api(`/api/admin/orders/${orderId}/refund`, {
        body: {
          amountMinor: parsed === refundableMinor ? undefined : parsed,
          reason: reason.trim(),
        },
        idempotencyKey: key.current,
      })
      key.current = null
      toast.success(`Refunded ${formatMinor(parsed)}`, {
        description: `${reference} · simulated in demo mode`,
      })
      setOpen(false)
      router.refresh()
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null
      if (apiError?.code !== 'NETWORK') key.current = null
      setError(apiError?.message ?? 'The refund could not be processed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? null : setOpen(next))}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={refundableMinor <= 0}>
          <RotateCcwIcon /> Refund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund {reference}</DialogTitle>
          <DialogDescription>
            Up to {formatMinor(refundableMinor)} can be refunded to the original payment method.
            Recorded in the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="refund-amount">Amount (£)</Label>
            <Input
              id="refund-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <FieldHint>A full refund also moves the order to Refunded.</FieldHint>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="refund-reason">Reason</Label>
            <Textarea
              id="refund-reason"
              rows={3}
              maxLength={300}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Item arrived damaged"
            />
          </div>
        </div>
        {error ? <FieldError>{error}</FieldError> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null} Issue refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
