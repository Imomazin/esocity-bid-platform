import { SearchIcon, TriangleAlertIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { AccessDenied, AdminPageHeader } from '@/components/admin/admin-ui'
import { OrderSourceBadge, OrderStatusBadge } from '@/components/commerce/order-status'
import { ChipLink } from '@/components/common/chip-link'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/misc'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { ORDER_STATUS_LABELS, ORDER_STATUSES, type OrderStatus } from '@/domain/orders'
import { formatMinor } from '@/lib/money'
import { formatDateTime } from '@/lib/time'
import { adminAccess } from '@/server/auth/admin-access'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Orders' }

export default async function AdminOrdersPage({ searchParams }: PageProps<'/admin/orders'>) {
  const access = await adminAccess('orders.view')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const params = await searchParams
  const statusParam = typeof params.status === 'string' ? params.status : 'ALL'
  const status = (ORDER_STATUSES as readonly string[]).includes(statusParam)
    ? (statusParam as OrderStatus)
    : 'ALL'
  const q = typeof params.q === 'string' ? params.q : ''
  const page = Math.max(
    1,
    Number.parseInt(typeof params.page === 'string' ? params.page : '1', 10) || 1,
  )
  const result = getBackend().admin.orders({ status, q: q || undefined, page, pageSize: 30 })
  const totalAll = Object.values(result.counts).reduce((sum, value) => sum + value, 0)
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize))
  const href = (next: { status?: string; page?: number }) => {
    const search = new URLSearchParams()
    const nextStatus = next.status ?? status
    if (nextStatus !== 'ALL') search.set('status', nextStatus)
    if (q) search.set('q', q)
    if (next.page && next.page > 1) search.set('page', String(next.page))
    const query = search.toString()
    return `/admin/orders${query ? `?${query}` : ''}`
  }
  return (
    <div>
      <AdminPageHeader
        title="Orders"
        description="Every order across auction wins, Buy Now, marketplace and Flash Drops."
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav
          aria-label="Filter by status"
          className="-mx-1 flex scrollbar-none gap-1.5 overflow-x-auto px-1"
        >
          <ChipLink href={href({ status: 'ALL' })} active={status === 'ALL'}>
            All <span className="text-[11px] opacity-70">{totalAll}</span>
          </ChipLink>
          {ORDER_STATUSES.map((item) => (
            <ChipLink key={item} href={href({ status: item })} active={status === item}>
              {ORDER_STATUS_LABELS[item]}{' '}
              <span className="text-[11px] opacity-70">{result.counts[item] ?? 0}</span>
            </ChipLink>
          ))}
        </nav>
        <form action="/admin/orders" className="relative w-full lg:w-72">
          {status !== 'ALL' ? <input type="hidden" name="status" value={status} /> : null}
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Reference, customer or item"
            className="pl-9"
            aria-label="Search orders"
          />
        </form>
      </div>
      {result.rows.length === 0 ? (
        <EmptyState title="No orders match" description="Try another status or search." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Order</TH>
                  <TH>Customer</TH>
                  <TH>Items</TH>
                  <TH>Status</TH>
                  <TH>Source</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="text-right">Placed</TH>
                </TR>
              </THead>
              <TBody>
                {result.rows.map((order) => (
                  <TR key={order.id}>
                    <TD>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="tabular font-medium hover:underline"
                      >
                        {order.reference}
                      </Link>
                      {order.exception ? (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-warning-foreground">
                          <TriangleAlertIcon className="size-3.5" aria-hidden /> Exception
                        </span>
                      ) : null}
                    </TD>
                    <TD className="max-w-[180px] truncate">{order.customerName}</TD>
                    <TD className="max-w-[240px] truncate text-muted-foreground">
                      {order.lines.map((line) => line.name).join(', ')}
                    </TD>
                    <TD>
                      <OrderStatusBadge status={order.status} />
                    </TD>
                    <TD>
                      <OrderSourceBadge source={order.source} />
                    </TD>
                    <TD className="tabular text-right">{formatMinor(order.totalMinor)}</TD>
                    <TD className="text-right text-xs whitespace-nowrap text-muted-foreground">
                      {formatDateTime(order.createdAt)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
          {pages > 1 ? (
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                Page {result.page} of {pages} · {result.total} orders
              </span>
              <div className="flex gap-3">
                {result.page > 1 ? (
                  <Link href={href({ page: result.page - 1 })} className="font-medium text-brand">
                    Previous
                  </Link>
                ) : null}
                {result.page < pages ? (
                  <Link href={href({ page: result.page + 1 })} className="font-medium text-brand">
                    Next
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </Card>
      )}
    </div>
  )
}
