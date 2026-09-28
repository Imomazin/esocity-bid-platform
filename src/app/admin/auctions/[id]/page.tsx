import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  BotIcon,
  CalendarClockIcon,
  CirclePauseIcon,
  CirclePlayIcon,
  CircleXIcon,
  RotateCcwIcon,
  UndoIcon,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AdminAction } from '@/components/admin/admin-action'
import { AuctionForm } from '@/components/admin/auction-form'
import { AccessDenied, SectionTitle } from '@/components/admin/admin-ui'
import { AuctionStatusBadge } from '@/components/auction/status-badge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/misc'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { AUTOBID_STATUS_LABELS } from '@/domain/auction/autobid'
import { OUTCOME_LABELS } from '@/domain/auction/bidding'
import type { AuctionStatus } from '@/domain/auction/types'
import { formatBasisPoints, formatMinor } from '@/lib/money'
import { describeDuration, formatDateTime, formatRelative, formatTimeWithSeconds } from '@/lib/time'
import { adminAccess } from '@/server/auth/admin-access'
import { hasPermission } from '@/server/auth/roles'
import { getBackend } from '@/server/runtime'

export const metadata: Metadata = { title: 'Auction' }

const TRANSITION_UI: Partial<
  Record<
    AuctionStatus,
    {
      label: string
      icon: typeof CirclePlayIcon
      variant: 'primary' | 'outline' | 'danger'
      reason?: boolean
      confirm: string
      describe: string
    }
  >
> = {
  SCHEDULED: {
    label: 'Schedule',
    icon: CalendarClockIcon,
    variant: 'primary',
    confirm: 'Schedule this auction?',
    describe: 'One unit of stock is reserved for the auction.',
  },
  LIVE: {
    label: 'Start / resume',
    icon: CirclePlayIcon,
    variant: 'primary',
    confirm: 'Start bidding now?',
    describe: 'The countdown starts (or resumes with the remaining time restored).',
  },
  PAUSED: {
    label: 'Pause',
    icon: CirclePauseIcon,
    variant: 'outline',
    reason: true,
    confirm: 'Pause this live auction?',
    describe:
      'Bidding stops and the remaining time is frozen. Bidders are notified. Auctions cannot be paused in their final 30 seconds.',
  },
  DRAFT: {
    label: 'Unschedule',
    icon: UndoIcon,
    variant: 'outline',
    confirm: 'Return to draft?',
    describe: 'The stock reservation is released.',
  },
  CANCELLED: {
    label: 'Cancel auction',
    icon: CircleXIcon,
    variant: 'danger',
    reason: true,
    confirm: 'Cancel this auction?',
    describe:
      'Bidding ends, all member bids are refunded to their wallets, AutoBid agents stop and stock is released. This cannot be undone.',
  },
}

export default async function AdminAuctionPage({ params }: PageProps<'/admin/auctions/[id]'>) {
  const access = await adminAccess('auctions.view')
  if (!access.allowed)
    return <AccessDenied permission={access.permission} role={access.actor?.role ?? null} />
  const { id } = await params
  const backend = getBackend()
  const detail = await backend.admin.auctionDetail(id)
  if (!detail) notFound()
  const now = backend.now()
  const { state, economics } = detail
  const canManage = hasPermission(access.actor.roles, 'auctions.manage')
  const canCancel = hasPermission(access.actor.roles, 'auctions.cancel')
  const remaining =
    state.status === 'PAUSED' ? (state.remainingAtPauseMs ?? 0) : Math.max(0, state.closeAt - now)
  const products = backend.admin.productsForSelect()

  return (
    <div className="space-y-6">
      <Link
        href="/admin/auctions"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> Auctions
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <AuctionStatusBadge status={state.status} />
            <Badge variant={detail.source === 'ADMIN' ? 'brand' : 'outline'}>
              {detail.source === 'ADMIN' ? 'Operator auction' : 'Recurring series'}
            </Badge>
            {detail.simulated ? <Badge variant="warning">Simulated bidders</Badge> : null}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{state.title}</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{state.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/auction/${state.id}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border bg-card px-4 text-sm font-medium hover:bg-muted"
          >
            Storefront <ArrowUpRightIcon className="size-4" aria-hidden />
          </Link>
          {canManage
            ? detail.allowedTransitions.map((to) => {
                const ui = TRANSITION_UI[to]
                if (!ui || (to === 'CANCELLED' && !canCancel)) return null
                const label =
                  to === 'LIVE' ? (state.status === 'PAUSED' ? 'Resume' : 'Start now') : ui.label
                return (
                  <AdminAction
                    key={to}
                    variant={ui.variant}
                    endpoint={`/api/admin/auctions/${state.id}/transition`}
                    body={{ to }}
                    successMessage={`${label} — done`}
                    confirm={{
                      title: ui.confirm,
                      description: ui.describe,
                      confirmLabel: label,
                      danger: to === 'CANCELLED',
                      reasonField: 'reason',
                      reasonRequired: !!ui.reason,
                      reasonLabel: ui.reason ? 'Reason (required)' : 'Note (optional)',
                    }}
                  >
                    <ui.icon /> {label}
                  </AdminAction>
                )
              })
            : null}
        </div>
      </div>

      {state.status === 'CANCELLED' && state.cancelReason ? (
        <Notice tone="warning" icon={<RotateCcwIcon />} title="Cancelled — member bids refunded">
          {state.cancelReason}
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Current price', value: formatMinor(state.priceMinor) },
          { label: 'Bids', value: state.bidCount.toLocaleString('en-GB') },
          { label: 'Unique bidders', value: state.uniqueBidders.toLocaleString('en-GB') },
          {
            label:
              state.status === 'COMPLETED' || state.status === 'CANCELLED'
                ? 'Closed'
                : state.status === 'SCHEDULED' || state.status === 'DRAFT'
                  ? 'Starts'
                  : 'Time left',
            value:
              state.status === 'COMPLETED' || state.status === 'CANCELLED'
                ? formatDateTime(state.result?.closedAt ?? state.updatedAt)
                : state.status === 'SCHEDULED' || state.status === 'DRAFT'
                  ? formatDateTime(state.startsAt)
                  : describeDuration(remaining),
          },
          {
            label: 'Leader',
            value: state.leaderName
              ? `${state.leaderName}${state.leaderSimulated ? ' (sim.)' : ''}`
              : '—',
          },
          {
            label: 'Outcome',
            value: state.result ? OUTCOME_LABELS[state.result.outcome] : 'Pending',
          },
        ].map((item) => (
          <Card key={item.label} className="p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 truncate text-base font-semibold">{item.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <section>
            <SectionTitle>Rules</SectionTitle>
            {canManage ? (
              <AuctionForm
                mode="edit"
                auctionId={state.id}
                status={state.status}
                products={products}
                initialRules={state.rules}
                initialMeta={{
                  productId: state.productId,
                  title: state.title,
                  description: detail.description ?? '',
                  featured: state.featured,
                  startsAt: state.startsAt,
                }}
                lockedFields={detail.lockedFields}
              />
            ) : (
              <Notice tone="neutral">
                Your role can view auctions but not change their rules.
              </Notice>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Economics (estimate)</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                {[
                  [
                    'Bid credit revenue (purchased bids)',
                    formatMinor(economics.bidCreditRevenueEstimateMinor),
                  ],
                  ['Winner payment', formatMinor(economics.winnerPaymentMinor)],
                  [
                    `Buy Now revenue (${detail.buyNowConversions} sales)`,
                    formatMinor(economics.buyNowRevenueMinor),
                  ],
                  ['Gross revenue estimate', formatMinor(economics.grossRevenueEstimateMinor)],
                  [
                    `Product cost (unit ${formatMinor(detail.product.costPriceMinor)})`,
                    `−${formatMinor(economics.productCostMinor)}`,
                  ],
                  [
                    'Gross contribution estimate',
                    formatMinor(economics.grossContributionEstimateMinor),
                  ],
                  ['Avg bids per bidder', economics.averageBidsPerBidder.toFixed(1)],
                  [
                    'Winner’s total cost (price + bids)',
                    formatMinor(economics.winnerTotalCostMinor),
                  ],
                  ['Winner saving vs reference', formatBasisPoints(economics.winnerSavingsBps)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="tabular font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">
                Excludes: {economics.exclusions.join('; ')}. Not a profit figure.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top participants</CardTitle>
            </CardHeader>
            <Table>
              <THead>
                <TR>
                  <TH>Bidder</TH>
                  <TH className="text-right">Bids</TH>
                  <TH className="text-right">Purchased</TH>
                  <TH className="text-right">Promo</TH>
                </TR>
              </THead>
              <TBody>
                {detail.participants.length === 0 ? (
                  <TR>
                    <TD colSpan={4} className="text-muted-foreground">
                      No bids yet.
                    </TD>
                  </TR>
                ) : (
                  detail.participants.map((participant) => (
                    <TR key={participant.bidderId}>
                      <TD>
                        {participant.bidderName}{' '}
                        {participant.simulated ? (
                          <Badge variant="neutral">sim.</Badge>
                        ) : (
                          <Badge variant="brand">member</Badge>
                        )}
                      </TD>
                      <TD className="tabular text-right">{participant.bids}</TD>
                      <TD className="tabular text-right">{participant.purchasedCreditsSpent}</TD>
                      <TD className="tabular text-right">{participant.promotionalCreditsSpent}</TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent bids</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.recentBids.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bids yet.</p>
              ) : (
                <ol className="space-y-1.5 text-sm">
                  {detail.recentBids.map((bid) => (
                    <li key={bid.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">
                        <span className="tabular text-muted-foreground">#{bid.sequence}</span>{' '}
                        {bid.bidderName}
                        {bid.kind === 'AUTOBID' ? (
                          <BotIcon
                            className="ml-1 inline size-3.5 text-brand"
                            aria-label="AutoBid"
                          />
                        ) : null}
                        {bid.simulated ? (
                          <span className="ml-1 text-xs text-muted-foreground">(sim.)</span>
                        ) : null}
                      </span>
                      <span className="tabular shrink-0">
                        {formatMinor(bid.priceAfterMinor)}{' '}
                        <span className="text-xs text-muted-foreground">
                          {formatTimeWithSeconds(bid.placedAt)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AutoBid agents</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.autobids.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No member AutoBid agents on this auction.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {detail.autobids.map((rule) => (
                    <li key={rule.id} className="flex items-center justify-between gap-3">
                      <span>
                        {rule.userName} · {rule.bidsPlaced}/{rule.maxBids} bids
                        {rule.maxPriceMinor !== null
                          ? ` · max ${formatMinor(rule.maxPriceMinor)}`
                          : ''}
                      </span>
                      <Badge variant={rule.status === 'ACTIVE' ? 'success' : 'neutral'}>
                        {AUTOBID_STATUS_LABELS[rule.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit trail</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">No operator actions recorded yet.</p>
              ) : (
                <ol className="space-y-3 text-sm">
                  {detail.audit.map((event) => (
                    <li key={event.id} className="border-l-2 pl-3">
                      <p className="font-medium">{event.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.actor.name}
                        {event.actor.role ? ` (${event.actor.role})` : ''} ·{' '}
                        {formatRelative(event.occurredAt, now)} · {event.action}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
