import {
  ArrowLeftIcon,
  CircleCheckIcon,
  CreditCardIcon,
  LifeBuoyIcon,
  MapPinIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  TruckIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SignInGate } from '@/components/auth/sign-in-gate'
import {
  OrderSourceBadge,
  OrderStatusBadge,
  OrderTimeline,
} from '@/components/commerce/order-status'
import { AutoRefresh } from '@/components/common/auto-refresh'
import { Container } from '@/components/common/section'
import { ProductMedia } from '@/components/product/product-art'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/misc'
import { isOpenOrder } from '@/domain/orders'
import { getMarket } from '@/lib/config/market'
import { formatMinor } from '@/lib/money'
import { formatDateTime } from '@/lib/time'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Order details', robots: { index: false } }

export default async function OrderPage({ params, searchParams }: PageProps<'/orders/[id]'>) {
  const { id } = await params
  const viewer = await getViewer()
  if (!viewer)
    return (
      <SignInGate
        title="Order details"
        description="Enter the demo to view your orders."
        redirectTo={`/orders/${id}`}
      />
    )
  const order = getBackend().order(viewer.userId, id)
  if (!order) notFound()
  const { placed } = await searchParams
  const market = getMarket('UK')
  const shippingMethod = market.shippingMethods.find((method) => method.id === order.shippingMethod)
  const requiresShipping = order.lines.some((line) => line.shippingClass !== 'DIGITAL')
  const refunded =
    order.payment.status === 'REFUNDED' || order.payment.status === 'PARTIALLY_REFUNDED'
  return (
    <Container className="py-8 sm:py-10">
      {isOpenOrder(order.status) ? <AutoRefresh intervalMs={20_000} /> : null}
      <Link
        href="/orders"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> All orders
      </Link>
      {placed && order.status !== 'PENDING_PAYMENT' ? (
        <Notice
          tone="success"
          icon={<CircleCheckIcon />}
          title="Thank you — your order is confirmed"
          className="mb-6"
        >
          We’ve sent a confirmation to your account inbox. In the demo, fulfilment advances
          automatically over the next few minutes.
        </Notice>
      ) : null}
      <div className="flex flex-col gap-3 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-brand uppercase">Order</p>
          <h1 className="tabular mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {order.reference}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <OrderStatusBadge status={order.status} />
            <OrderSourceBadge source={order.source} />
            <span>Placed {formatDateTime(order.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.auctionId ? (
            <Button asChild variant="outline">
              <Link href={`/auction/${order.auctionId}`}>View auction</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href={`/support?category=order&ref=${encodeURIComponent(order.reference)}`}>
              <LifeBuoyIcon /> Get help
            </Link>
          </Button>
        </div>
      </div>

      {order.status === 'PENDING_PAYMENT' ? (
        <Notice
          tone="brand"
          icon={<CreditCardIcon />}
          title="Payment needed to secure your item"
          className="mb-6"
        >
          {order.paymentDueAt ? (
            <>Complete payment by {formatDateTime(order.paymentDueAt)}. </>
          ) : null}
          If payment isn’t completed in time the order is cancelled automatically.
          <div className="mt-3">
            <Button asChild variant="brand" size="sm">
              <Link href={`/checkout?order=${order.id}`}>Pay {formatMinor(order.totalMinor)}</Link>
            </Button>
          </div>
        </Notice>
      ) : null}
      {order.exception ? (
        <Notice
          tone="warning"
          icon={<TriangleAlertIcon />}
          title="There’s an issue with this order"
          className="mb-6"
        >
          {order.exception.message} Our team has been notified.
        </Notice>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {order.lines.map((line) => {
                  const art = order.lineArt[line.productId]
                  return (
                    <li key={line.productId} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                      <Link
                        href={`/product/${line.productSlug}`}
                        className="w-20 shrink-0 overflow-hidden rounded-xl"
                      >
                        {art ? (
                          <ProductMedia
                            art={art.art}
                            palette={art.palette}
                            uid={`od-${line.productId}`}
                            alt={line.name}
                          />
                        ) : null}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">{line.brandName}</p>
                        <Link
                          href={`/product/${line.productSlug}`}
                          className="font-medium hover:underline"
                        >
                          {line.name}
                        </Link>
                        <p className="tabular mt-1 text-sm text-muted-foreground">
                          {line.quantity} × {formatMinor(line.unitPriceMinor)}
                        </p>
                      </div>
                      <span className="tabular font-semibold">
                        {formatMinor(line.lineTotalMinor)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>

          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TruckIcon className="size-4 text-muted-foreground" aria-hidden /> Delivery
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {requiresShipping ? (
                  <>
                    <p>
                      {shippingMethod
                        ? `${shippingMethod.label} · ${shippingMethod.description}`
                        : order.shippingMethod}
                    </p>
                    {order.trackingNumber ? (
                      <p>
                        <span className="text-muted-foreground">Tracking:</span>{' '}
                        <span className="tabular font-medium">{order.trackingNumber}</span>
                        {order.carrier ? (
                          <span className="text-muted-foreground"> · {order.carrier}</span>
                        ) : null}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        Tracking appears once your order ships.
                      </p>
                    )}
                    {order.shippingAddress ? (
                      <p className="flex gap-2 pt-1 text-muted-foreground">
                        <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>
                          {order.shippingAddress.fullName}, {order.shippingAddress.line1}
                          {order.shippingAddress.line2
                            ? `, ${order.shippingAddress.line2}`
                            : ''}, {order.shippingAddress.city} {order.shippingAddress.postcode}
                        </span>
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-muted-foreground">Digital delivery to your account email.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCardIcon className="size-4 text-muted-foreground" aria-hidden /> Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <p>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  {order.payment.status.replace('_', ' ').toLowerCase()}
                </p>
                {order.payment.methodLabel ? (
                  <p>
                    <span className="text-muted-foreground">Method:</span>{' '}
                    {order.payment.methodLabel}
                  </p>
                ) : null}
                {order.payment.reference ? (
                  <p className="break-all">
                    <span className="text-muted-foreground">Reference:</span>{' '}
                    <span className="font-mono text-xs">{order.payment.reference}</span>
                  </p>
                ) : null}
                {order.payment.paidAt ? (
                  <p>
                    <span className="text-muted-foreground">Paid:</span>{' '}
                    {formatDateTime(order.payment.paidAt)}
                  </p>
                ) : null}
                <p className="pt-1 text-xs text-muted-foreground">
                  {order.simulated
                    ? 'Simulated payment (demo mode).'
                    : `Processed by ${order.payment.provider}.`}
                </p>
              </CardContent>
            </Card>
          </div>
          {order.status === 'DELIVERED' ? (
            <Notice tone="neutral" icon={<RotateCcwIcon />} title="Returns">
              You can return most items within {market.returnsWindowDays} days of delivery.{' '}
              <Link
                href={`/support?category=refund&ref=${encodeURIComponent(order.reference)}`}
                className="font-medium underline"
              >
                Start a return
              </Link>
            </Notice>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular">{formatMinor(order.subtotalMinor)}</dd>
                </div>
                {order.discountMinor > 0 ? (
                  <div className="flex justify-between text-success">
                    <dt>Discount{order.promotionCode ? ` (${order.promotionCode})` : ''}</dt>
                    <dd className="tabular">−{formatMinor(order.discountMinor)}</dd>
                  </div>
                ) : null}
                {order.recovery?.mode === 'PRICE_CREDIT' && order.recovery.valueMinor > 0 ? (
                  <div className="flex justify-between text-success">
                    <dt>Bid value credit</dt>
                    <dd className="tabular">−{formatMinor(order.recovery.valueMinor)}</dd>
                  </div>
                ) : null}
                {requiresShipping ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Delivery</dt>
                    <dd className="tabular">
                      {order.shippingMinor === 0 ? 'Free' : formatMinor(order.shippingMinor)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t pt-3 text-base font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular">{formatMinor(order.totalMinor)}</dd>
                </div>
                <p className="tabular text-right text-xs text-muted-foreground">
                  Includes VAT of {formatMinor(order.taxMinor)}
                </p>
              </dl>
              {order.recovery?.mode === 'RETURN_BIDS' && order.recovery.credits > 0 ? (
                <Notice tone="success" icon={<RotateCcwIcon />} className="mt-4">
                  {order.recovery.credits} bid credits were returned to your Bid Wallet with this
                  purchase.
                </Notice>
              ) : null}
              {refunded ? (
                <Notice tone="neutral" className="mt-4">
                  A refund was issued to the original payment method.
                </Notice>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline order={order} />
            </CardContent>
          </Card>
        </div>
      </div>
    </Container>
  )
}
