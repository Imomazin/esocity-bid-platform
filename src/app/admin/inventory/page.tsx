import type { Metadata } from 'next'
import Link from 'next/link'

import { AccessDenied, AdminPageHeader, SectionTitle, StatTile } from '@/components/admin/admin-ui'
import { InventoryAdjust } from '@/components/admin/inventory-adjust'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { STOCK_LABELS } from '@/domain/inventory'
import { formatMinor } from '@/lib/money'
import { formatDateTime } from '@/lib/time'
import { adminAccess } from '@/server/auth/admin-access'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Inventory' }

const LEVEL_VARIANTS = {
  IN_STOCK: 'success',
  LOW_STOCK: 'warning',
  OUT_OF_STOCK: 'danger',
} as const

export default async function InventoryPage({ searchParams }: PageProps<'/admin/inventory'>) {
  const access = await adminAccess('inventory.manage')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const params = await searchParams
  const lowOnly = params.filter === 'low'
  const { positions, events, totals } = getBackend().admin.inventory()
  const physical = positions.filter(({ product }) => product.shippingClass !== 'DIGITAL')
  const visible = lowOnly ? physical.filter(({ level }) => level !== 'IN_STOCK') : physical
  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Inventory"
        description="Stock positions are projected from an append-only ledger of received, reserved, released, sold, returned, damaged and adjusted events."
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="On hand"
          value={totals.onHand.toLocaleString('en-GB')}
          hint="Physical units"
        />
        <StatTile
          label="Reserved"
          value={totals.reserved.toLocaleString('en-GB')}
          hint="Auctions & checkouts"
        />
        <StatTile
          label="Available"
          value={totals.available.toLocaleString('en-GB')}
          hint="On hand − reserved"
        />
        <StatTile label="Sold" value={totals.sold.toLocaleString('en-GB')} hint="All time" />
        <StatTile
          label="Damaged / returned"
          value={`${totals.damaged} / ${totals.returned}`}
          hint="All time"
        />
        <StatTile
          label="Stock value (cost)"
          value={formatMinor(totals.stockValueMinor)}
          hint="On hand × unit cost"
        />
      </div>

      <section>
        <SectionTitle
          action={
            <div className="flex gap-2 text-sm">
              <Link
                href="/admin/inventory"
                className={lowOnly ? 'text-muted-foreground hover:text-foreground' : 'font-medium'}
              >
                All
              </Link>
              <span className="text-muted-foreground">·</span>
              <Link
                href="/admin/inventory?filter=low"
                className={lowOnly ? 'font-medium' : 'text-muted-foreground hover:text-foreground'}
              >
                Low & out of stock
              </Link>
            </div>
          }
        >
          Stock positions
        </SectionTitle>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>Level</TH>
                  <TH className="text-right">On hand</TH>
                  <TH className="text-right">Reserved</TH>
                  <TH className="text-right">Available</TH>
                  <TH className="text-right">Sold</TH>
                  <TH>Last movement</TH>
                  <TH className="text-right">
                    <span className="sr-only">Actions</span>
                  </TH>
                </TR>
              </THead>
              <TBody>
                {visible.map(({ product, position, level, lastEventAt }) => (
                  <TR key={product.id}>
                    <TD className="max-w-[280px]">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="line-clamp-1 font-medium hover:underline"
                      >
                        {product.name}
                      </Link>
                      <span className="text-[11px] text-muted-foreground">{product.sku}</span>
                    </TD>
                    <TD>
                      <Badge variant={LEVEL_VARIANTS[level]}>{STOCK_LABELS[level]}</Badge>
                    </TD>
                    <TD className="tabular text-right">{position.onHand}</TD>
                    <TD className="tabular text-right">{position.reserved}</TD>
                    <TD className="tabular text-right font-medium">{position.available}</TD>
                    <TD className="tabular text-right text-muted-foreground">{position.sold}</TD>
                    <TD className="text-xs whitespace-nowrap text-muted-foreground">
                      {lastEventAt ? formatDateTime(lastEventAt) : '—'}
                    </TD>
                    <TD className="text-right">
                      <InventoryAdjust
                        productId={product.id}
                        productName={product.name}
                        available={position.available}
                      />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      </section>

      <section>
        <SectionTitle>Recent ledger events</SectionTitle>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Product</TH>
                  <TH>Event</TH>
                  <TH className="text-right">Qty</TH>
                  <TH>Reference</TH>
                  <TH>By</TH>
                </TR>
              </THead>
              <TBody>
                {events.map((event) => (
                  <TR key={event.id}>
                    <TD className="text-xs whitespace-nowrap text-muted-foreground">
                      {formatDateTime(event.at)}
                    </TD>
                    <TD className="max-w-[240px] truncate">{event.productName}</TD>
                    <TD>
                      <Badge variant="outline">{event.type.toLowerCase().replace('_', ' ')}</Badge>
                    </TD>
                    <TD className="tabular text-right">
                      {event.quantity > 0 ? '+' : ''}
                      {event.quantity}
                    </TD>
                    <TD className="text-xs text-muted-foreground">
                      {event.reference
                        ? `${event.reference.type.toLowerCase()} ${event.reference.id.slice(0, 8)}`
                        : '—'}
                      {event.note ? ` · ${event.note}` : ''}
                    </TD>
                    <TD className="text-xs text-muted-foreground">{event.actor}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      </section>
    </div>
  )
}
