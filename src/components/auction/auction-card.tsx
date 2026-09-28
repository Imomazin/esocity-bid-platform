import { CrownIcon, ShieldCheckIcon, UsersIcon } from 'lucide-react'
import Link from 'next/link'

import { giftCardLabel, ProductMedia } from '@/components/product/product-art'
import { WatchButton } from '@/components/product/watch-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatBasisPoints, formatMinor, money, savingsBasisPoints } from '@/lib/money'
import { formatRelative } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { AuctionCard as AuctionCardView } from '@/server/views'

import { LiveBidders, LiveCountdown, LiveLeader, LivePrice, LiveStatus } from './live-bits'

export function AuctionCard({
  auction,
  serverTime,
  signedIn,
  className,
}: {
  auction: AuctionCardView
  serverTime: number
  signedIn: boolean
  className?: string
}) {
  const completed = auction.status === 'COMPLETED'
  const scheduled = auction.status === 'SCHEDULED'
  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-raised',
        className,
      )}
    >
      <Link
        href={`/auction/${auction.id}`}
        className="absolute inset-0 z-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`View auction: ${auction.title}`}
      />
      <div className="pointer-events-none relative">
        <ProductMedia
          art={auction.product.art}
          palette={auction.product.palette}
          uid={auction.product.slug}
          label={giftCardLabel(auction.product.name)}
          alt={auction.title}
          className="aspect-[16/11] transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <LiveStatus initial={auction} className="shadow-card" />
          {auction.label ? (
            <Badge
              variant="outline"
              className="border-transparent bg-card/90 shadow-card backdrop-blur"
            >
              {auction.rules.minimumTier ? <ShieldCheckIcon aria-hidden /> : null}
              {auction.label}
            </Badge>
          ) : null}
        </div>
      </div>
      <WatchButton
        type="AUCTION"
        targetId={auction.id}
        initialWatched={auction.watched}
        signedIn={signedIn}
        className="absolute top-3 right-3 z-10"
      />
      <div className="pointer-events-none relative flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{auction.product.brandName}</p>
          <h3 className="line-clamp-2 min-h-10 text-sm leading-snug font-semibold">
            {auction.title}
          </h3>
        </div>
        {completed && auction.result ? (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="tabular text-xl font-semibold tracking-tight">
                {formatMinor(auction.result.finalPriceMinor)}
              </span>
              <span className="text-xs font-semibold text-success">
                {formatBasisPoints(
                  savingsBasisPoints(
                    money(auction.product.referencePriceMinor),
                    money(auction.result.finalPriceMinor),
                  ),
                )}{' '}
                below reference
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {auction.result.outcome === 'WON' ? (
                <>
                  Won by{' '}
                  <span className="font-medium text-foreground">{auction.result.winnerName}</span> ·
                  used {auction.result.winnerBidCount} bids ·{' '}
                  {formatRelative(auction.result.closedAt, serverTime)}
                </>
              ) : (
                'Closed without a sale — bids refunded'
              )}
            </p>
            <p className="text-[11px] text-subtle-foreground">
              Reference value{' '}
              {formatMinor(auction.product.referencePriceMinor, 'GBP', { trimZeroMinor: true })} ·
              demo data
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {scheduled ? 'Opening price' : 'Current price'}
                </p>
                <p className="text-xl font-semibold tracking-tight">
                  <LivePrice initial={auction} />
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Reference{' '}
                  <span className="tabular">
                    {formatMinor(auction.product.referencePriceMinor, 'GBP', {
                      trimZeroMinor: true,
                    })}
                  </span>
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {scheduled ? 'Starts in' : 'Time left'}
                </p>
                <LiveCountdown initial={auction} serverTime={serverTime} size="md" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
              <span className="flex min-w-0 items-center gap-1.5">
                <CrownIcon className="size-3.5 shrink-0 text-warning" aria-hidden />
                <span className="sr-only">Leader:</span>
                <LiveLeader initial={auction} fallback={scheduled ? 'Opens soon' : 'No bids yet'} />
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <UsersIcon className="size-3.5" aria-hidden />
                <LiveBidders initial={auction} /> bidders
              </span>
            </div>
          </>
        )}
        <div className="pointer-events-auto relative z-10 mt-auto flex gap-2">
          <Button asChild variant={completed ? 'outline' : 'brand'} size="sm" className="flex-1">
            <Link href={`/auction/${auction.id}`}>
              {completed
                ? 'View result'
                : scheduled
                  ? 'Preview auction'
                  : `Bid · ${auction.rules.bidCreditCost} credit${auction.rules.bidCreditCost > 1 ? 's' : ''}`}
            </Link>
          </Button>
          {auction.rules.buyNowEnabled && !completed ? (
            <Button asChild variant="outline" size="sm" title="Buy it now at a fixed price">
              <Link href={`/checkout?auction=${auction.id}`}>
                Buy {formatMinor(auction.rules.buyNowPriceMinor, 'GBP', { trimZeroMinor: true })}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
