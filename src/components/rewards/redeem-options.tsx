'use client'

import { CoinsIcon, Loader2Icon, TicketIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { api, ApiError, newIdempotencyKey } from '@/lib/client/api'
import { emit } from '@/lib/client/events'
import { cn } from '@/lib/utils'
import type { RewardsView } from '@/server/views'

interface RedeemResult {
  balance: number
  voucherCode: string | null
  walletAvailable: number
}

export function RedeemOptions({
  options,
  balance,
}: {
  options: RewardsView['redemptions']
  balance: number
}) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [voucher, setVoucher] = useState<string | null>(null)

  const redeem = async (optionId: string, label: string) => {
    setPending(optionId)
    try {
      const result = await api<RedeemResult>('/api/rewards/redeem', {
        body: { optionId },
        idempotencyKey: newIdempotencyKey(),
      })
      emit('wallet:balance', { available: result.walletAvailable })
      if (result.voucherCode) setVoucher(result.voucherCode)
      toast.success(`Redeemed: ${label}`, {
        description: result.voucherCode
          ? `Your voucher code is ${result.voucherCode}.`
          : `Points balance: ${result.balance.toLocaleString('en-GB')}.`,
      })
      router.refresh()
    } catch (caught) {
      toast.error(
        caught instanceof ApiError ? caught.message : 'That reward could not be redeemed.',
      )
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-3">
      {voucher ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-success bg-success-soft px-4 py-3 text-sm text-success-foreground">
          <TicketIcon className="size-5 shrink-0" aria-hidden />
          <span>
            Voucher <strong className="font-mono tracking-wider">{voucher}</strong> is ready — use
            it at checkout within 90 days.
          </span>
        </div>
      ) : null}
      <ul className="divide-y rounded-xl border">
        {options.map((option) => {
          const shortfall = Math.max(0, option.points - balance)
          return (
            <li key={option.id} className="flex items-center gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-soft-foreground">
                {option.voucherMinor ? (
                  <TicketIcon className="size-4" aria-hidden />
                ) : (
                  <CoinsIcon className="size-4" aria-hidden />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{option.label}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
                <p className="tabular mt-1 text-xs font-semibold">
                  {option.points.toLocaleString('en-GB')} points
                </p>
              </div>
              <Button
                size="sm"
                className={cn('shrink-0', !option.affordable && 'text-muted-foreground')}
                variant={option.affordable ? 'primary' : 'outline'}
                disabled={!option.affordable || pending !== null}
                onClick={() => redeem(option.id, option.label)}
              >
                {pending === option.id ? <Loader2Icon className="animate-spin" /> : null}
                {option.affordable ? 'Redeem' : `${shortfall.toLocaleString('en-GB')} to go`}
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
