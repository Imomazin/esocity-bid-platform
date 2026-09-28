'use client'

import {
  BotIcon,
  CheckCircle2Icon,
  CoinsIcon,
  CrownIcon,
  EyeIcon,
  GavelIcon,
  InfoIcon,
  Loader2Icon,
  PartyPopperIcon,
  ShieldAlertIcon,
  ShoppingBagIcon,
  TimerIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { EnterDemoButton } from '@/components/layout/enter-demo-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FieldHint, Input, Label } from '@/components/ui/input'
import { Notice } from '@/components/ui/misc'
import { COMPLIANCE_MESSAGES } from '@/domain/compliance'
import { api, ApiError, newIdempotencyKey } from '@/lib/client/api'
import { putSnapshot, seedSnapshot, useAuctionSnapshot } from '@/lib/client/auction-store'
import { seedServerTime, serverNow, useServerNow } from '@/lib/client/clock'
import { emit } from '@/lib/client/events'
import { formatBasisPoints, formatMinor, money, parseMajor, savingsBasisPoints } from '@/lib/money'
import { formatDateTime, formatRelative } from '@/lib/time'
import { cn } from '@/lib/utils'
import type {
  AuctionDetail,
  AuctionSnapshot,
  AutoBidView,
  BidResultView,
  LiveAuctionPayload,
  ViewerAuctionState,
} from '@/server/views'

import { Countdown } from './countdown'
import { AuctionStatusBadge } from './status-badge'

type BidState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'accepted' }
  | { kind: 'outbid' }
  | { kind: 'error'; code: string; message: string }

function snapshotOf(detail: AuctionDetail): AuctionSnapshot {
  return {
    id: detail.id,
    status: detail.status,
    priceMinor: detail.priceMinor,
    startsAt: detail.startsAt,
    closeAt: detail.closeAt,
    hardCloseAt: detail.hardCloseAt,
    remainingAtPauseMs: detail.remainingAtPauseMs,
    bidCount: detail.bidCount,
    uniqueBidders: detail.uniqueBidders,
    leader: detail.leader,
    lastBidAt: detail.lastBidAt,
    version: detail.version,
    result: detail.result,
  }
}

const ERROR_TITLES: Record<string, string> = {
  AUCTION_ENDED: 'Auction ended',
  AUCTION_NOT_LIVE: 'Not open for bidding',
  AUCTION_PAUSED: 'Auction paused',
  INSUFFICIENT_CREDITS: 'Insufficient bids',
  RATE_LIMITED: 'Rate limited',
  ALREADY_LEADING: 'You’re already leading',
  RESPONSIBLE_USE_LIMIT: 'Limit reached',
  NOT_ELIGIBLE: 'Not eligible',
  ACCOUNT_RESTRICTED: 'Bidding unavailable',
  BID_LIMIT_REACHED: 'Bid limit reached',
  NETWORK: 'Connection problem',
}

export function LiveAuctionPanel({
  initial,
  signedIn,
}: {
  initial: AuctionDetail
  signedIn: boolean
}) {
  const reduceMotion = useReducedMotion()
  const [live, setLive] = useState<LiveAuctionPayload>(() => ({
    serverTime: initial.serverTime,
    snapshot: snapshotOf(initial),
    recentBids: initial.recentBids,
    viewer: initial.viewer,
  }))
  const [bidState, setBidState] = useState<BidState>({ kind: 'idle' })
  const controlRef = useRef<HTMLDivElement>(null)
  const [controlInView, setControlInView] = useState(true)
  const submitting = useRef(false)
  const retryKey = useRef<string | null>(null)
  const wasLeader = useRef<boolean>(initial.viewer?.isLeader ?? false)

  useEffect(() => {
    seedServerTime(initial.serverTime)
    seedSnapshot(snapshotOf(initial))
  }, [initial])

  const snapshot = useAuctionSnapshot(live.snapshot)
  const now = useServerNow(initial.serverTime)
  const viewer = live.viewer

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const data = await api<LiveAuctionPayload>(`/api/auctions/${initial.id}/live`, { signal })
      putSnapshot(data.snapshot)
      setLive(data)
      return data
    },
    [initial.id],
  )

  // Poll the authoritative state (demo realtime transport). Faster while live.
  useEffect(() => {
    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | null = null
    const controller = new AbortController()
    const loop = async () => {
      if (cancelled) return
      if (document.visibilityState === 'visible') {
        try {
          await refresh(controller.signal)
        } catch {
          // Ignore transient errors; next poll retries.
        }
      }
      if (!cancelled) timeout = setTimeout(loop, snapshot.status === 'LIVE' ? 1_000 : 5_000)
    }
    timeout = setTimeout(loop, 800)
    return () => {
      cancelled = true
      controller.abort()
      if (timeout) clearTimeout(timeout)
    }
  }, [refresh, snapshot.status])

  // Outbid detection (server state is authoritative; this only drives UI feedback).
  useEffect(() => {
    const leading = snapshot.leader?.isViewer ?? false
    if (wasLeader.current && !leading && snapshot.status === 'LIVE') {
      setBidState({ kind: 'outbid' })
      toast.warning('You’ve been outbid', {
        description: `Price now ${formatMinor(snapshot.priceMinor)}.`,
      })
    }
    wasLeader.current = leading
  }, [snapshot.leader?.isViewer, snapshot.priceMinor, snapshot.status])

  useEffect(() => {
    if (viewer) emit('wallet:balance', { available: viewer.walletAvailable })
  }, [viewer])

  // Tracks whether the main bid control is on screen (the bottom 56px sit under the mobile tab bar).
  useEffect(() => {
    const element = controlRef.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setControlInView(entry?.isIntersecting ?? true),
      { rootMargin: '0px 0px -56px 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const placeBid = async () => {
    if (submitting.current) return
    submitting.current = true
    setBidState({ kind: 'submitting' })
    const key = retryKey.current ?? newIdempotencyKey()
    retryKey.current = key
    try {
      const result = await api<BidResultView>(`/api/auctions/${initial.id}/bid`, {
        method: 'POST',
        body: {},
        idempotencyKey: key,
      })
      retryKey.current = null
      putSnapshot(result.snapshot)
      wasLeader.current = true
      emit('wallet:balance', { available: result.walletAvailable })
      setBidState({ kind: 'accepted' })
      setTimeout(
        () => setBidState((state) => (state.kind === 'accepted' ? { kind: 'idle' } : state)),
        1_400,
      )
      void refresh()
    } catch (error) {
      const apiError =
        error instanceof ApiError ? error : new ApiError('INTERNAL', 'Bid could not be placed.', 0)
      if (apiError.code !== 'NETWORK') retryKey.current = null
      setBidState({ kind: 'error', code: apiError.code, message: apiError.message })
      if (apiError.code === 'IDEMPOTENCY_IN_PROGRESS') setBidState({ kind: 'submitting' })
      void refresh().catch(() => undefined)
    } finally {
      submitting.current = false
    }
  }

  const remainingMs = snapshot.status === 'LIVE' ? Math.max(0, snapshot.closeAt - now) : 0
  const extensionMs = initial.fullRules.timerExtensionSeconds * 1000
  const inClosingWindow = snapshot.status === 'LIVE' && remainingMs <= extensionMs
  const leading = snapshot.leader?.isViewer ?? false
  const completed = snapshot.status === 'COMPLETED'
  const referenceMinor = initial.product.referencePriceMinor

  return (
    <div className="space-y-4">
      <section
        aria-labelledby="live-panel-heading"
        className="overflow-hidden rounded-3xl border bg-card shadow-raised"
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
          <h2 id="live-panel-heading" className="sr-only">
            Live auction status
          </h2>
          <AuctionStatusBadge status={snapshot.status} />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <EyeIcon className="size-3.5" aria-hidden />{' '}
              {initial.watchingCount.toLocaleString('en-GB')} watching
            </span>
            <span className="flex items-center gap-1">
              <UsersIcon className="size-3.5" aria-hidden /> {snapshot.uniqueBidders} bidders
            </span>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {completed && snapshot.result ? (
            <ResultBlock
              snapshot={snapshot}
              referenceMinor={referenceMinor}
              viewer={viewer}
              auctionId={initial.id}
              serverTime={now}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 items-end gap-4">
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {snapshot.status === 'SCHEDULED' ? 'Opening price' : 'Current price'}
                  </p>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.p
                      key={snapshot.priceMinor}
                      initial={reduceMotion ? false : { y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={reduceMotion ? undefined : { y: -12, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="tabular text-4xl font-semibold tracking-tight sm:text-5xl"
                    >
                      {formatMinor(snapshot.priceMinor)}
                    </motion.p>
                  </AnimatePresence>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reference value{' '}
                    <span className="tabular">
                      {formatMinor(referenceMinor, 'GBP', { trimZeroMinor: true })}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {snapshot.status === 'SCHEDULED'
                      ? 'Starts in'
                      : snapshot.status === 'PAUSED'
                        ? 'Paused'
                        : 'Time left'}
                  </p>
                  <Countdown
                    status={snapshot.status}
                    startsAt={snapshot.startsAt}
                    closeAt={snapshot.closeAt}
                    remainingAtPauseMs={snapshot.remainingAtPauseMs}
                    serverTime={initial.serverTime}
                    size="xl"
                    announce
                  />
                </div>
              </div>

              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="presentation"
                title={inClosingWindow ? 'Closing window: every bid resets the clock' : undefined}
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-1000 ease-linear',
                    inClosingWindow
                      ? remainingMs < 5_000
                        ? 'bg-live'
                        : 'bg-warning'
                      : 'bg-brand/40',
                  )}
                  style={{
                    width: `${inClosingWindow ? Math.max(2, (remainingMs / extensionMs) * 100) : snapshot.status === 'LIVE' ? 100 : 0}%`,
                  }}
                />
              </div>

              <div
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm',
                  leading ? 'bg-success-soft text-success-foreground' : 'bg-muted',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <CrownIcon
                    className={cn('size-4 shrink-0', leading ? 'text-success' : 'text-warning')}
                    aria-hidden
                  />
                  {snapshot.leader ? (
                    leading ? (
                      <span className="font-semibold">You’re the highest bidder</span>
                    ) : (
                      <span className="truncate">
                        Leading: <span className="font-semibold">{snapshot.leader.name}</span>
                        {snapshot.leader.simulated ? (
                          <span className="ml-1 text-xs text-muted-foreground">(simulated)</span>
                        ) : null}
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground">
                      {snapshot.status === 'SCHEDULED'
                        ? 'Bidding opens when the countdown ends'
                        : 'No bids yet — be the first'}
                    </span>
                  )}
                </span>
                <span className="tabular shrink-0 text-xs text-muted-foreground">
                  {snapshot.bidCount.toLocaleString('en-GB')} bids
                </span>
              </div>

              <div ref={controlRef}>
                <BidControl
                  signedIn={signedIn}
                  snapshot={snapshot}
                  viewer={viewer}
                  bidState={bidState}
                  remainingMs={remainingMs}
                  cost={initial.fullRules.bidCreditCost}
                  incrementMinor={initial.fullRules.bidIncrementMinor}
                  onBid={placeBid}
                  auctionId={initial.id}
                />
              </div>

              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  Each bid costs {initial.fullRules.bidCreditCost} bid credit
                  {initial.fullRules.bidCreditCost > 1 ? 's' : ''}, raises the price by{' '}
                  {formatMinor(initial.fullRules.bidIncrementMinor)} and guarantees at least{' '}
                  {initial.fullRules.timerExtensionSeconds}s remain. The winner is decided by our
                  server when its clock reaches zero.{' '}
                  <Link href="/auction-rules" className="underline underline-offset-2">
                    Rules
                  </Link>
                </span>
              </p>
            </>
          )}
        </div>
      </section>

      {signedIn && viewer && !completed && snapshot.status !== 'CANCELLED' ? (
        <AutoBidPanel
          auctionId={initial.id}
          viewer={viewer}
          priceMinor={snapshot.priceMinor}
          incrementMinor={initial.fullRules.bidIncrementMinor}
          onChange={() => void refresh()}
        />
      ) : null}

      {initial.rules.buyNowEnabled ? (
        <BuyNowPanel auction={initial} viewer={viewer} signedIn={signedIn} completed={completed} />
      ) : null}

      <BidHistory bids={live.recentBids} serverTime={now} simulated={initial.simulatedBidders} />

      {!completed && snapshot.status !== 'CANCELLED' ? (
        <MobileBidBar
          visible={!controlInView}
          action={bidAction({
            signedIn,
            viewer,
            snapshot,
            remainingMs,
            cost: initial.fullRules.bidCreditCost,
          })}
          snapshot={snapshot}
          serverTime={initial.serverTime}
          cost={initial.fullRules.bidCreditCost}
          bidState={bidState}
          onBid={placeBid}
          auctionId={initial.id}
        />
      ) : null}
    </div>
  )
}

type BidAction =
  | { kind: 'enter-demo' }
  | { kind: 'disabled'; reason: string; tone: 'success' | 'muted' }
  | { kind: 'top-up' }
  | { kind: 'bid' }

/** What the bid button should offer right now. Shared by the main control and the mobile bar. */
function bidAction({
  signedIn,
  viewer,
  snapshot,
  remainingMs,
  cost,
}: {
  signedIn: boolean
  viewer: ViewerAuctionState | null
  snapshot: AuctionSnapshot
  remainingMs: number
  cost: number
}): BidAction {
  if (!signedIn || !viewer) return { kind: 'enter-demo' }
  const muted = (reason: string): BidAction => ({ kind: 'disabled', reason, tone: 'muted' })
  if (snapshot.status === 'SCHEDULED') return muted('Bidding opens soon')
  if (snapshot.status === 'PAUSED') return muted('Auction paused')
  if (snapshot.status === 'CANCELLED') return muted('Auction cancelled')
  if (snapshot.status !== 'LIVE') return muted('Auction ended')
  if (remainingMs <= 0) return muted('Finalising…')
  if (snapshot.leader?.isViewer)
    return { kind: 'disabled', reason: 'You’re the highest bidder', tone: 'success' }
  if (!viewer.eligibility.eligible) return muted('Not eligible for this auction')
  if (!viewer.limits.allowed) return muted('Your bid limit is reached')
  if (viewer.walletAvailable < cost) return { kind: 'top-up' }
  return { kind: 'bid' }
}

/**
 * Phones: price, countdown and the bid action pinned above the tab bar whenever the main bid
 * control has scrolled out of view, so a bidder never has to hunt for the button in the final seconds.
 */
function MobileBidBar({
  visible,
  action,
  snapshot,
  serverTime,
  cost,
  bidState,
  onBid,
  auctionId,
}: {
  visible: boolean
  action: BidAction
  snapshot: AuctionSnapshot
  serverTime: number
  cost: number
  bidState: BidState
  onBid: () => void
  auctionId: string
}) {
  const submittingNow = bidState.kind === 'submitting'
  return (
    <div
      className={cn(
        'fixed inset-x-0 z-30 border-t bg-background/95 px-4 py-2.5 shadow-raised backdrop-blur-lg transition-[opacity,transform] duration-200 lg:hidden',
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
      )}
      style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
      aria-hidden={!visible}
      inert={!visible}
      data-testid="mobile-bid-bar"
    >
      <div className="mx-auto flex max-w-md items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="tabular text-lg leading-tight font-semibold">
            {formatMinor(snapshot.priceMinor)}
          </p>
          <Countdown
            status={snapshot.status}
            startsAt={snapshot.startsAt}
            closeAt={snapshot.closeAt}
            remainingAtPauseMs={snapshot.remainingAtPauseMs}
            serverTime={serverTime}
            size="sm"
          />
        </div>
        {action.kind === 'enter-demo' ? (
          <EnterDemoButton size="lg" redirectTo={`/auction/${auctionId}`}>
            Enter demo
          </EnterDemoButton>
        ) : action.kind === 'disabled' ? (
          <Button
            size="lg"
            disabled
            className={cn(
              'max-w-[60%]',
              action.tone === 'success' && 'bg-success text-white opacity-100 disabled:opacity-100',
            )}
          >
            {action.tone === 'success' ? <CheckCircle2Icon /> : <TimerIcon />}
            <span className="truncate">
              {action.tone === 'success' ? 'You’re leading' : action.reason}
            </span>
          </Button>
        ) : action.kind === 'top-up' ? (
          <Button asChild size="lg" variant="outline">
            <Link href="/buy-bids">
              <CoinsIcon />
              Top up
            </Link>
          </Button>
        ) : (
          <Button
            size="lg"
            variant="brand"
            onClick={onBid}
            disabled={submittingNow}
            aria-busy={submittingNow}
          >
            {submittingNow ? <Loader2Icon className="animate-spin" /> : <GavelIcon />}
            {bidState.kind === 'accepted'
              ? 'Bid accepted'
              : `Bid now · ${cost} credit${cost > 1 ? 's' : ''}`}
          </Button>
        )}
      </div>
    </div>
  )
}

function BidControl({
  signedIn,
  snapshot,
  viewer,
  bidState,
  remainingMs,
  cost,
  incrementMinor,
  onBid,
  auctionId,
}: {
  signedIn: boolean
  snapshot: AuctionSnapshot
  viewer: ViewerAuctionState | null
  bidState: BidState
  remainingMs: number
  cost: number
  incrementMinor: number
  onBid: () => void
  auctionId: string
}) {
  if (!signedIn || !viewer) {
    return (
      <div className="space-y-2">
        <EnterDemoButton size="xl" className="w-full" redirectTo={`/auction/${auctionId}`}>
          Enter demo to bid
        </EnterDemoButton>
        <p className="text-center text-xs text-muted-foreground">
          Get a demo Bid Wallet instantly — no real money involved.
        </p>
      </div>
    )
  }
  const action = bidAction({ signedIn, viewer, snapshot, remainingMs, cost })
  const submittingNow = bidState.kind === 'submitting'
  const accepted = bidState.kind === 'accepted'

  return (
    <div className="space-y-3">
      {action.kind === 'disabled' ? (
        <Button
          size="xl"
          disabled
          className={cn(
            'w-full',
            action.tone === 'success' && 'bg-success text-white opacity-100 disabled:opacity-100',
          )}
          aria-live="polite"
        >
          {action.tone === 'success' ? <CheckCircle2Icon /> : <TimerIcon />}
          {action.reason}
        </Button>
      ) : action.kind === 'top-up' ? (
        <Button asChild size="xl" variant="outline" className="w-full">
          <Link href="/buy-bids">
            <CoinsIcon />
            Insufficient bids — top up
          </Link>
        </Button>
      ) : (
        <Button
          size="xl"
          variant="brand"
          className={cn(
            'w-full text-base',
            accepted && 'bg-success hover:bg-success',
            bidState.kind === 'outbid' && 'animate-pulse',
          )}
          onClick={onBid}
          disabled={submittingNow}
          aria-live="polite"
          aria-busy={submittingNow}
        >
          {submittingNow ? (
            <>
              <Loader2Icon className="animate-spin" /> Submitting…
            </>
          ) : accepted ? (
            <>
              <CheckCircle2Icon /> Bid accepted
            </>
          ) : (
            <>
              <GavelIcon /> {bidState.kind === 'outbid' ? 'Outbid — bid again' : 'Place bid'} ·{' '}
              {cost} credit{cost > 1 ? 's' : ''}
              <span className="ml-1 rounded-md bg-white/15 px-1.5 py-0.5 text-xs font-medium">
                +{formatMinor(incrementMinor)}
              </span>
            </>
          )}
        </Button>
      )}

      {bidState.kind === 'error' ? (
        <Notice
          tone={
            bidState.code === 'RATE_LIMITED' || bidState.code === 'NETWORK' ? 'warning' : 'danger'
          }
          icon={<ShieldAlertIcon />}
          title={ERROR_TITLES[bidState.code] ?? 'Bid not placed'}
        >
          {bidState.message}
          {bidState.code === 'INSUFFICIENT_CREDITS' ? (
            <>
              {' '}
              <Link href="/buy-bids" className="font-medium underline">
                Buy bids
              </Link>
            </>
          ) : null}
          {bidState.code === 'NETWORK'
            ? ' Tap the button again to retry safely — you won’t be charged twice.'
            : null}
        </Notice>
      ) : null}
      {!viewer.eligibility.eligible ? (
        <Notice tone="warning">
          {viewer.eligibility.reasons.join(' ')}
          {viewer.eligibility.reasons.includes(COMPLIANCE_MESSAGES.TERMS) ? (
            <>
              {' '}
              <Link href="/terms" className="font-medium underline">
                Review the terms
              </Link>
            </>
          ) : null}
        </Notice>
      ) : null}
      {!viewer.limits.allowed ? (
        <Notice tone="brand" title="Responsible-use limit">
          {viewer.limits.message}{' '}
          <Link href="/account#responsible-use" className="font-medium underline">
            Review limits
          </Link>
        </Notice>
      ) : null}

      <div className="flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <CoinsIcon className="size-4 text-brand" aria-hidden />
          <span>
            <span className="tabular font-semibold text-foreground">
              {viewer.walletAvailable.toLocaleString('en-GB')}
            </span>{' '}
            bids available
          </span>
        </span>
        <span className="tabular text-xs text-muted-foreground">
          You: {viewer.bidsPlaced} bid{viewer.bidsPlaced === 1 ? '' : 's'} here
        </span>
      </div>
    </div>
  )
}

function ResultBlock({
  snapshot,
  referenceMinor,
  viewer,
  auctionId,
  serverTime,
}: {
  snapshot: AuctionSnapshot
  referenceMinor: number
  viewer: ViewerAuctionState | null
  auctionId: string
  serverTime: number
}) {
  const result = snapshot.result!
  const savings = savingsBasisPoints(money(referenceMinor), money(result.finalPriceMinor))
  if (result.outcome !== 'WON') {
    return (
      <Notice tone="neutral" title="Closed without a sale" icon={<InfoIcon />}>
        {result.outcome === 'NO_BIDS'
          ? 'No bids were placed.'
          : 'The minimum bidders or reserve was not met, so every bid credit used was refunded automatically.'}
      </Notice>
    )
  }
  return (
    <div className="space-y-4">
      {result.winnerIsViewer ? (
        <div className="rounded-2xl bg-success-soft p-5 text-success-foreground">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <PartyPopperIcon className="size-5" aria-hidden /> You won this auction
          </p>
          <p className="mt-1 text-sm">
            Complete payment within the payment window to secure your item.
          </p>
          {viewer?.winOrderId ? (
            <Button asChild className="mt-4" variant="primary">
              <Link href={`/checkout?order=${viewer.winOrderId}`}>
                Pay {formatMinor(result.finalPriceMinor)} now
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Final price
          </p>
          <p className="tabular text-4xl font-semibold tracking-tight">
            {formatMinor(result.finalPriceMinor)}
          </p>
          <p className="text-xs font-semibold text-success">
            {formatBasisPoints(savings)} below reference
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Winner
          </p>
          <p className="font-semibold">{result.winnerName}</p>
          <p className="text-xs text-muted-foreground">
            {result.winnerBidCount} bids used · closed {formatRelative(result.closedAt, serverTime)}
          </p>
        </div>
      </div>
      <p className="rounded-xl bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Transparency: {result.bidCount.toLocaleString('en-GB')} bids from {result.uniqueBidders}{' '}
        bidders. The winner paid the final price plus delivery; bid credits used are not refunded.
        Demonstration data — bidders are simulated.
      </p>
      <Button asChild variant="outline" className="w-full">
        <Link href={`/auctions?status=live`}>
          <GavelIcon /> See live auctions
        </Link>
      </Button>
      <span className="sr-only">{auctionId}</span>
    </div>
  )
}

function AutoBidPanel({
  auctionId,
  viewer,
  priceMinor,
  incrementMinor,
  onChange,
}: {
  auctionId: string
  viewer: ViewerAuctionState
  priceMinor: number
  incrementMinor: number
  onChange: () => void
}) {
  const [maxBids, setMaxBids] = useState('25')
  const [maxPrice, setMaxPrice] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rule: AutoBidView | null = viewer.autobid
  const active = rule?.status === 'ACTIVE'

  if (!viewer.autoBidAvailable && !active) {
    return (
      <section className="rounded-2xl border bg-card p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <BotIcon className="size-4" aria-hidden /> AutoBid
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          AutoBid is not available for this auction right now. You can still bid manually.
        </p>
      </section>
    )
  }

  const submit = async () => {
    setError(null)
    let maxPriceMinor: number | null = null
    if (maxPrice.trim()) {
      try {
        maxPriceMinor = parseMajor(maxPrice).amount
      } catch {
        setError('Enter a valid maximum price, e.g. 25.00')
        return
      }
    }
    setPending(true)
    try {
      await api('/api/autobid', {
        method: 'POST',
        body: { auctionId, maxBids: Number(maxBids), maxPriceMinor },
      })
      toast.success('AutoBid is active', {
        description: 'Our servers will bid for you in the final seconds when you’re not leading.',
      })
      onChange()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not start AutoBid.')
    } finally {
      setPending(false)
    }
  }

  const cancel = async () => {
    if (!rule) return
    setPending(true)
    try {
      await api(`/api/autobid/${rule.id}`, { method: 'DELETE' })
      toast.success('AutoBid cancelled')
      onChange()
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not cancel AutoBid.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section aria-labelledby="autobid-heading" className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 id="autobid-heading" className="flex items-center gap-2 text-sm font-semibold">
          <BotIcon className="size-4 text-brand" aria-hidden /> AutoBid
        </h3>
        {rule ? (
          <Badge variant={active ? 'success' : 'neutral'}>
            {active
              ? 'Active'
              : rule.status === 'EXHAUSTED'
                ? 'Allocation used'
                : rule.status === 'STOPPED'
                  ? 'Stopped'
                  : rule.status === 'CANCELLED'
                    ? 'Cancelled'
                    : 'Ended'}
          </Badge>
        ) : null}
      </div>
      {active && rule ? (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-muted px-2 py-2.5">
              <p className="tabular text-lg font-semibold">{rule.remaining}</p>
              <p className="text-[11px] text-muted-foreground">bids left</p>
            </div>
            <div className="rounded-xl bg-muted px-2 py-2.5">
              <p className="tabular text-lg font-semibold">{rule.bidsPlaced}</p>
              <p className="text-[11px] text-muted-foreground">placed</p>
            </div>
            <div className="rounded-xl bg-muted px-2 py-2.5">
              <p className="tabular text-lg font-semibold">
                {rule.maxPriceMinor ? formatMinor(rule.maxPriceMinor) : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground">max price</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Bids are placed by our servers in the final 3 seconds whenever you are not leading,
            within your limits and wallet balance.
          </p>
          <Button variant="outline" className="w-full" onClick={cancel} disabled={pending}>
            <XIcon /> Cancel AutoBid (kill switch)
          </Button>
        </div>
      ) : (
        <form
          className="mt-3 space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          {rule?.stopReason ? (
            <p className="text-xs text-muted-foreground">Last agent: {rule.stopReason}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="autobid-max">Max bids</Label>
              <Input
                id="autobid-max"
                inputMode="numeric"
                value={maxBids}
                onChange={(event) => setMaxBids(event.target.value.replace(/\D/g, ''))}
                aria-describedby="autobid-hint"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="autobid-price">Max price (optional)</Label>
              <Input
                id="autobid-price"
                inputMode="decimal"
                placeholder={formatMinor(priceMinor + incrementMinor * 50).replace('£', '')}
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            {[10, 25, 50].map((preset) => (
              <Button
                key={preset}
                type="button"
                size="xs"
                variant={maxBids === String(preset) ? 'soft' : 'outline'}
                onClick={() => setMaxBids(String(preset))}
              >
                {preset} bids
              </Button>
            ))}
          </div>
          <FieldHint id="autobid-hint">
            Up to {Number(maxBids || 0)} credits may be used. Cancel at any time.
          </FieldHint>
          {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
          <Button
            type="submit"
            variant="secondary"
            className="w-full"
            disabled={pending || !maxBids}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <BotIcon />} Start AutoBid
          </Button>
        </form>
      )}
    </section>
  )
}

function BuyNowPanel({
  auction,
  viewer,
  signedIn,
  completed,
}: {
  auction: AuctionDetail
  viewer: ViewerAuctionState | null
  signedIn: boolean
  completed: boolean
}) {
  const recovery = viewer?.recovery
  const won = auction.result?.winnerIsViewer
  if (won) return null
  return (
    <section aria-labelledby="buy-now-heading" className="rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="buy-now-heading" className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingBagIcon className="size-4" aria-hidden /> Buy it now
          </h3>
          <p className="tabular mt-1 text-2xl font-semibold tracking-tight">
            {formatMinor(
              recovery?.eligible && recovery.mode === 'PRICE_CREDIT'
                ? recovery.payableMinor
                : auction.rules.buyNowPriceMinor,
            )}
          </p>
          {recovery?.eligible && recovery.mode === 'PRICE_CREDIT' ? (
            <p className="text-xs text-muted-foreground">
              <span className="line-through">{formatMinor(auction.rules.buyNowPriceMinor)}</span> −{' '}
              {formatMinor(recovery.valueMinor)} bid credit
            </p>
          ) : null}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/checkout?auction=${auction.id}`}>Buy now</Link>
        </Button>
      </div>
      <div className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {!auction.rules.recoveryEnabled ? (
          <p>
            This auction does not offer bid recovery. Bids used here are not returned if you buy
            now.
          </p>
        ) : recovery?.eligible ? (
          <p className="text-success-foreground">
            {recovery.mode === 'RETURN_BIDS'
              ? `Buy now and ${recovery.credits} eligible bid${recovery.credits === 1 ? '' : 's'} you used here will be returned to your wallet.`
              : `The value of your ${recovery.purchasedCredits} purchased bids (${formatMinor(recovery.valueMinor)}) is credited against the price.`}
            {recovery.windowEndsAt ? ` Offer ends ${formatDateTime(recovery.windowEndsAt)}.` : ''}
          </p>
        ) : viewer && viewer.bidsPlaced > 0 && recovery ? (
          <p>{recovery.reasons[0]}</p>
        ) : (
          <p>
            Bid Credit Recovery: if you bid and don’t win, buy within{' '}
            {auction.rules.recoveryWindowHours} hours of the close and{' '}
            {auction.rules.recoveryMode === 'RETURN_BIDS'
              ? 'eligible bids are returned to your wallet.'
              : 'the value of purchased bids is credited against the price.'}
          </p>
        )}
        {!signedIn && !completed ? (
          <p className="mt-1">Enter the demo to see your personal recovery offer.</p>
        ) : null}
      </div>
    </section>
  )
}

function BidHistory({
  bids,
  serverTime,
  simulated,
}: {
  bids: LiveAuctionPayload['recentBids']
  serverTime: number
  simulated: boolean
}) {
  const reduceMotion = useReducedMotion()
  return (
    <section aria-labelledby="bid-history-heading" className="rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h3 id="bid-history-heading" className="text-sm font-semibold">
          Bid history
        </h3>
        {simulated ? (
          <span className="text-[11px] text-muted-foreground">Demo bidders are simulated</span>
        ) : null}
      </div>
      {bids.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">No bids yet.</p>
      ) : (
        <ol className="divide-y" aria-live="off">
          <AnimatePresence initial={false}>
            {bids.map((bid) => (
              <motion.li
                key={bid.id}
                layout={!reduceMotion}
                initial={
                  reduceMotion ? false : { opacity: 0, backgroundColor: 'var(--brand-soft)' }
                }
                animate={{ opacity: 1, backgroundColor: 'rgba(0,0,0,0)' }}
                transition={{ duration: 0.6 }}
                className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="tabular w-10 shrink-0 font-mono text-xs text-subtle-foreground">
                    #{bid.sequence}
                  </span>
                  <span className={cn('truncate font-medium', bid.isViewer && 'text-success')}>
                    {bid.bidderName}
                  </span>
                  {bid.kind === 'AUTOBID' ? (
                    <Badge variant="brand" className="px-1.5">
                      <BotIcon aria-hidden /> Auto
                    </Badge>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="tabular font-semibold">{formatMinor(bid.priceAfterMinor)}</span>
                  <span className="w-16 text-right text-xs text-muted-foreground">
                    {formatRelative(bid.placedAt, Math.max(serverTime, bid.placedAt))}
                  </span>
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </section>
  )
}

export { serverNow }
