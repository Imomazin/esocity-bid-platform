'use client'

import { Loader2Icon, PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type * as React from 'react'
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
import { PROMOTION_TYPE_LABELS, type PromotionType } from '@/domain/promotions'
import { api, ApiError } from '@/lib/client/api'
import { parsePoundsInput, parseWholeInput } from '@/lib/client/money-input'

const PERCENT_TYPES: PromotionType[] = [
  'PERCENT_DISCOUNT',
  'BID_PACK_DISCOUNT',
  'CATEGORY_OFFER',
  'NEW_CUSTOMER',
]

function toDateInput(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10)
}

/** Creates a promotion. Values are validated again on the server (types, ranges, dates). */
export function PromotionForm({
  categories,
  now,
}: {
  categories: { slug: string; name: string }[]
  now: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState({
    code: '',
    name: '',
    description: '',
    type: 'PERCENT_DISCOUNT' as PromotionType,
    value: '10',
    startsAt: toDateInput(now),
    endsAt: toDateInput(now + 30 * 24 * 3_600_000),
    usageLimit: '',
    perUserLimit: '1',
    minimumSpend: '',
    category: categories[0]?.slug ?? '',
    newCustomersOnly: false,
    minimumTier: '',
  })
  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) =>
    setValues((current) => ({ ...current, [key]: value }))
  const percent = PERCENT_TYPES.includes(values.type)
  const valueLabel = percent
    ? 'Discount (%)'
    : values.type === 'BONUS_BID_CREDITS'
      ? 'Bonus bid credits'
      : values.type === 'FREE_SHIPPING'
        ? 'Value (unused)'
        : 'Discount (£)'

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    let value: number
    if (percent) {
      const parsed = parsePoundsInput(values.value)
      if (typeof parsed !== 'number') return setError('Enter a percentage such as 10 or 12.5.')
      value = parsed // basis points: "10" → 1000
    } else if (values.type === 'BONUS_BID_CREDITS') {
      const parsed = parseWholeInput(values.value)
      if (typeof parsed !== 'number') return setError('Enter a whole number of bid credits.')
      value = parsed
    } else if (values.type === 'FREE_SHIPPING') {
      value = 0
    } else {
      const parsed = parsePoundsInput(values.value)
      if (typeof parsed !== 'number') return setError('Enter an amount such as 5 or 7.50.')
      value = parsed
    }
    const usageLimit = parseWholeInput(values.usageLimit)
    const perUserLimit = parseWholeInput(values.perUserLimit)
    const minimumSpend = parsePoundsInput(values.minimumSpend)
    if (usageLimit === 'invalid' || perUserLimit === 'invalid' || minimumSpend === 'invalid')
      return setError('Check the limits and minimum spend.')
    setPending(true)
    try {
      await api('/api/admin/promotions', {
        body: {
          code: values.code.trim(),
          name: values.name.trim(),
          description: values.description.trim(),
          type: values.type,
          value,
          startsAt: new Date(`${values.startsAt}T00:00:00`).getTime(),
          endsAt: new Date(`${values.endsAt}T23:59:59`).getTime(),
          usageLimit,
          perUserLimit,
          minimumSpendMinor: minimumSpend,
          categories: values.type === 'CATEGORY_OFFER' ? [values.category] : null,
          newCustomersOnly: values.newCustomersOnly,
          minimumTier: values.minimumTier || null,
        },
      })
      toast.success(`Promotion ${values.code.toUpperCase()} created`)
      setOpen(false)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The promotion could not be created.')
    } finally {
      setPending(false)
    }
  }

  const input = (
    key:
      | 'code'
      | 'name'
      | 'description'
      | 'value'
      | 'usageLimit'
      | 'perUserLimit'
      | 'minimumSpend'
      | 'startsAt'
      | 'endsAt',
  ) => ({
    id: `promo-${key}`,
    value: values[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      set(key, key === 'code' ? event.target.value.toUpperCase() : event.target.value),
  })

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? null : setOpen(next))}>
      <DialogTrigger asChild>
        <Button variant="brand">
          <PlusIcon /> New promotion
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New promotion</DialogTitle>
          <DialogDescription>
            Promotions are evaluated server-side at checkout and bid pack purchase. Every change is
            audited.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" id="promotion-form">
          <div className="space-y-1.5">
            <Label htmlFor="promo-code">Code</Label>
            <Input
              {...input('code')}
              required
              minLength={4}
              maxLength={24}
              placeholder="SPRING10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-name">Name</Label>
            <Input {...input('name')} required minLength={3} maxLength={80} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="promo-description">Description (optional)</Label>
            <Input {...input('description')} maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-type">Type</Label>
            <NativeSelect
              id="promo-type"
              value={values.type}
              onChange={(event) => set('type', event.target.value as PromotionType)}
            >
              {Object.entries(PROMOTION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-value">{valueLabel}</Label>
            <Input
              {...input('value')}
              inputMode="decimal"
              disabled={values.type === 'FREE_SHIPPING'}
            />
            {percent ? <FieldHint>Up to 90%.</FieldHint> : null}
          </div>
          {values.type === 'CATEGORY_OFFER' ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="promo-category">Category</Label>
              <NativeSelect
                id="promo-category"
                value={values.category}
                onChange={(event) => set('category', event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="promo-startsAt">Starts</Label>
            <Input {...input('startsAt')} type="date" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-endsAt">Ends</Label>
            <Input {...input('endsAt')} type="date" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-usageLimit">Total uses</Label>
            <Input {...input('usageLimit')} inputMode="numeric" placeholder="Unlimited" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-perUserLimit">Uses per member</Label>
            <Input {...input('perUserLimit')} inputMode="numeric" placeholder="Unlimited" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-minimumSpend">Minimum spend (£)</Label>
            <Input {...input('minimumSpend')} inputMode="decimal" placeholder="None" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-tier">Minimum tier</Label>
            <NativeSelect
              id="promo-tier"
              value={values.minimumTier}
              onChange={(event) => set('minimumTier', event.target.value)}
            >
              <option value="">Everyone</option>
              <option value="SILVER">Silver+</option>
              <option value="GOLD">Gold+</option>
              <option value="PLATINUM">Platinum</option>
            </NativeSelect>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--brand)]"
              checked={values.newCustomersOnly}
              onChange={(event) => set('newCustomersOnly', event.target.checked)}
            />
            New customers only
          </label>
          {error ? <FieldError className="sm:col-span-2">{error}</FieldError> : null}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="promotion-form" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null} Create promotion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
