import { ArrowRightIcon, PackageIcon, TimerIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { SignInGate } from '@/components/auth/sign-in-gate'
import { OrderSourceBadge, OrderStatusBadge } from '@/components/commerce/order-status'
import { Container, PageHeader } from '@/components/common/section'
import { ChipLink } from '@/components/common/chip-link'
import { ProductMedia } from '@/components/product/product-art'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState, Notice } from '@/components/ui/misc'
import { isOpenOrder } from '@/domain/orders'
import { formatMinor } from '@/lib/money'
import { formatDate, formatDateTime } from '@/lib/time'
import { pluralize } from '@/lib/utils'
import { getViewer } from '@/server/auth/session'
import { getBackend } from '@/server/runtime'
import type { OrderView } from '@/server/views'

export const metadata: Metadata = { title: 'Orders', robots: { index: false } }

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'In progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'closed', label: 'Cancelled & refunded' },
] as const

type Filter = (typeof FILTERS)[number]['value']

function matches(order: OrderView, filter: Filter): boolean {
  if (filter === 'open') return isOpenOrder(order.status)
  if (filter === 'delivered') return order.status === 'DELIVERED'
  if (filter === 'closed') return order.status === 'CANCELLED' || order.status === 'REFUNDED'
  return true
}

function OrderRow({ order }: { order: OrderView }) {
  const items = order.lines.reduce((total, line) => total + line.quantity, 0)
  return (
    <Card className="overflow-hidden transition hover:shadow-raised">
      <Link
        href={`/orders/${order.id}`}
        className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5"
      >
        <div className="flex -space-x-3">
          {order.lines.slice(0, 3).map((line) => {
            const art = order.lineArt[line.productId]
            return art ? (
              <div
                key={line.productId}
                className="w-16 overflow-hidden rounded-xl border-2 border-card"
              >
                <ProductMedia
                  art={art.art}
                  palette={art.palette}
                  uid={`ord-${order.id}-${line.productId}`}
                  alt={line.name}
                />
              </div>
            ) : null
          })}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular font-semibold">{order.reference}</span>
            <OrderStatusBadge status={order.status} />
            <OrderSourceBadge source={order.source} />
          </div>
          <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
            {order.lines.map((line) => line.name).join(', ')}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDate(order.createdAt)} · {pluralize(items, 'item')}
            {order.trackingNumber ? ` · Tracking ${order.trackingNumber}` : ''}
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
          <span className="tabular text-lg font-semibold">{formatMinor(order.totalMinor)}</span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-brand">
            {order.status === 'PENDING_PAYMENT' ? 'Pay now' : 'Details'}{' '}
            <ArrowRightIcon className="size-4" aria-hidden />
          </span>
        </div>
      </Link>
    </Card>
  )
}

export default async function OrdersPage({ searchParams }: PageProps<'/orders'>) {
  const viewer = await getViewer()
  if (!viewer)
    return (
      <SignInGate
        title="Your orders"
        description="Enter the demo to see auction wins, marketplace purchases and deliveries."
        redirectTo="/orders"
      />
    )
  const params = await searchParams
  const requested = typeof params.status === 'string' ? params.status : 'all'
  const filter: Filter = FILTERS.some((item) => item.value === requested)
    ? (requested as Filter)
    : 'all'
  const orders = getBackend().orders(viewer.userId)
  const awaitingPayment = orders.filter((order) => order.status === 'PENDING_PAYMENT')
  const visible = orders.filter((order) => matches(order, filter))
  return (
    <Container className="py-8 sm:py-10">
      <PageHeader
        eyebrow="Orders"
        title="Your orders"
        description="Auction wins, Buy Now purchases, Flash Drops and marketplace orders — with live fulfilment status."
        actions={
          <Button asChild variant="outline">
            <Link href="/support?category=order">Get help with an order</Link>
          </Button>
        }
      />
      {awaitingPayment.length > 0 ? (
        <Notice
          tone="brand"
          icon={<TimerIcon />}
          title={`${pluralize(awaitingPayment.length, 'auction win')} awaiting payment`}
          className="mb-6"
        >
          <ul className="mt-1 space-y-1">
            {awaitingPayment.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium">{order.lines[0]?.name}</span>
                <span className="tabular">{formatMinor(order.totalMinor)}</span>
                {order.paymentDueAt ? (
                  <span className="text-xs">Pay by {formatDateTime(order.paymentDueAt)}</span>
                ) : null}
                <Link
                  href={`/checkout?order=${order.id}`}
                  className="text-sm font-semibold underline"
                >
                  Complete payment
                </Link>
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}
      <div className="mb-5 flex flex-wrap gap-2" role="navigation" aria-label="Filter orders">
        {FILTERS.map((item) => (
          <ChipLink
            key={item.value}
            href={item.value === 'all' ? '/orders' : `/orders?status=${item.value}`}
            active={filter === item.value}
          >
            {item.label}
          </ChipLink>
        ))}
      </div>
      {visible.length === 0 ? (
        <EmptyState
          icon={<PackageIcon />}
          title={orders.length === 0 ? 'No orders yet' : 'No orders match this filter'}
          description={
            orders.length === 0
              ? 'When you win an auction or buy from the marketplace, your orders appear here.'
              : 'Try a different filter.'
          }
          action={
            orders.length === 0 ? (
              <Button asChild variant="brand">
                <Link href="/marketplace">Browse the marketplace</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </Container>
  )
}
