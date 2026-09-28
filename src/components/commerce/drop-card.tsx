import { LockIcon, ZapIcon } from 'lucide-react'
import Link from 'next/link'

import { Countdown } from '@/components/auction/countdown'
import { giftCardLabel, ProductMedia } from '@/components/product/product-art'
import { WatchButton } from '@/components/product/watch-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatBasisPoints, formatMinor } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { DropView } from '@/server/views'

export function DropStatusBadge({ status }: { status: DropView['status'] }) {
  if (status === 'LIVE')
    return (
      <Badge variant="live" className="font-semibold uppercase">
        <ZapIcon aria-hidden />
        Live drop
      </Badge>
    )
  if (status === 'UPCOMING') return <Badge variant="brand">Upcoming</Badge>
  if (status === 'SOLD_OUT') return <Badge variant="danger">Sold out</Badge>
  return <Badge variant="neutral">Ended</Badge>
}

export function DropCard({
  drop,
  serverTime,
  signedIn,
  className,
}: {
  drop: DropView
  serverTime: number
  signedIn: boolean
  className?: string
}) {
  const soldPercent = drop.stockTotal ? Math.round((drop.sold / drop.stockTotal) * 100) : 0
  const purchasable = drop.status === 'LIVE' && drop.eligibility.eligible
  return (
    <article
      className={cn(
        'relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-card',
        className,
      )}
    >
      <div className="relative">
        <ProductMedia
          art={drop.product.art}
          palette={drop.product.palette}
          uid={`drop-${drop.product.slug}`}
          label={giftCardLabel(drop.product.name)}
          alt={drop.product.name}
          className="aspect-[16/10]"
        />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <DropStatusBadge status={drop.status} />
          {drop.minimumTier ? (
            <Badge variant="outline" className="border-transparent bg-card/90 backdrop-blur">
              <LockIcon aria-hidden />
              {drop.minimumTier.charAt(0) + drop.minimumTier.slice(1).toLowerCase()}+
            </Badge>
          ) : null}
        </div>
        <WatchButton
          type="DROP"
          targetId={drop.slug}
          initialWatched={drop.watched}
          signedIn={signedIn}
          className="absolute top-3 right-3"
        />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h3 className="text-base font-semibold">{drop.title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{drop.subtitle}</p>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="tabular text-2xl font-semibold tracking-tight">
              {formatMinor(drop.dropPriceMinor)}
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="line-through">
                {formatMinor(drop.referencePriceMinor, 'GBP', { trimZeroMinor: true })}
              </span>{' '}
              <span className="font-semibold text-success">
                Save {formatBasisPoints(drop.savingsBps)}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {drop.status === 'UPCOMING'
                ? 'Starts in'
                : drop.status === 'LIVE'
                  ? 'Ends in'
                  : 'Status'}
            </p>
            {drop.status === 'UPCOMING' || drop.status === 'LIVE' ? (
              <Countdown
                status={drop.status === 'UPCOMING' ? 'SCHEDULED' : 'LIVE'}
                startsAt={drop.startsAt}
                closeAt={drop.endsAt}
                remainingAtPauseMs={null}
                serverTime={serverTime}
              />
            ) : (
              <span className="text-sm font-medium text-muted-foreground">
                {drop.status === 'SOLD_OUT' ? 'Sold out' : 'Ended'}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Progress
            value={drop.sold}
            max={drop.stockTotal}
            label={`${soldPercent}% claimed`}
            indicatorClassName={soldPercent > 80 ? 'bg-live' : 'bg-brand'}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              <span className="tabular font-semibold text-foreground">{drop.stockRemaining}</span>{' '}
              of {drop.stockTotal} left
            </span>
            <span>Limit {drop.perCustomerLimit} per member</span>
          </div>
        </div>
        {drop.eligibility.reason && drop.status !== 'ENDED' ? (
          <p className="text-xs text-warning-foreground">{drop.eligibility.reason}</p>
        ) : null}
        <Button
          asChild={purchasable}
          variant={purchasable ? 'brand' : 'outline'}
          disabled={!purchasable}
          className="mt-auto w-full"
        >
          {purchasable ? (
            <Link href={`/checkout?drop=${drop.id}`}>
              Buy for {formatMinor(drop.dropPriceMinor)}
            </Link>
          ) : (
            <span>
              {drop.status === 'UPCOMING'
                ? 'Opens soon'
                : drop.status === 'LIVE'
                  ? 'Not eligible'
                  : 'Unavailable'}
            </span>
          )}
        </Button>
        {!signedIn && drop.status === 'LIVE' ? (
          <p className="-mt-2 text-center text-[11px] text-muted-foreground">
            Enter the demo to purchase.
          </p>
        ) : null}
      </div>
    </article>
  )
}
