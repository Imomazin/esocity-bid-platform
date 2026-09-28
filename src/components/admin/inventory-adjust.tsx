'use client'

import { Loader2Icon, SlidersHorizontalIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
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
import { FieldError, FieldHint, Input, Label, NativeSelect } from '@/components/ui/input'
import { api, ApiError } from '@/lib/client/api'

const REASONS = [
  'Cycle count correction',
  'Damaged in warehouse',
  'Supplier short delivery',
  'Customer return restocked',
  'Found stock',
]

/** Records a manual stock adjustment as an inventory ledger event (never edits history). */
export function InventoryAdjust({
  productId,
  productName,
  available,
}: {
  productId: string
  productName: string
  available: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState(REASONS[0]!)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const parsed = /^-?\d+$/.test(quantity.trim()) ? Number.parseInt(quantity, 10) : null

  const submit = async () => {
    if (parsed === null || parsed === 0) {
      setError('Enter a non-zero whole number, e.g. 5 or -2.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await api('/api/admin/inventory/adjust', { body: { productId, quantity: parsed, reason } })
      toast.success(`Stock adjusted by ${parsed > 0 ? '+' : ''}${parsed}`, {
        description: productName,
      })
      setOpen(false)
      setQuantity('')
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'The adjustment could not be recorded.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs" aria-label={`Adjust stock for ${productName}`}>
          <SlidersHorizontalIcon /> Adjust
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {productName} · {available} available now
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="adjust-quantity">Change (units)</Label>
            <Input
              id="adjust-quantity"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              placeholder="e.g. 5 or -2"
              autoFocus
            />
            <FieldHint>
              {parsed !== null && parsed !== 0
                ? `New available: ${available + parsed}`
                : 'Positive adds, negative removes.'}
            </FieldHint>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjust-reason">Reason</Label>
            <NativeSelect
              id="adjust-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              {REASONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </NativeSelect>
          </div>
        </div>
        {error ? <FieldError>{error}</FieldError> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null} Record adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
