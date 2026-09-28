'use client'

import { GiftIcon, Loader2Icon } from 'lucide-react'
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
import { FieldError, FieldHint, Input, Label } from '@/components/ui/input'
import { api, ApiError, newIdempotencyKey } from '@/lib/client/api'

/** Adds promotional goodwill bids as a new wallet ledger entry (history is never edited). */
export function GoodwillCredit({ userId, name }: { userId: string; name: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [credits, setCredits] = useState('10')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = useRef<string | null>(null)

  const submit = async () => {
    const amount = /^\d+$/.test(credits.trim()) ? Number.parseInt(credits, 10) : 0
    if (amount < 1 || amount > 500) return setError('Choose between 1 and 500 bids.')
    if (reason.trim().length < 3) return setError('Add a reason, e.g. a support ticket reference.')
    setPending(true)
    setError(null)
    key.current ??= newIdempotencyKey()
    try {
      await api('/api/admin/wallet/adjust', {
        body: { userId, credits: amount, reason: reason.trim() },
        idempotencyKey: key.current,
      })
      key.current = null
      toast.success(`${amount} goodwill bids added`, { description: name })
      setOpen(false)
      setReason('')
      router.refresh()
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null
      if (apiError?.code !== 'NETWORK') key.current = null
      setError(apiError?.message ?? 'The credit could not be added.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? null : setOpen(next))}>
      <DialogTrigger asChild>
        <Button size="xs" variant="ghost">
          <GiftIcon /> Goodwill
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Goodwill bids for {name}</DialogTitle>
          <DialogDescription>
            Credited as promotional bids that expire in 30 days. Requires the wallet adjustment
            permission and is audited.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="goodwill-credits">Bids</Label>
            <Input
              id="goodwill-credits"
              inputMode="numeric"
              value={credits}
              onChange={(event) => setCredits(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goodwill-reason">Reason</Label>
            <Input
              id="goodwill-reason"
              value={reason}
              maxLength={300}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. ESB-T-1042 delivery delay"
            />
            <FieldHint>Shown to the member in their notification.</FieldHint>
          </div>
        </div>
        {error ? <FieldError>{error}</FieldError> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null} Add bids
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
