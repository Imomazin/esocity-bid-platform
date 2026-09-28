'use client'

import { useEffect, useRef, useState } from 'react'

import { useAuctionPolling, useAuctionSnapshot } from '@/lib/client/auction-store'
import { formatMinor } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { AuctionSnapshot } from '@/server/views'

import { Countdown } from './countdown'
import { AuctionStatusBadge } from './status-badge'

/** Mount once per page to keep the given auctions fresh (demo realtime transport = polling). */
export function AuctionPoller({ ids, intervalMs = 2_500 }: { ids: string[]; intervalMs?: number }) {
  useAuctionPolling(ids, intervalMs)
  return null
}

export function LivePrice({
  initial,
  className,
}: {
  initial: AuctionSnapshot
  className?: string
}) {
  const snapshot = useAuctionSnapshot(initial)
  const price = snapshot.result?.finalPriceMinor ?? snapshot.priceMinor
  const [flash, setFlash] = useState(false)
  const previous = useRef(price)
  useEffect(() => {
    if (previous.current !== price) {
      previous.current = price
      setFlash(true)
      const timeout = setTimeout(() => setFlash(false), 1100)
      return () => clearTimeout(timeout)
    }
  }, [price])
  return (
    <span
      className={cn('tabular rounded-md transition-colors', flash && 'animate-flash', className)}
    >
      {formatMinor(price)}
    </span>
  )
}

export function LiveLeader({
  initial,
  className,
  fallback = 'No bids yet',
}: {
  initial: AuctionSnapshot
  className?: string
  fallback?: string
}) {
  const snapshot = useAuctionSnapshot(initial)
  const name = snapshot.result ? snapshot.result.winnerName : snapshot.leader?.name
  const isViewer = snapshot.result ? snapshot.result.winnerIsViewer : snapshot.leader?.isViewer
  if (!name) return <span className={cn('text-muted-foreground', className)}>{fallback}</span>
  return (
    <span className={cn('truncate font-medium', isViewer && 'text-success', className)}>
      {name}
    </span>
  )
}

export function LiveBidCount({
  initial,
  className,
}: {
  initial: AuctionSnapshot
  className?: string
}) {
  const snapshot = useAuctionSnapshot(initial)
  return (
    <span className={cn('tabular', className)}>{snapshot.bidCount.toLocaleString('en-GB')}</span>
  )
}

export function LiveBidders({
  initial,
  className,
}: {
  initial: AuctionSnapshot
  className?: string
}) {
  const snapshot = useAuctionSnapshot(initial)
  return (
    <span className={cn('tabular', className)}>
      {snapshot.uniqueBidders.toLocaleString('en-GB')}
    </span>
  )
}

export function LiveStatus({
  initial,
  className,
}: {
  initial: AuctionSnapshot
  className?: string
}) {
  const snapshot = useAuctionSnapshot(initial)
  return <AuctionStatusBadge status={snapshot.status} className={className} />
}

export function LiveCountdown({
  initial,
  serverTime,
  size = 'md',
  className,
  announce,
}: {
  initial: AuctionSnapshot
  serverTime: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  announce?: boolean
}) {
  const snapshot = useAuctionSnapshot(initial)
  return (
    <Countdown
      status={snapshot.status}
      startsAt={snapshot.startsAt}
      closeAt={snapshot.closeAt}
      remainingAtPauseMs={snapshot.remainingAtPauseMs}
      serverTime={serverTime}
      size={size}
      className={className}
      announce={announce}
    />
  )
}
