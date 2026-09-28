import { ArrowLeftIcon, TriangleAlertIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AdminAction } from '@/components/admin/admin-action'
import { AccessDenied } from '@/components/admin/admin-ui'
import { RefundForm } from '@/components/admin/refund-form'
import {
  OrderSourceBadge,
  OrderStatusBadge,
  OrderTimeline,
} from '@/components/commerce/order-status'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/misc'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { ORDER_STATUS_LABELS, ORDER_TRANSITIONS } from '@/domain/orders'
import { formatMinor } from '@/lib/money'
import { formatDateTime } from '@/lib/time'
import { adminAccess } from '@/server/auth/admin-access'
import { hasPermission } from '@/server/auth/roles'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Order' }

export default async function AdminOrderPage({ params }: PageProps<'/admin/orders/[id]'>) {
  const access = await adminAccess('orders.view')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const { id } = await params
  const backend = getBackend()
  const order = backend.admin.order(id)
  if (!order) notFound()
  const canManage = hasPermission(access.actor.roles, 'orders.manage')
  const canRefund = hasPermission(access.actor.roles, 'refunds.issue')
  const payment = backend.admin.orderPayment(order.id)
  const refundable = payment ? payment.amountMinor - payment.refundedMinor : 0
  const nextStatuses = ORDER_TRANSITIONS[order.status].filter((status) => status !== 'REFUNDED')

  return (
    <div className="space-y-6">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> Orders
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <OrderSourceBadge source={order.source} />
          </div>
          <h1 className="tabular mt-2 text-2xl font-semibold tracking-tight">{order.reference}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.customerName} · placed {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage
            ? nextStatuses.map((status) => (
                <AdminAction
                  key={status}
                  variant={status === 'CANCELLED' ? 'danger' : 'primary'}
                  endpoint={`/api/admin/orders/${order.id}/status`}
                  body={{ to: status }}
                  successMessage={`Order moved to ${ORDER_STATUS_LABELS[status]}`}
                  confirm={
                    status === 'CANCELLED'
                      ? {
                          title: 'Cancel this order?',
                          description: 'Unpaid orders only. Reserved stock is released.',
                          danger: true,
                          confirmLabel: 'Cancel order',
                          reasonField: 'note',
                        }
                      : undefined
                  }
                >
                  Mark {ORDER_STATUS_LABELS[status].toLowerCase()}
                </AdminAction>
              ))
            : null}
          {canRefund && payment ? (
            <RefundForm
              orderId={order.id}
              reference={order.reference}
              refundableMinor={refundable}
            />
          ) : null}
        </div>
      </div>

      {order.exception ? (
        <Notice
          tone="warning"
          icon={<TriangleAlertIcon />}
          title={`Exception: ${order.exception.code}`}
        >
          {order.exception.message}
        </Notice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <Table>
              <THead>
                <TR>
                  <TH>Item</TH>
                  <TH className="text-right">Qty</TH>
                  <TH className="text-right">Unit</TH>
                  <TH className="text-right">Total</TH>
                </TR>
              </THead>
              <TBody>
                {order.lines.map((line) => (
                  <TR key={line.productId}>
                    <TD>
                      <Link
                        href={`/admin/products/${line.productId}`}
                        className="font-medium hover:underline"
                      >
                        {line.name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {line.brandName} · {line.shippingClass.toLowerCase()}
                      </span>
                    </TD>
                    <TD className="tabular text-right">{line.quantity}</TD>
                    <TD className="tabular text-right">{formatMinor(line.unitPriceMinor)}</TD>
                    <TD className="tabular text-right">{formatMinor(line.lineTotalMinor)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <CardContent className="pt-4">
              <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular">{formatMinor(order.subtotalMinor)}</dd>
                </div>
                {order.discountMinor > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      Discount {order.promotionCode ? `(${order.promotionCode})` : ''}
                    </dt>
                    <dd className="tabular">−{formatMinor(order.discountMinor)}</dd>
                  </div>
                ) : null}
                {order.recovery ? (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      Recovery (
                      {order.recovery.mode === 'RETURN_BIDS'
                        ? `${order.recovery.credits} bids returned`
                        : 'price credit'}
                      )
                    </dt>
                    <dd className="tabular">
                      {order.recovery.mode === 'PRICE_CREDIT'
                        ? `−${formatMinor(order.recovery.valueMinor)}`
                        : '—'}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    Delivery ({order.shippingMethod.toLowerCase().replace('_', ' ')})
                  </dt>
                  <dd className="tabular">{formatMinor(order.shippingMinor)}</dd>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular">{formatMinor(order.totalMinor)}</dd>
                </div>
                <p className="text-right text-xs text-muted-foreground">
                  incl. VAT {formatMinor(order.taxMinor)}
                </p>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p>
                <span className="text-muted-foreground">Status:</span>{' '}
                {order.payment.status.replace('_', ' ').toLowerCase()} · {order.payment.provider}
              </p>
              {order.payment.methodLabel ? (
                <p>
                  <span className="text-muted-foreground">Method:</span> {order.payment.methodLabel}
                </p>
              ) : null}
              {order.payment.reference ? (
                <p className="break-all">
                  <span className="text-muted-foreground">Provider reference:</span>{' '}
                  <span className="font-mono text-xs">{order.payment.reference}</span>
                </p>
              ) : null}
              {payment && payment.refundedMinor > 0 ? (
                <p>
                  <span className="text-muted-foreground">Refunded so far:</span>{' '}
                  {formatMinor(payment.refundedMinor)}
                </p>
              ) : null}
              {order.paymentDueAt && order.status === 'PENDING_PAYMENT' ? (
                <p>
                  <span className="text-muted-foreground">Payment due:</span>{' '}
                  {formatDateTime(order.paymentDueAt)}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fulfilment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {order.shippingAddress ? (
                <p className="text-muted-foreground">
                  {order.shippingAddress.fullName}
                  <br />
                  {order.shippingAddress.line1}
                  {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
                  <br />
                  {order.shippingAddress.city} {order.shippingAddress.postcode}
                </p>
              ) : (
                <p className="text-muted-foreground">Digital delivery</p>
              )}
              {order.trackingNumber ? (
                <p>
                  Tracking <span className="tabular font-medium">{order.trackingNumber}</span> ·{' '}
                  {order.carrier}
                </p>
              ) : null}
              <OrderTimeline order={order} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Event log</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm">
                {[...order.events].reverse().map((event, index) => (
                  <li key={`${event.status}-${index}`} className="border-l-2 pl-3">
                    <p className="font-medium">{ORDER_STATUS_LABELS[event.status]}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(event.at)} · {event.actor}
                      {event.note ? ` · ${event.note}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
