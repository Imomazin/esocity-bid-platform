import { TriangleAlertIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { AdminAction } from '@/components/admin/admin-action'
import { AccessDenied, AdminPageHeader } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { Notice } from '@/components/ui/misc'
import { nextFulfilmentStatus, ORDER_STATUS_LABELS, type Order } from '@/domain/orders'
import { formatMinor } from '@/lib/money'
import { formatRelative } from '@/lib/time'
import { adminAccess } from '@/server/auth/admin-access'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Fulfilment' }

function OrderCard({ order, now, advance }: { order: Order; now: number; advance: boolean }) {
  const next = nextFulfilmentStatus(order.status)
  return (
    <li className="rounded-xl border bg-card p-3 text-sm shadow-card">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/admin/orders/${order.id}`} className="tabular font-medium hover:underline">
          {order.reference}
        </Link>
        <span className="text-xs text-muted-foreground">
          {formatRelative(order.updatedAt, now)}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {order.lines.map((line) => `${line.quantity}× ${line.name}`).join(', ')}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs">
          {order.shippingMethod.toLowerCase().replace('_', ' ')} · {formatMinor(order.totalMinor)}
        </span>
        {advance && next && next !== 'DELIVERED' ? (
          <AdminAction
            size="xs"
            variant="outline"
            endpoint={`/api/admin/orders/${order.id}/status`}
            body={{ to: next }}
            successMessage={`${order.reference} → ${ORDER_STATUS_LABELS[next]}`}
          >
            {ORDER_STATUS_LABELS[next]} →
          </AdminAction>
        ) : null}
      </div>
      {order.trackingNumber ? (
        <p className="tabular mt-1.5 text-[11px] text-muted-foreground">{order.trackingNumber}</p>
      ) : null}
    </li>
  )
}

export default async function FulfilmentPage() {
  const access = await adminAccess('orders.manage')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const backend = getBackend()
  const board = backend.admin.fulfilment()
  const now = backend.now()
  const columns: { key: keyof typeof board; title: string; advance: boolean }[] = [
    { key: 'awaiting', title: 'Paid · to pick', advance: true },
    { key: 'processing', title: 'Processing', advance: true },
    { key: 'packed', title: 'Packed', advance: true },
    { key: 'shipped', title: 'Shipped', advance: false },
    { key: 'delivered', title: 'Delivered (recent)', advance: false },
  ]
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Fulfilment"
        description="Orders from the last 14 days by stage. Advancing to Shipped creates a shipment and tracking number (simulated carrier in demo mode)."
      />
      {board.slaBreaches > 0 ? (
        <Notice
          tone="warning"
          icon={<TriangleAlertIcon />}
          title={`${board.slaBreaches} paid orders waiting more than 24 hours`}
        >
          These are outside the dispatch target. Prioritise the oldest orders in the first column.
        </Notice>
      ) : null}
      {board.exceptions.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Exceptions</h2>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {board.exceptions.map((order) => (
              <li
                key={order.id}
                className="rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm"
              >
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="tabular font-medium hover:underline"
                >
                  {order.reference}
                </Link>{' '}
                <Badge variant="warning">{order.exception?.code}</Badge>
                <p className="mt-1 text-xs text-warning-foreground">{order.exception?.message}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {columns.map((column) => {
          const orders = board[column.key] as Order[]
          return (
            <section
              key={column.key}
              aria-labelledby={`col-${column.key}`}
              className="rounded-2xl bg-muted/50 p-3"
            >
              <h2
                id={`col-${column.key}`}
                className="mb-3 flex items-center justify-between px-1 text-sm font-semibold"
              >
                {column.title}
                <span className="tabular rounded-full bg-background px-2 text-xs font-medium">
                  {orders.length}
                </span>
              </h2>
              {orders.length === 0 ? (
                <p className="px-1 pb-2 text-xs text-muted-foreground">Nothing here.</p>
              ) : (
                <ul className="space-y-2">
                  {orders.slice(0, 20).map((order) => (
                    <OrderCard key={order.id} order={order} now={now} advance={column.advance} />
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
