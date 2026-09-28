'use client'

import { Loader2Icon, LockIcon, SaveIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type * as React from 'react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldHint, Input, Label, NativeSelect, Textarea } from '@/components/ui/input'
import { Notice } from '@/components/ui/misc'
import { Switch } from '@/components/ui/switch'
import type { AuctionRules, AuctionStatus } from '@/domain/auction/types'
import { api, ApiError } from '@/lib/client/api'
import { minorToInput, parsePoundsInput, parseWholeInput } from '@/lib/client/money-input'
import { formatMinor } from '@/lib/money'
import { cn } from '@/lib/utils'

type RuleKey = keyof AuctionRules

interface ProductOption {
  id: string
  name: string
  referencePriceMinor: number
  available: number
}

interface Draft {
  productId: string
  title: string
  description: string
  featured: boolean
  startsAt: string
  schedule: boolean
  startingPrice: string
  increment: string
  bidCreditCost: string
  timerMinutes: string
  extensionSeconds: string
  hardStopMinutes: string
  minimumParticipants: string
  maximumParticipants: string
  reservePrice: string
  buyNowEnabled: boolean
  buyNowPrice: string
  recoveryEnabled: boolean
  recoveryMode: AuctionRules['recoveryMode']
  recoveryWindowHours: string
  recoverPromotionalBids: boolean
  paymentWindowHours: string
  perUserBidLimit: string
  autoBidEnabled: boolean
  preventSelfOutbid: boolean
  minimumTier: string
  maxPreviousWins: string
  minimumAccountAgeDays: string
  minimumAge: string
}

function toLocalInput(epochMs: number): string {
  const date = new Date(epochMs)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function draftFrom(
  rules: AuctionRules,
  meta: {
    productId: string
    title: string
    description: string
    featured: boolean
    startsAt: number
  },
): Draft {
  return {
    productId: meta.productId,
    title: meta.title,
    description: meta.description,
    featured: meta.featured,
    startsAt: toLocalInput(meta.startsAt),
    schedule: true,
    startingPrice: minorToInput(rules.startingPriceMinor),
    increment: minorToInput(rules.bidIncrementMinor),
    bidCreditCost: String(rules.bidCreditCost),
    timerMinutes: String(Math.round(rules.timerSeconds / 60)),
    extensionSeconds: String(rules.timerExtensionSeconds),
    hardStopMinutes: rules.hardStopAfterSeconds
      ? String(Math.round(rules.hardStopAfterSeconds / 60))
      : '',
    minimumParticipants: String(rules.minimumParticipants),
    maximumParticipants: rules.maximumParticipants?.toString() ?? '',
    reservePrice: minorToInput(rules.reservePriceMinor),
    buyNowEnabled: rules.buyNowEnabled,
    buyNowPrice: minorToInput(rules.buyNowPriceMinor),
    recoveryEnabled: rules.bidCreditRecoveryEnabled,
    recoveryMode: rules.recoveryMode,
    recoveryWindowHours: String(rules.recoveryWindowHours),
    recoverPromotionalBids: rules.recoverPromotionalBids,
    paymentWindowHours: String(rules.winnerPaymentWindowHours),
    perUserBidLimit: rules.perUserBidLimit?.toString() ?? '',
    autoBidEnabled: rules.autoBidEnabled,
    preventSelfOutbid: rules.preventSelfOutbid,
    minimumTier: rules.eligibility.minimumTier ?? '',
    maxPreviousWins: rules.eligibility.maxPreviousWins?.toString() ?? '',
    minimumAccountAgeDays: rules.eligibility.minimumAccountAgeDays?.toString() ?? '',
    minimumAge: String(rules.eligibility.minimumAge),
  }
}

/** Converts the draft into rules, or returns the first human-readable problem. */
function rulesFrom(draft: Draft, base: AuctionRules): { rules: AuctionRules } | { error: string } {
  const money = (value: string, label: string, required: boolean) => {
    const parsed = parsePoundsInput(value)
    if (parsed === 'invalid') throw new Error(`${label}: enter an amount such as 0.01 or 12.50.`)
    if (parsed === null && required) throw new Error(`${label} is required.`)
    return parsed
  }
  const whole = (value: string, label: string, required: boolean) => {
    const parsed = parseWholeInput(value)
    if (parsed === 'invalid') throw new Error(`${label}: enter a whole number.`)
    if (parsed === null && required) throw new Error(`${label} is required.`)
    return parsed
  }
  try {
    const timerMinutes = whole(draft.timerMinutes, 'Initial countdown', true)!
    const hardStop = whole(draft.hardStopMinutes, 'Hard stop', false)
    return {
      rules: {
        ...base,
        startingPriceMinor: money(draft.startingPrice, 'Starting price', true)!,
        bidIncrementMinor: money(draft.increment, 'Bid increment', true)!,
        bidCreditCost: whole(draft.bidCreditCost, 'Bid cost', true)!,
        timerSeconds: timerMinutes * 60,
        timerExtensionSeconds: whole(draft.extensionSeconds, 'Timer extension', true)!,
        hardStopAfterSeconds: hardStop === null ? null : hardStop * 60,
        minimumParticipants: whole(draft.minimumParticipants, 'Minimum participants', true)!,
        maximumParticipants: whole(draft.maximumParticipants, 'Maximum participants', false),
        reservePriceMinor: money(draft.reservePrice, 'Reserve price', false),
        buyNowEnabled: draft.buyNowEnabled,
        buyNowPriceMinor: money(draft.buyNowPrice, 'Buy Now price', false),
        bidCreditRecoveryEnabled: draft.buyNowEnabled && draft.recoveryEnabled,
        recoveryMode: draft.recoveryMode,
        recoveryWindowHours: whole(draft.recoveryWindowHours, 'Recovery window', true)!,
        recoverPromotionalBids: draft.recoverPromotionalBids,
        winnerPaymentWindowHours: whole(draft.paymentWindowHours, 'Payment window', true)!,
        perUserBidLimit: whole(draft.perUserBidLimit, 'Per-member bid limit', false),
        autoBidEnabled: draft.autoBidEnabled,
        preventSelfOutbid: draft.preventSelfOutbid,
        eligibility: {
          ...base.eligibility,
          minimumTier: draft.minimumTier
            ? (draft.minimumTier as AuctionRules['eligibility']['minimumTier'])
            : null,
          maxPreviousWins: whole(draft.maxPreviousWins, 'Maximum previous wins', false),
          minimumAccountAgeDays: whole(draft.minimumAccountAgeDays, 'Minimum account age', false),
          minimumAge: whole(draft.minimumAge, 'Minimum age', true)!,
        },
      },
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

function Field({
  label,
  hint,
  locked,
  htmlFor,
  children,
  className,
}: {
  label: string
  hint?: string
  locked?: boolean
  htmlFor: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor} className="flex items-center gap-1.5">
        {label}
        {locked ? <LockIcon className="size-3 text-muted-foreground" aria-label="Locked" /> : null}
      </Label>
      {children}
      {hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  )
}

function Toggle({
  id,
  label,
  description,
  checked,
  onChange,
  locked,
}: {
  id: string
  label: string
  description?: string
  checked: boolean
  onChange: (value: boolean) => void
  locked?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border px-4 py-3">
      <span id={`${id}-label`} className="text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          {label}
          {locked ? (
            <LockIcon className="size-3 text-muted-foreground" aria-label="Locked" />
          ) : null}
        </span>
        {description ? (
          <span className="block text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={locked}
        aria-labelledby={`${id}-label`}
      />
    </div>
  )
}

export function AuctionForm({
  mode,
  auctionId,
  status,
  products,
  initialRules,
  initialMeta,
  lockedFields = [],
}: {
  mode: 'create' | 'edit'
  auctionId?: string
  status?: AuctionStatus
  products: ProductOption[]
  initialRules: AuctionRules
  initialMeta: {
    productId: string
    title: string
    description: string
    featured: boolean
    startsAt: number
  }
  lockedFields?: RuleKey[]
}) {
  const router = useRouter()
  const [draft, setDraft] = useState(() => draftFrom(initialRules, initialMeta))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locked = useMemo(() => new Set(lockedFields), [lockedFields])
  const allLocked = mode === 'edit' && locked.size >= Object.keys(initialRules).length
  const product = products.find((item) => item.id === draft.productId)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))
  const text = (key: keyof Draft) => ({
    id: `auction-${key}`,
    value: String(draft[key]),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key, event.target.value as never),
  })
  const isLocked = (key: RuleKey) => locked.has(key)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    const parsed = rulesFrom(draft, initialRules)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
    setPending(true)
    try {
      if (mode === 'create') {
        const startsAt = new Date(draft.startsAt).getTime()
        if (!Number.isFinite(startsAt))
          throw new ApiError('VALIDATION_FAILED', 'Choose a valid start time.', 422)
        const result = await api<{ id: string; status: AuctionStatus }>('/api/admin/auctions', {
          body: {
            productId: draft.productId,
            title: draft.title.trim() || undefined,
            description: draft.description.trim() || undefined,
            featured: draft.featured,
            startsAt,
            schedule: draft.schedule,
            rules: parsed.rules,
          },
        })
        toast.success(result.status === 'SCHEDULED' ? 'Auction scheduled' : 'Draft auction created')
        router.push(`/admin/auctions/${result.id}`)
        return
      }
      // Compare against the initial rules passed through the same form conversion, so values the
      // form cannot represent exactly (e.g. a 90-second timer) are never sent as "changes".
      const baseline = rulesFrom(draftFrom(initialRules, initialMeta), initialRules)
      const baselineRules = 'rules' in baseline ? baseline.rules : initialRules
      const patch: Partial<AuctionRules> = {}
      for (const key of Object.keys(parsed.rules) as RuleKey[]) {
        if (JSON.stringify(parsed.rules[key]) !== JSON.stringify(baselineRules[key]))
          (patch as Record<string, unknown>)[key] = parsed.rules[key]
      }
      await api(`/api/admin/auctions/${auctionId}`, {
        method: 'PATCH',
        body: {
          rules: patch,
          title: draft.title.trim() !== initialMeta.title ? draft.title.trim() : undefined,
          featured: draft.featured !== initialMeta.featured ? draft.featured : undefined,
          description:
            draft.description.trim() !== initialMeta.description
              ? draft.description.trim() || null
              : undefined,
        },
      })
      toast.success('Auction updated', {
        description: `${Object.keys(patch).length} rule change(s) recorded in the audit log.`,
      })
      router.refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The auction could not be saved.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-5"
      aria-label={mode === 'create' ? 'Create auction' : 'Edit auction'}
    >
      {mode === 'edit' && locked.size > 0 ? (
        <Notice
          tone="warning"
          icon={<LockIcon />}
          title={
            allLocked
              ? 'This auction can no longer be edited'
              : `Some settings are locked while the auction is ${status?.toLowerCase()}`
          }
        >
          {allLocked
            ? 'Completed and cancelled auctions are read-only.'
            : 'Settings that affect the economics or fairness of a running auction cannot change. AutoBid can still be switched off.'}
        </Notice>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {mode === 'create' ? (
            <Field
              label="Product"
              htmlFor="auction-product"
              hint={
                product
                  ? `Reference price ${formatMinor(product.referencePriceMinor)} · ${product.available} available`
                  : undefined
              }
              className="md:col-span-2"
            >
              <NativeSelect
                id="auction-product"
                value={draft.productId}
                onChange={(event) => set('productId', event.target.value)}
                required
              >
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {formatMinor(item.referencePriceMinor)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          <Field label="Title" htmlFor="auction-title" hint="Defaults to the product name.">
            <Input {...text('title')} maxLength={120} disabled={allLocked} />
          </Field>
          {mode === 'create' ? (
            <Field label="Start time" htmlFor="auction-startsAt" hint="Your local time.">
              <Input {...text('startsAt')} type="datetime-local" required />
            </Field>
          ) : (
            <div />
          )}
          <Field
            label="Description (optional)"
            htmlFor="auction-description"
            className="md:col-span-2"
          >
            <Textarea {...text('description')} rows={2} maxLength={500} disabled={allLocked} />
          </Field>
          <Toggle
            id="featured"
            label="Featured"
            description="Shown in featured placements on the storefront."
            checked={draft.featured}
            onChange={(value) => set('featured', value)}
            locked={allLocked}
          />
          {mode === 'create' ? (
            <Toggle
              id="schedule"
              label="Schedule immediately"
              description="Otherwise it is saved as a draft."
              checked={draft.schedule}
              onChange={(value) => set('schedule', value)}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bidding & timer</CardTitle>
          <CardDescription>Shown to members on the auction page before they bid.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Starting price (£)"
            htmlFor="auction-startingPrice"
            locked={isLocked('startingPriceMinor')}
          >
            <Input
              {...text('startingPrice')}
              inputMode="decimal"
              disabled={isLocked('startingPriceMinor')}
            />
          </Field>
          <Field
            label="Bid increment (£)"
            htmlFor="auction-increment"
            locked={isLocked('bidIncrementMinor')}
          >
            <Input
              {...text('increment')}
              inputMode="decimal"
              disabled={isLocked('bidIncrementMinor')}
            />
          </Field>
          <Field
            label="Bid cost (credits)"
            htmlFor="auction-bidCreditCost"
            locked={isLocked('bidCreditCost')}
          >
            <Input
              {...text('bidCreditCost')}
              inputMode="numeric"
              disabled={isLocked('bidCreditCost')}
            />
          </Field>
          <Field
            label="Per-member bid limit"
            htmlFor="auction-perUserBidLimit"
            hint="Blank for none"
            locked={isLocked('perUserBidLimit')}
          >
            <Input
              {...text('perUserBidLimit')}
              inputMode="numeric"
              placeholder="None"
              disabled={isLocked('perUserBidLimit')}
            />
          </Field>
          <Field
            label="Initial countdown (min)"
            htmlFor="auction-timerMinutes"
            locked={isLocked('timerSeconds')}
          >
            <Input
              {...text('timerMinutes')}
              inputMode="numeric"
              disabled={isLocked('timerSeconds')}
            />
          </Field>
          <Field
            label="Extension per bid (s)"
            htmlFor="auction-extensionSeconds"
            hint="Minimum time left after a bid"
            locked={isLocked('timerExtensionSeconds')}
          >
            <Input
              {...text('extensionSeconds')}
              inputMode="numeric"
              disabled={isLocked('timerExtensionSeconds')}
            />
          </Field>
          <Field
            label="Hard stop (min after start)"
            htmlFor="auction-hardStopMinutes"
            hint="Blank for none"
            locked={isLocked('hardStopAfterSeconds')}
          >
            <Input
              {...text('hardStopMinutes')}
              inputMode="numeric"
              placeholder="None"
              disabled={isLocked('hardStopAfterSeconds')}
            />
          </Field>
          <Field
            label="Winner payment window (h)"
            htmlFor="auction-paymentWindowHours"
            locked={isLocked('winnerPaymentWindowHours')}
          >
            <Input
              {...text('paymentWindowHours')}
              inputMode="numeric"
              disabled={isLocked('winnerPaymentWindowHours')}
            />
          </Field>
          <div className="sm:col-span-2">
            <Toggle
              id="self-outbid"
              label="Prevent self-outbidding"
              description="Leaders cannot bid again until outbid."
              checked={draft.preventSelfOutbid}
              onChange={(value) => set('preventSelfOutbid', value)}
              locked={isLocked('preventSelfOutbid')}
            />
          </div>
          <div className="sm:col-span-2">
            <Toggle
              id="autobid"
              label="AutoBid allowed"
              description={
                mode === 'edit' && status === 'LIVE'
                  ? 'Can be switched off (not on) while live.'
                  : 'Members may set server-side AutoBid.'
              }
              checked={draft.autoBidEnabled}
              onChange={(value) => set('autoBidEnabled', value)}
              locked={
                isLocked('autoBidEnabled') ||
                (mode === 'edit' && status === 'LIVE' && !initialRules.autoBidEnabled)
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participation & reserve</CardTitle>
          <CardDescription>
            If the minimum participants or reserve are not met, no sale occurs and all bids are
            refunded.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Minimum participants"
            htmlFor="auction-minimumParticipants"
            locked={isLocked('minimumParticipants')}
          >
            <Input
              {...text('minimumParticipants')}
              inputMode="numeric"
              disabled={isLocked('minimumParticipants')}
            />
          </Field>
          <Field
            label="Maximum participants"
            htmlFor="auction-maximumParticipants"
            hint="Blank for unlimited"
            locked={isLocked('maximumParticipants')}
          >
            <Input
              {...text('maximumParticipants')}
              inputMode="numeric"
              placeholder="Unlimited"
              disabled={isLocked('maximumParticipants')}
            />
          </Field>
          <Field
            label="Reserve price (£)"
            htmlFor="auction-reservePrice"
            hint="Blank for none"
            locked={isLocked('reservePriceMinor')}
          >
            <Input
              {...text('reservePrice')}
              inputMode="decimal"
              placeholder="None"
              disabled={isLocked('reservePriceMinor')}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Buy Now & bid credit recovery</CardTitle>
          <CardDescription>
            Recovery availability also depends on the market configuration and feature flags.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Toggle
            id="buy-now"
            label="Buy Now enabled"
            checked={draft.buyNowEnabled}
            onChange={(value) => set('buyNowEnabled', value)}
            locked={isLocked('buyNowEnabled')}
          />
          <Field
            label="Buy Now price (£)"
            htmlFor="auction-buyNowPrice"
            hint="Blank uses the product’s Buy Now price"
            locked={isLocked('buyNowPriceMinor')}
          >
            <Input
              {...text('buyNowPrice')}
              inputMode="decimal"
              placeholder="Product price"
              disabled={isLocked('buyNowPriceMinor') || !draft.buyNowEnabled}
            />
          </Field>
          <Toggle
            id="recovery"
            label="Bid credit recovery"
            description="Non-winners who buy it now recover eligible bids."
            checked={draft.buyNowEnabled && draft.recoveryEnabled}
            onChange={(value) => set('recoveryEnabled', value)}
            locked={isLocked('bidCreditRecoveryEnabled') || !draft.buyNowEnabled}
          />
          <Field
            label="Recovery mode"
            htmlFor="auction-recoveryMode"
            locked={isLocked('recoveryMode')}
          >
            <NativeSelect
              id="auction-recoveryMode"
              value={draft.recoveryMode}
              onChange={(event) =>
                set('recoveryMode', event.target.value as AuctionRules['recoveryMode'])
              }
              disabled={isLocked('recoveryMode') || !draft.recoveryEnabled}
            >
              <option value="RETURN_BIDS">Return bids to wallet</option>
              <option value="PRICE_CREDIT">Credit bid value against price</option>
            </NativeSelect>
          </Field>
          <Field
            label="Recovery window (hours)"
            htmlFor="auction-recoveryWindowHours"
            locked={isLocked('recoveryWindowHours')}
          >
            <Input
              {...text('recoveryWindowHours')}
              inputMode="numeric"
              disabled={isLocked('recoveryWindowHours') || !draft.recoveryEnabled}
            />
          </Field>
          <Toggle
            id="recover-promo"
            label="Return promotional bids"
            description="Return-bids mode only; never converted to money."
            checked={draft.recoverPromotionalBids}
            onChange={(value) => set('recoverPromotionalBids', value)}
            locked={isLocked('recoverPromotionalBids') || !draft.recoveryEnabled}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eligibility</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Minimum tier"
            htmlFor="auction-minimumTier"
            locked={isLocked('eligibility')}
          >
            <NativeSelect
              id="auction-minimumTier"
              value={draft.minimumTier}
              onChange={(event) => set('minimumTier', event.target.value)}
              disabled={isLocked('eligibility')}
            >
              <option value="">Everyone</option>
              <option value="SILVER">Silver and above</option>
              <option value="GOLD">Gold and above</option>
              <option value="PLATINUM">Platinum</option>
            </NativeSelect>
          </Field>
          <Field
            label="Max previous wins"
            htmlFor="auction-maxPreviousWins"
            hint="0 = beginner auction"
            locked={isLocked('eligibility')}
          >
            <Input
              {...text('maxPreviousWins')}
              inputMode="numeric"
              placeholder="No limit"
              disabled={isLocked('eligibility')}
            />
          </Field>
          <Field
            label="Min account age (days)"
            htmlFor="auction-minimumAccountAgeDays"
            locked={isLocked('eligibility')}
          >
            <Input
              {...text('minimumAccountAgeDays')}
              inputMode="numeric"
              placeholder="None"
              disabled={isLocked('eligibility')}
            />
          </Field>
          <Field
            label="Minimum age"
            htmlFor="auction-minimumAge"
            hint="18 or over"
            locked={isLocked('eligibility')}
          >
            <Input {...text('minimumAge')} inputMode="numeric" disabled={isLocked('eligibility')} />
          </Field>
        </CardContent>
      </Card>

      {error ? (
        <Notice tone="danger" title="Not saved">
          {error}
        </Notice>
      ) : null}
      {!allLocked ? (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="brand" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : <SaveIcon />}
            {mode === 'create'
              ? draft.schedule
                ? 'Create & schedule'
                : 'Create draft'
              : 'Save changes'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      ) : null}
    </form>
  )
}
