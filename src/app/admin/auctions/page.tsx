import { PlusIcon, SearchIcon, StarIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { AccessDenied, AdminPageHeader } from '@/components/admin/admin-ui'
import { AuctionStatusBadge } from '@/components/auction/status-badge'
import { ChipLink } from '@/components/common/chip-link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/misc'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { AUCTION_STATUSES, type AuctionStatus } from '@/domain/auction/types'
import { OUTCOME_LABELS } from '@/domain/auction/bidding'
import { formatMinor } from '@/lib/money'
import { formatDateTime, formatRelative } from '@/lib/time'
import { adminAccess } from '@/server/auth/admin-access'
import { hasPermission } from '@/server/auth/roles'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Auctions' }

const TABS: (AuctionStatus | 'ALL')[] = [
  'ALL',
  'LIVE',
  'PAUSED',
  'SCHEDULED',
  'DRAFT',
  'COMPLETED',
  'CANCELLED',
]

export default async function AdminAuctionsPage({ searchParams }: PageProps<'/admin/auctions'>) {
  const access = await adminAccess('auctions.view')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const params = await searchParams
  const statusParam = typeof params.status === 'string' ? params.status : 'ALL'
  const status = (AUCTION_STATUSES as readonly string[]).includes(statusParam)
    ? (statusParam as AuctionStatus)
    : 'ALL'
  const q = typeof params.q === 'string' ? params.q : ''
  const backend = getBackend()
  const { rows, counts } = backend.admin.auctions({ status, q })
  const now = backend.now()
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0)
  const href = (next: { status?: string; q?: string }) => {
    const search = new URLSearchParams()
    const merged = { status: status === 'ALL' ? undefined : status, q: q || undefined, ...next }
    for (const [key, value] of Object.entries(merged))
      if (value && value !== 'ALL') search.set(key, value)
    const query = search.toString()
    return `/admin/auctions${query ? `?${query}` : ''}`
  }
  return (
    <div>
      <AdminPageHeader
        title="Auctions"
        description="Create, schedule and monitor auctions. Winners are always determined by the auction engine — operators cannot choose or change a winner."
        actions={
          hasPermission(access.actor.roles, 'auctions.manage') ? (
            <Button asChild variant="brand">
              <Link href="/admin/auctions/new">
                <PlusIcon /> New auction
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav
          aria-label="Filter by status"
          className="-mx-1 flex scrollbar-none gap-1.5 overflow-x-auto px-1"
        >
          {TABS.map((tab) => (
            <ChipLink key={tab} href={href({ status: tab })} active={status === tab}>
              {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              <span className="tabular text-[11px] opacity-70">
                {tab === 'ALL' ? total : (counts[tab] ?? 0)}
              </span>
            </ChipLink>
          ))}
        </nav>
        <form action="/admin/auctions" className="relative w-full lg:w-72">
          {status !== 'ALL' ? <input type="hidden" name="status" value={status} /> : null}
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search title or ID"
            className="pl-9"
            aria-label="Search auctions"
          />
        </form>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No auctions match" description="Try another status or search term." />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <TR>
                <TH>Auction</TH>
                <TH>Status</TH>
                <TH className="text-right">Price</TH>
                <TH className="text-right">Bids</TH>
                <TH className="text-right">Bidders</TH>
                <TH>Timing</TH>
                <TH>Source</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.id}>
                  <TD className="max-w-[320px]">
                    <Link
                      href={`/admin/auctions/${row.id}`}
                      className="flex items-center gap-1.5 font-medium hover:underline"
                    >
                      {row.featured ? (
                        <StarIcon
                          className="size-3.5 shrink-0 fill-warning text-warning"
                          aria-label="Featured"
                        />
                      ) : null}
                      <span className="line-clamp-1">{row.title}</span>
                    </Link>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {row.id.slice(0, 8)}
                    </span>
                  </TD>
                  <TD>
                    <AuctionStatusBadge status={row.status} />
                    {row.outcome && row.status === 'COMPLETED' ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {OUTCOME_LABELS[row.outcome]}
                      </p>
                    ) : null}
                  </TD>
                  <TD className="tabular text-right">{formatMinor(row.priceMinor)}</TD>
                  <TD className="tabular text-right">{row.bids.toLocaleString('en-GB')}</TD>
                  <TD className="tabular text-right">{row.bidders}</TD>
                  <TD className="text-xs whitespace-nowrap text-muted-foreground">
                    {row.status === 'SCHEDULED' || row.status === 'DRAFT'
                      ? `Starts ${formatDateTime(row.startsAt)}`
                      : row.status === 'LIVE'
                        ? `Closes ${formatRelative(row.closeAt, now)}`
                        : row.status === 'PAUSED'
                          ? 'Clock frozen'
                          : `Ended ${formatDateTime(row.closeAt)}`}
                  </TD>
                  <TD>
                    <Badge variant={row.source === 'ADMIN' ? 'brand' : 'outline'}>
                      {row.source === 'ADMIN' ? 'Operator' : 'Series'}
                    </Badge>
                    {row.memberBids > 0 ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {row.memberBids} member bids
                      </p>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
