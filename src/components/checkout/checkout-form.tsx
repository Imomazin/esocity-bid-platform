'use client'

import {
  CheckIcon,
  CreditCardIcon,
  Loader2Icon,
  LockIcon,
  MapPinIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  TagIcon,
  Trash2Icon,
  TruckIcon,
  XIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type * as React from 'react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { AddressForm } from '@/components/account/address-form'
import { ProductMedia } from '@/components/product/product-art'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldError, Input, Label } from '@/components/ui/input'
import { Notice } from '@/components/ui/misc'
import { api, ApiError, newIdempotencyKey } from '@/lib/client/api'
import { emit } from '@/lib/client/events'
import { formatMinor } from '@/lib/money'
import { formatDateTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { CartView, CheckoutPreview, OrderView } from '@/server/views'

type PaymentMethodId = 'DEMO_CARD' | 'DEMO_WALLET' | 'DEMO_DECLINE'

function Step({
  index,
  title,
  children,
  aside,
}: {
  index: number
  title: string
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2.5 text-base">
          <span className="tabular flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {index}
          </span>
          {title}
        </CardTitle>
        {aside}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: React.ReactNode
  value: React.ReactNode
  tone?: 'success'
  strong?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-3',
        tone === 'success' && 'text-success',
        strong && 'border-t pt-3 text-base font-semibold',
      )}
    >
      <dt className={cn(!strong && !tone && 'text-muted-foreground')}>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  )
}

export function CheckoutForm({
  initial,
  initialCart,
}: {
  initial: CheckoutPreview
  initialCart: CartView | null
}) {
  const router = useRouter()
  const [preview, setPreview] = useState(initial)
  const [cart, setCart] = useState(initialCart)
  const [addresses, setAddresses] = useState(initial.addresses)
  const [addressId, setAddressId] = useState<string | null>(
    initial.addresses.find((address) => address.isDefault)?.id ?? initial.addresses[0]?.id ?? null,
  )
  const [addingAddress, setAddingAddress] = useState(initial.addresses.length === 0)
  const [promoInput, setPromoInput] = useState('')
  const [appliedCode, setAppliedCode] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethodId>('DEMO_CARD')
  const [updating, setUpdating] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const idempotencyKey = useRef<string | null>(null)
  const { pricing } = preview
  const isCart = preview.mode.kind === 'CART'

  const refresh = async (
    overrides: { promoCode?: string | null; shippingMethodId?: string } = {},
  ) => {
    setUpdating(true)
    try {
      const next = await api<CheckoutPreview>('/api/checkout/preview', {
        body: {
          mode: preview.mode,
          promoCode: overrides.promoCode !== undefined ? overrides.promoCode : appliedCode,
          shippingMethodId: overrides.shippingMethodId ?? preview.selectedShippingMethod,
        },
      })
      setPreview(next)
      return next
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'CART_EMPTY') {
        router.refresh()
        return null
      }
      toast.error(caught instanceof ApiError ? caught.message : 'Could not update your checkout.')
      return null
    } finally {
      setUpdating(false)
    }
  }

  const applyCode = async () => {
    const code = promoInput.trim().toUpperCase()
    if (!code) return
    const next = await refresh({ promoCode: code })
    if (next?.promotion?.valid) setAppliedCode(code)
  }

  const removeCode = async () => {
    setAppliedCode(null)
    setPromoInput('')
    await refresh({ promoCode: null })
  }

  const changeQuantity = async (itemId: string, quantity: number) => {
    setUpdating(true)
    try {
      const next = await api<CartView>(
        `/api/cart/items/${itemId}`,
        quantity <= 0 ? { method: 'DELETE' } : { method: 'PATCH', body: { quantity } },
      )
      setCart(next)
      emit('cart:count', { count: next.itemCount })
      if (next.itemCount === 0) {
        router.refresh()
        return
      }
      await refresh()
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not update your basket.')
    } finally {
      setUpdating(false)
    }
  }

  const placeOrder = async () => {
    setError(null)
    if (pricing.requiresShipping && !addressId) {
      setError('Please add a delivery address.')
      return
    }
    setPlacing(true)
    idempotencyKey.current ??= newIdempotencyKey()
    try {
      const order = await api<OrderView>('/api/checkout', {
        body: {
          mode: preview.mode,
          promoCode: appliedCode,
          shippingMethodId: preview.selectedShippingMethod,
          addressId,
          paymentMethod: method,
        },
        idempotencyKey: idempotencyKey.current,
      })
      idempotencyKey.current = null
      if (isCart) emit('cart:count', { count: 0 })
      toast.success(`Order ${order.reference} confirmed`, {
        description: 'Payment simulated — no real money was taken.',
      })
      router.push(`/orders/${order.id}?placed=1`)
    } catch (caught) {
      const apiError = caught instanceof ApiError ? caught : null
      // Keep the key only for network failures, so a retry of the same attempt cannot double-charge.
      if (apiError?.code !== 'NETWORK') idempotencyKey.current = null
      if (apiError?.code === 'PAYMENT_FAILED') {
        setError(
          `${apiError.message} Nothing was charged and any reserved stock has been released. Try a different payment method.`,
        )
      } else {
        setError(apiError?.message ?? 'Your order could not be placed. Please try again.')
      }
      if (apiError && apiError.code !== 'NETWORK' && apiError.code !== 'PAYMENT_FAILED')
        void refresh()
    } finally {
      setPlacing(false)
    }
  }

  const cartLineFor = (productId: string) =>
    cart?.lines.find((line) => line.product.id === productId) ?? null
  const recovery = preview.recovery
  let step = 1

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
      <div className="space-y-5">
        {preview.paymentDueAt ? (
          <Notice tone="brand" title="Complete payment for your win">
            Pay by {formatDateTime(preview.paymentDueAt)} to secure your item at the winning auction
            price.
          </Notice>
        ) : null}
        {preview.warnings.map((warning) => (
          <Notice key={warning} tone="warning">
            {warning}
          </Notice>
        ))}

        <Step
          index={step++}
          title={isCart ? `Your basket (${cart?.itemCount ?? preview.lines.length})` : 'Your item'}
        >
          <ul className="divide-y">
            {preview.lines.map((line) => {
              const cartLine = cartLineFor(line.product.id)
              return (
                <li key={line.product.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <Link
                    href={`/product/${line.product.slug}`}
                    className="w-20 shrink-0 overflow-hidden rounded-xl sm:w-24"
                  >
                    <ProductMedia
                      art={line.product.art}
                      palette={line.product.palette}
                      uid={`co-${line.product.id}`}
                      alt={line.product.name}
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-xs text-muted-foreground">{line.product.brandName}</p>
                    <Link
                      href={`/product/${line.product.slug}`}
                      className="line-clamp-2 font-medium hover:underline"
                    >
                      {line.product.name}
                    </Link>
                    {line.note ? (
                      <p className="text-xs text-muted-foreground">{line.note}</p>
                    ) : null}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                      {cartLine ? (
                        <div
                          className="flex items-center gap-1"
                          role="group"
                          aria-label={`Quantity for ${line.product.name}`}
                        >
                          <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label="Decrease quantity"
                            disabled={updating}
                            onClick={() => changeQuantity(cartLine.id, cartLine.quantity - 1)}
                          >
                            <MinusIcon />
                          </Button>
                          <span
                            className="tabular w-8 text-center text-sm font-medium"
                            aria-live="polite"
                          >
                            {cartLine.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label="Increase quantity"
                            disabled={
                              updating || cartLine.quantity >= Math.min(10, cartLine.available)
                            }
                            onClick={() => changeQuantity(cartLine.id, cartLine.quantity + 1)}
                          >
                            <PlusIcon />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-1 text-muted-foreground"
                            disabled={updating}
                            onClick={() => changeQuantity(cartLine.id, 0)}
                          >
                            <Trash2Icon /> Remove
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Qty {line.quantity}</span>
                      )}
                      <span className="tabular font-semibold">
                        {formatMinor(line.lineTotalMinor)}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Step>

        {recovery ? (
          <Notice
            tone={recovery.eligible ? 'success' : 'neutral'}
            icon={<RotateCcwIcon />}
            title="Bid credit recovery"
          >
            {recovery.eligible ? (
              recovery.mode === 'RETURN_BIDS' ? (
                <>
                  After payment, {recovery.credits} bid{recovery.credits === 1 ? '' : 's'} you
                  placed in this auction will be returned to your Bid Wallet
                  {recovery.promotionalCredits > 0
                    ? ` (${recovery.purchasedCredits} purchased, ${recovery.promotionalCredits} promotional)`
                    : ''}
                  .
                  {recovery.windowEndsAt
                    ? ` Offer available until ${formatDateTime(recovery.windowEndsAt)}.`
                    : ''}
                </>
              ) : (
                <>
                  The value of {recovery.purchasedCredits} purchased bid
                  {recovery.purchasedCredits === 1 ? '' : 's'} ({formatMinor(recovery.valueMinor)})
                  is credited against the Buy Now price.
                </>
              )
            ) : (
              <ul className="list-disc space-y-0.5 pl-4">
                {recovery.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          </Notice>
        ) : null}

        {pricing.requiresShipping ? (
          <>
            <Step
              index={step++}
              title="Delivery address"
              aside={
                !addingAddress && addresses.length < 6 ? (
                  <Button variant="ghost" size="sm" onClick={() => setAddingAddress(true)}>
                    <PlusIcon /> New address
                  </Button>
                ) : null
              }
            >
              {addingAddress ? (
                <AddressForm
                  canCancel={addresses.length > 0}
                  onCancel={() => setAddingAddress(false)}
                  onSaved={(saved) => {
                    setAddresses(saved)
                    setAddressId(saved[saved.length - 1]?.id ?? null)
                    setAddingAddress(false)
                    toast.success('Address saved')
                  }}
                />
              ) : (
                <fieldset className="grid gap-3 sm:grid-cols-2">
                  <legend className="sr-only">Choose a delivery address</legend>
                  {addresses.map((address) => (
                    <label
                      key={address.id}
                      className={cn(
                        'flex cursor-pointer gap-3 rounded-xl border p-4 text-sm transition focus-within:ring-2 focus-within:ring-ring',
                        addressId === address.id
                          ? 'border-foreground bg-muted/40'
                          : 'hover:border-foreground/30',
                      )}
                    >
                      <input
                        type="radio"
                        name="address"
                        checked={addressId === address.id}
                        onChange={() => setAddressId(address.id)}
                        className="mt-0.5 accent-[var(--brand)]"
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-medium">
                          <MapPinIcon className="size-3.5 text-muted-foreground" aria-hidden />
                          {address.label}
                          {address.isDefault ? <Badge variant="outline">Default</Badge> : null}
                        </span>
                        <span className="mt-1 block text-muted-foreground">
                          {address.fullName}
                          <br />
                          {address.line1}
                          {address.line2 ? `, ${address.line2}` : ''}
                          <br />
                          {address.city} {address.postcode}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
            </Step>

            <Step index={step++} title="Delivery method">
              <fieldset className="space-y-2">
                <legend className="sr-only">Choose a delivery method</legend>
                {preview.shippingMethods.map((shipping) => {
                  const selected = preview.selectedShippingMethod === shipping.id
                  const free = selected && pricing.freeShippingApplied
                  return (
                    <label
                      key={shipping.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition focus-within:ring-2 focus-within:ring-ring',
                        selected ? 'border-foreground bg-muted/40' : 'hover:border-foreground/30',
                      )}
                    >
                      <input
                        type="radio"
                        name="shipping"
                        checked={selected}
                        disabled={updating}
                        onChange={() => void refresh({ shippingMethodId: shipping.id })}
                        className="accent-[var(--brand)]"
                      />
                      <TruckIcon className="size-4 text-muted-foreground" aria-hidden />
                      <span className="flex-1">
                        <span className="font-medium">{shipping.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {shipping.description}
                          {shipping.freeOverMinor !== null
                            ? ` · Free over ${formatMinor(shipping.freeOverMinor, 'GBP', { trimZeroMinor: true })}`
                            : ''}
                        </span>
                      </span>
                      <span className="tabular font-medium">
                        {free ? 'Free' : formatMinor(shipping.priceMinor)}
                      </span>
                    </label>
                  )
                })}
              </fieldset>
            </Step>
          </>
        ) : (
          <Notice tone="neutral" icon={<CheckIcon />}>
            Digital item — delivered to your account email, so no delivery address is needed.
          </Notice>
        )}

        <Step index={step++} title="Payment">
          <fieldset className="space-y-2">
            <legend className="sr-only">Choose a payment method</legend>
            {preview.paymentMethods.map((payment) => (
              <label
                key={payment.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition focus-within:ring-2 focus-within:ring-ring',
                  method === payment.id
                    ? 'border-foreground bg-muted/40'
                    : 'hover:border-foreground/30',
                )}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={method === payment.id}
                  onChange={() => setMethod(payment.id as PaymentMethodId)}
                  className="accent-[var(--brand)]"
                />
                <CreditCardIcon className="size-4 text-muted-foreground" aria-hidden />
                <span className="flex-1">
                  <span className="font-medium">{payment.label}</span>
                  <span className="block text-xs text-muted-foreground">{payment.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <LockIcon className="size-3" aria-hidden /> Esocity never collects or stores raw card
            details. Live payments use a PCI-compliant hosted checkout.
          </p>
        </Step>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {preview.promoAllowed ? (
              <div className="space-y-1.5">
                <Label htmlFor="promo-code">Promotion code</Label>
                {appliedCode && preview.promotion?.valid ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success-foreground">
                    <span className="flex min-w-0 items-center gap-2">
                      <TagIcon className="size-4 shrink-0" aria-hidden />
                      <span className="truncate">
                        <strong>{appliedCode}</strong> · {preview.promotion.message}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove code"
                      onClick={removeCode}
                      disabled={updating}
                    >
                      <XIcon />
                    </Button>
                  </div>
                ) : (
                  <>
                    <form
                      className="flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void applyCode()
                      }}
                    >
                      <Input
                        id="promo-code"
                        value={promoInput}
                        onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                        placeholder="e.g. SAVE5"
                        autoComplete="off"
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        disabled={updating || !promoInput.trim()}
                      >
                        Apply
                      </Button>
                    </form>
                    {preview.promotion && !preview.promotion.valid ? (
                      <FieldError>{preview.promotion.message}</FieldError>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            <dl
              className={cn('space-y-2 text-sm transition-opacity', updating && 'opacity-60')}
              aria-busy={updating}
            >
              <Row label="Subtotal" value={formatMinor(pricing.subtotalMinor)} />
              {pricing.discountMinor > 0 ? (
                <Row
                  label="Discount"
                  value={`−${formatMinor(pricing.discountMinor)}`}
                  tone="success"
                />
              ) : null}
              {pricing.recoveryCreditMinor > 0 ? (
                <Row
                  label="Bid value credit"
                  value={`−${formatMinor(pricing.recoveryCreditMinor)}`}
                  tone="success"
                />
              ) : null}
              {pricing.requiresShipping ? (
                <Row
                  label="Delivery"
                  value={pricing.shippingMinor === 0 ? 'Free' : formatMinor(pricing.shippingMinor)}
                  tone={pricing.shippingMinor === 0 ? 'success' : undefined}
                />
              ) : null}
              {pricing.bulkySurchargeMinor > 0 ? (
                <Row label="Large item handling" value={formatMinor(pricing.bulkySurchargeMinor)} />
              ) : null}
              {!pricing.taxInclusive ? (
                <Row label={pricing.taxLabel} value={formatMinor(pricing.taxMinor)} />
              ) : null}
              <Row label="Total" value={formatMinor(pricing.totalMinor)} strong />
              {pricing.taxInclusive ? (
                <p className="tabular text-right text-xs text-muted-foreground">
                  Includes {pricing.taxLabel} of {formatMinor(pricing.taxMinor)}
                </p>
              ) : null}
            </dl>

            {error ? (
              <Notice tone="danger" title="Payment not completed">
                {error}
              </Notice>
            ) : null}

            <Button
              variant="brand"
              size="lg"
              className="w-full"
              onClick={placeOrder}
              disabled={placing || updating || addingAddress}
              data-testid="place-order"
            >
              {placing ? <Loader2Icon className="animate-spin" /> : <LockIcon />}
              {placing ? 'Processing…' : `Pay ${formatMinor(pricing.totalMinor)}`}
            </Button>
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              Demo checkout — payments are simulated and no money moves. By placing an order you
              agree to the{' '}
              <Link href="/terms" className="underline">
                terms
              </Link>{' '}
              and{' '}
              <Link href="/trust#returns" className="underline">
                returns policy
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </aside>
    </div>
  )
}
