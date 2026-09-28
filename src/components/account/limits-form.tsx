'use client'

import { ClockIcon, CoffeeIcon, Loader2Icon, ShieldCheckIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type * as React from 'react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FieldHint, Input, Label } from '@/components/ui/input'
import { Notice } from '@/components/ui/misc'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import type { LimitField } from '@/domain/responsible-use'
import { api, ApiError } from '@/lib/client/api'
import { formatMinor } from '@/lib/money'
import { formatDateTime } from '@/lib/time'
import type { LimitsView } from '@/server/views'

const FIELD_LABELS: Record<LimitField, string> = {
  dailyBidLimit: 'Daily bid limit',
  weeklyBidLimit: 'Weekly bid limit',
  monthlyBidPurchaseBudgetMinor: 'Monthly bid pack budget',
}

type Draft = { dailyBidLimit: string; weeklyBidLimit: string; monthlyBudgetPounds: string }
type LimitsResult = LimitsView & { appliedNow: string[]; scheduled: string[] }

function toDraft(view: LimitsView): Draft {
  return {
    dailyBidLimit: view.limits.dailyBidLimit?.toString() ?? '',
    weeklyBidLimit: view.limits.weeklyBidLimit?.toString() ?? '',
    monthlyBudgetPounds:
      view.limits.monthlyBidPurchaseBudgetMinor !== null
        ? (view.limits.monthlyBidPurchaseBudgetMinor / 100).toString()
        : '',
  }
}

function parseWhole(value: string): number | null | 'invalid' {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d+$/.test(trimmed)) return 'invalid'
  return Number.parseInt(trimmed, 10)
}

/** Parses a pounds amount ("40", "39.99", "£40") into integer pence without floating point. */
function parsePounds(value: string): number | null | 'invalid' {
  const trimmed = value.trim().replace(/^£/, '')
  if (!trimmed) return null
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return 'invalid'
  const [whole = '0', fraction = ''] = trimmed.split('.')
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, '0'), 10)
}

function UsageBar({
  label,
  used,
  limit,
  format,
}: {
  label: string
  used: number
  limit: number | null
  format: (value: number) => string
}) {
  const ratio = limit ? used / limit : 0
  return (
    <div>
      <div className="mb-1.5 flex justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular font-medium">
          {format(used)}
          {limit !== null ? ` of ${format(limit)}` : ' · no limit'}
        </span>
      </div>
      <Progress
        value={limit ? Math.min(used, limit) : 0}
        max={limit ?? 1}
        label={label}
        indicatorClassName={ratio >= 1 ? 'bg-danger' : ratio >= 0.8 ? 'bg-warning' : undefined}
      />
    </div>
  )
}

export function LimitsForm({ initial, now }: { initial: LimitsView; now: number }) {
  const router = useRouter()
  const [view, setView] = useState(initial)
  const [draft, setDraft] = useState(() => toDraft(initial))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [breakDays, setBreakDays] = useState<1 | 7 | 30>(7)
  const { limits, usage } = view
  const coolingOff = limits.coolOffUntil !== null && limits.coolOffUntil > now

  const submit = async (
    body: Record<string, unknown>,
    success: (result: LimitsResult) => string,
  ) => {
    setPending(true)
    setError(null)
    try {
      const result = await api<LimitsResult>('/api/account/limits', { method: 'PUT', body })
      setView(result)
      setDraft(toDraft(result))
      toast.success(success(result))
      router.refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Your limits could not be saved.')
    } finally {
      setPending(false)
    }
  }

  const saveLimits = (event: React.FormEvent) => {
    event.preventDefault()
    const daily = parseWhole(draft.dailyBidLimit)
    const weekly = parseWhole(draft.weeklyBidLimit)
    const budget = parsePounds(draft.monthlyBudgetPounds)
    if (daily === 'invalid' || weekly === 'invalid' || budget === 'invalid') {
      setError(
        'Use whole numbers for bid limits and a pounds amount (e.g. 40 or 39.99) for the budget.',
      )
      return
    }
    const body: Record<string, number | null> = {}
    if (daily !== limits.dailyBidLimit) body.dailyBidLimit = daily
    if (weekly !== limits.weeklyBidLimit) body.weeklyBidLimit = weekly
    if (budget !== limits.monthlyBidPurchaseBudgetMinor) body.monthlyBidPurchaseBudgetMinor = budget
    if (Object.keys(body).length === 0) {
      toast('No changes to save')
      return
    }
    void submit(body, (result) => {
      const parts: string[] = []
      if (result.appliedNow.length) parts.push('Lower limits apply now')
      if (result.scheduled.length) parts.push('increases take effect in 24 hours')
      return parts.join('; ') || 'Limits saved'
    })
  }

  const text = (name: keyof Draft) => ({
    value: draft[name],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      setDraft((current) => ({ ...current, [name]: event.target.value })),
  })

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl bg-muted/50 p-4 sm:grid-cols-3">
        <UsageBar
          label="Bids today"
          used={usage.bidCreditsToday}
          limit={limits.dailyBidLimit}
          format={(value) => value.toLocaleString('en-GB')}
        />
        <UsageBar
          label="Bids this week"
          used={usage.bidCreditsThisWeek}
          limit={limits.weeklyBidLimit}
          format={(value) => value.toLocaleString('en-GB')}
        />
        <UsageBar
          label="Bid packs this month"
          used={usage.bidPackSpendThisMonthMinor}
          limit={limits.monthlyBidPurchaseBudgetMinor}
          format={(value) => formatMinor(value, 'GBP', { trimZeroMinor: true })}
        />
      </div>

      {coolingOff && limits.coolOffUntil ? (
        <Notice tone="warning" icon={<CoffeeIcon />} title="You’re taking a break">
          Bidding and bid pack purchases are paused until {formatDateTime(limits.coolOffUntil)}. A
          break can be extended but not shortened.
        </Notice>
      ) : null}

      {view.pending.length > 0 ? (
        <Notice tone="neutral" icon={<ClockIcon />} title="Scheduled changes">
          <ul className="space-y-0.5">
            {view.pending.map((change) => (
              <li key={change.field}>
                {FIELD_LABELS[change.field]} →{' '}
                {change.value === null
                  ? 'no limit'
                  : change.field === 'monthlyBidPurchaseBudgetMinor'
                    ? formatMinor(change.value)
                    : `${change.value} bids`}{' '}
                from {formatDateTime(change.effectiveAt)}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <form onSubmit={saveLimits} className="space-y-4" aria-label="Spending and bidding limits">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="limit-daily">Daily bid limit</Label>
            <Input
              id="limit-daily"
              inputMode="numeric"
              placeholder="No limit"
              {...text('dailyBidLimit')}
            />
            <FieldHint>Bid credits per day</FieldHint>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="limit-weekly">Weekly bid limit</Label>
            <Input
              id="limit-weekly"
              inputMode="numeric"
              placeholder="No limit"
              {...text('weeklyBidLimit')}
            />
            <FieldHint>Bid credits per week (Mon–Sun)</FieldHint>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="limit-budget">Monthly bid pack budget (£)</Label>
            <Input
              id="limit-budget"
              inputMode="decimal"
              placeholder="No limit"
              {...text('monthlyBudgetPounds')}
            />
            <FieldHint>Maximum spent on bid packs</FieldHint>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Lowering or adding a limit applies immediately. Raising or removing a limit takes effect
          after 24 hours, so decisions aren’t made in the heat of the moment.
        </p>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <ShieldCheckIcon />} Save limits
        </Button>
      </form>

      <div className="space-y-3 border-t pt-5">
        <p className="text-sm font-medium">Alerts</p>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span id="alert-spending">
            Spending alerts
            <span className="block text-xs text-muted-foreground">
              At 50%, 80% and 100% of your monthly budget
            </span>
          </span>
          <Switch
            checked={limits.spendingNotifications}
            disabled={pending}
            onCheckedChange={(checked) =>
              void submit({ spendingNotifications: checked }, () =>
                checked ? 'Spending alerts on' : 'Spending alerts off',
              )
            }
            aria-labelledby="alert-spending"
          />
        </div>
        <div className="flex items-center justify-between gap-4 text-sm">
          <span id="alert-bids">
            Bid usage alerts
            <span className="block text-xs text-muted-foreground">
              At 50%, 80% and 100% of your daily and weekly bid limits
            </span>
          </span>
          <Switch
            checked={limits.bidUseNotifications}
            disabled={pending}
            onCheckedChange={(checked) =>
              void submit({ bidUseNotifications: checked }, () =>
                checked ? 'Bid usage alerts on' : 'Bid usage alerts off',
              )
            }
            aria-labelledby="alert-bids"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <CoffeeIcon className="size-4 text-muted-foreground" aria-hidden /> Take a break
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pause bidding and bid pack purchases for 24 hours, 7 days or 30 days. You can still
            browse, pay for wins and track orders.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Start a break</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Take a break from bidding</DialogTitle>
              <DialogDescription>
                During a break you can’t place bids, run AutoBid or buy bid packs. Breaks start
                immediately and cannot be shortened or cancelled.
              </DialogDescription>
            </DialogHeader>
            <fieldset className="grid grid-cols-3 gap-2">
              <legend className="sr-only">Break length</legend>
              {([1, 7, 30] as const).map((days) => (
                <label
                  key={days}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium has-[:checked]:border-foreground has-[:checked]:bg-muted has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                >
                  <input
                    type="radio"
                    name="break"
                    className="sr-only"
                    checked={breakDays === days}
                    onChange={() => setBreakDays(days)}
                  />
                  {days === 1 ? '24 hours' : `${days} days`}
                </label>
              ))}
            </fieldset>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button
                  variant="primary"
                  onClick={() =>
                    void submit({ coolOffDays: breakDays }, (result) =>
                      result.appliedNow.includes('coolOffUntil') && result.limits.coolOffUntil
                        ? `Break started until ${formatDateTime(result.limits.coolOffUntil)}`
                        : 'Your existing break already lasts longer',
                    )
                  }
                >
                  Start {breakDays === 1 ? '24-hour' : `${breakDays}-day`} break
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-xs text-muted-foreground">
        Want to talk it through? Read our{' '}
        <Link href="/responsible-use" className="underline">
          responsible use guide
        </Link>{' '}
        or get free, impartial guidance from{' '}
        <a
          href="https://www.moneyhelper.org.uk/"
          className="underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          MoneyHelper
        </a>
        .
      </p>
    </div>
  )
}
