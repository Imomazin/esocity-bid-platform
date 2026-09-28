'use client'

import { CheckIcon, CoinsIcon, Loader2Icon, TagIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Notice } from '@/components/ui/misc'
import { api, ApiError, newIdempotencyKey } from '@/lib/client/api'
import { emit } from '@/lib/client/events'
import { formatMinor } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { BidPackageView } from '@/server/views'

interface CodeResult {
  code: string
  valid: boolean
  message: string
  discountMinor: number
  bonusCredits: number
}

const METHODS = [
  { id: 'DEMO_CARD', label: 'Demo card', description: 'Simulated approval' },
  { id: 'DEMO_WALLET', label: 'Demo wallet', description: 'Simulated approval' },
  { id: 'DEMO_DECLINE', label: 'Simulate decline', description: 'See how failures are handled' },
] as const

export function BidPackPurchase({
  packages,
  signedIn,
  budgetRemainingMinor,
}: {
  packages: BidPackageView[]
  signedIn: boolean
  budgetRemainingMinor: number | null
}) {
  const router = useRouter()
  const [selected, setSelected] = useState(
    packages.find((pack) => pack.badge === 'Most popular')?.id ?? packages[0]?.id,
  )
  const [code, setCode] = useState('')
  const [codeResult, setCodeResult] = useState<CodeResult | null>(null)
  const [method, setMethod] = useState<(typeof METHODS)[number]['id']>('DEMO_CARD')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const key = useRef<string | null>(null)
  const pack = packages.find((item) => item.id === selected)

  const checkCode = async () => {
    if (!code.trim() || !pack) return
    try {
      setCodeResult(
        await api<CodeResult>('/api/promotions/validate', {
          body: { code, context: 'BID_PACK', packageId: pack.id },
        }),
      )
    } catch (caught) {
      setCodeResult({
        code,
        valid: false,
        message: caught instanceof ApiError ? caught.message : 'Could not check this code.',
        discountMinor: 0,
        bonusCredits: 0,
      })
    }
  }

  const buy = async () => {
    if (!pack) return
    if (!signedIn) {
      router.push('/demo')
      return
    }
    setPending(true)
    setError(null)
    key.current ??= newIdempotencyKey()
    try {
      const result = await api<{ walletAvailable: number; order: { reference: string } }>(
        `/api/wallet/packages/${pack.id}/purchase`,
        {
          body: { promoCode: codeResult?.valid ? codeResult.code : null, paymentMethod: method },
          idempotencyKey: key.current,
        },
      )
      key.current = null
      emit('wallet:balance', { available: result.walletAvailable })
      toast.success(`${pack.name} pack added`, {
        description: `Order ${result.order.reference} · simulated payment. Balance: ${result.walletAvailable} bids.`,
      })
      router.refresh()
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null
      if (apiError?.code !== 'NETWORK') key.current = null
      setError(apiError?.message ?? 'The purchase could not be completed.')
    } finally {
      setPending(false)
    }
  }

  const total = pack ? pack.priceMinor - (codeResult?.valid ? codeResult.discountMinor : 0) : 0
  const overBudget = budgetRemainingMinor !== null && total > budgetRemainingMinor
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <fieldset>
        <legend className="sr-only">Choose a bid pack</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {packages.map((item) => {
            const active = item.id === selected
            return (
              <label
                key={item.id}
                className={cn(
                  'relative flex cursor-pointer flex-col gap-4 rounded-2xl border-2 bg-card p-5 shadow-card transition focus-within:ring-2 focus-within:ring-ring',
                  active
                    ? 'border-brand'
                    : 'border-transparent ring-1 ring-border hover:ring-foreground/20',
                )}
              >
                <input
                  type="radio"
                  name="pack"
                  value={item.id}
                  checked={active}
                  onChange={() => setSelected(item.id)}
                  className="sr-only"
                />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  {active ? (
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                      <CheckIcon className="size-4" aria-hidden />
                    </span>
                  ) : null}
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="tabular flex items-center gap-1.5 text-3xl font-semibold tracking-tight">
                      <CoinsIcon className="size-6 text-brand" aria-hidden />
                      {item.credits.toLocaleString('en-GB')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.bonusCredits
                        ? `+ ${item.bonusCredits} bonus bids (promotional, 90 days)`
                        : 'No bonus bids'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-lg font-semibold">{formatMinor(item.priceMinor)}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {(item.pricePerCreditMinor / 100).toLocaleString('en-GB', {
                        style: 'currency',
                        currency: 'GBP',
                        minimumFractionDigits: 3,
                      })}{' '}
                      per bid
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {item.badge ? <Badge variant="brand">{item.badge}</Badge> : null}
                  {item.bestValue ? <Badge variant="success">Best value per bid</Badge> : null}
                </div>
              </label>
            )
          })}
        </div>
      </fieldset>
      <aside className="space-y-4 rounded-2xl border bg-card p-5 shadow-card lg:sticky lg:top-24 lg:self-start">
        <h2 className="font-semibold">Summary</h2>
        <div className="space-y-1.5">
          <Label htmlFor="pack-code">Promotion code</Label>
          <div className="flex gap-2">
            <Input
              id="pack-code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="e.g. BIDS20"
            />
            <Button type="button" variant="outline" onClick={checkCode}>
              <TagIcon /> Apply
            </Button>
          </div>
          {codeResult ? (
            <p className={cn('text-xs', codeResult.valid ? 'text-success' : 'text-danger')}>
              {codeResult.message}
            </p>
          ) : null}
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Payment (simulated)</legend>
          {METHODS.map((item) => (
            <label
              key={item.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm',
                method === item.id && 'border-foreground',
              )}
            >
              <input
                type="radio"
                name="method"
                value={item.id}
                checked={method === item.id}
                onChange={() => setMethod(item.id)}
                className="accent-[var(--brand)]"
              />
              <span className="flex-1">{item.label}</span>
              <span className="text-xs text-muted-foreground">{item.description}</span>
            </label>
          ))}
          <p className="text-[11px] text-muted-foreground">
            No card details are collected in this demo.
          </p>
        </fieldset>
        {pack ? (
          <dl className="space-y-1.5 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{pack.name} pack</dt>
              <dd className="tabular">{formatMinor(pack.priceMinor)}</dd>
            </div>
            {codeResult?.valid && codeResult.discountMinor ? (
              <div className="flex justify-between text-success">
                <dt>Discount</dt>
                <dd className="tabular">−{formatMinor(codeResult.discountMinor)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Bids credited</dt>
              <dd className="tabular">
                {pack.credits} +{' '}
                {pack.bonusCredits + (codeResult?.valid ? codeResult.bonusCredits : 0)} bonus
              </dd>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular">{formatMinor(total)}</dd>
            </div>
          </dl>
        ) : null}
        {overBudget ? (
          <Notice tone="warning">
            This exceeds your remaining monthly bid budget ({formatMinor(budgetRemainingMinor ?? 0)}
            ). The purchase will be declined.
          </Notice>
        ) : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button
          variant="brand"
          size="lg"
          className="w-full"
          onClick={buy}
          disabled={pending || !pack}
        >
          {pending ? <Loader2Icon className="animate-spin" /> : <CoinsIcon />}
          {signedIn ? `Buy ${pack?.name ?? ''} pack` : 'Enter demo to buy'}
        </Button>
      </aside>
    </div>
  )
}
