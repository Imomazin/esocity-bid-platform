import { autoBidDecision, nextAutoBidAt, type AutoBidRule } from '@/domain/auction/autobid'
import {
  applyAcceptedBid,
  determineOutcome,
  evaluateBid,
  OUTCOME_LABELS,
} from '@/domain/auction/bidding'
import { DEFAULT_AUCTION_RULES, mergeRules } from '@/domain/auction/rules'
import { transition } from '@/domain/auction/state-machine'
import type { AuctionState, BidEvent } from '@/domain/auction/types'
import type { Product } from '@/domain/catalog'
import { planRelease, planReservation, planSale } from '@/domain/inventory'
import {
  nextFulfilmentStatus,
  transitionOrder,
  type Order,
  type OrderStatus,
} from '@/domain/orders'
import { checkBidAllowance } from '@/domain/responsible-use'
import { summarizeWallet, PROMOTIONAL_CREDIT_VALIDITY_MS } from '@/domain/wallet'
import { resolveFlags } from '@/lib/config/flags'
import { newId } from '@/lib/ids'
import { formatMinor } from '@/lib/money'
import { deterministicUuid, hashString, rngFor, shuffle } from '@/lib/rng'
import { DAY, HOUR, MINUTE } from '@/lib/time'
import { SYSTEM_ACTOR } from '@/server/infra/audit'
import { demoTrackingNumber } from '@/server/providers/shipping'

import { notifyOutbid, pushRecentBid, recordParticipant, placeMemberBid } from './bidding'
import {
  appendInventory,
  audit,
  availableStock,
  inventoryEvents,
  notify,
  usageSnapshot,
  type Ctx,
} from './context'
import { DROP_SERIES } from './data/drops'
import { SIMULATED_HANDLES, simulatedBidderId } from './data/people'
import { AUCTION_SERIES, DEMO_EPOCH, seriesRules, type AuctionSeries } from './data/series'
import { awardAchievements, createAuctionWinOrder } from './orders'
import { expectedClosingGapMs, expectedOpeningBids, nextSimulatedBid } from './simulation'
import type { AuctionRecord, DemoAccount, SimParams } from './state'

const SCHEDULER_ACTOR = {
  type: 'SYSTEM' as const,
  id: 'auction-scheduler',
  name: 'Auction scheduler',
}
const ENGINE_ACTOR = { type: 'SYSTEM' as const, id: 'auction-engine', name: 'Auction engine' }
const HISTORY_CYCLES = 4

export function seriesCycleAt(series: AuctionSeries, at: number): number {
  return Math.floor(
    (at - DEMO_EPOCH - series.offsetMinutes * MINUTE) / (series.cycleMinutes * MINUTE),
  )
}

export function seriesCycleStart(series: AuctionSeries, cycle: number): number {
  return DEMO_EPOCH + series.offsetMinutes * MINUTE + cycle * series.cycleMinutes * MINUTE
}

export function buildSimParams(
  instanceId: string,
  heat: number,
  openMs: number,
  extensionSeconds: number,
  closingMinutes: number,
  giveUpAt: number,
): SimParams {
  const rng = rngFor(instanceId, 'sim-params')
  const openingMeanGapMs = Math.round((8 + 24 * (1 - heat)) * 1000 * (0.85 + rng() * 0.3))
  const closingPace = 0.2 + 0.6 * (1 - heat)
  const closingMs = closingMinutes * MINUTE * (0.7 + rng() * 0.6)
  const targetBids =
    expectedOpeningBids(openMs, openingMeanGapMs) +
    Math.round(closingMs / expectedClosingGapMs(extensionSeconds * 1000, closingPace))
  const poolSize = 6 + Math.round(heat * 12)
  return {
    heat,
    targetBids,
    openingMeanGapMs,
    closingPace,
    pool: shuffle(rng, SIMULATED_HANDLES).slice(0, poolSize),
    giveUpAt,
  }
}

export function emptyRecord(state: AuctionState, partial: Partial<AuctionRecord>): AuctionRecord {
  return {
    state,
    source: 'SERIES',
    seriesKey: null,
    cycle: null,
    label: null,
    sim: null,
    participants: new Map(),
    recentBids: [],
    memberBids: [],
    watchers: new Set(),
    watchingBase: 20,
    notified: new Set(),
    buyNowConversions: 0,
    buyNowRevenueMinor: 0,
    recoveredValueMinor: 0,
    purchasedCreditsUsed: 0,
    promotionalCreditsUsed: 0,
    createdBy: 'Auction scheduler',
    description: null,
    ...partial,
  }
}

/** Makes sure stock is available, simulating supplier replenishment in demo mode. */
export function ensureStock(ctx: Ctx, product: Product, at: number, quantity = 1): void {
  if (availableStock(ctx.state, product.id) >= quantity) return
  const reference = `PO-${String(ctx.state.purchaseOrders.length + 5001)}`
  const received = Math.max(10, quantity + 5)
  const poId = newId()
  ctx.state.purchaseOrders.unshift({
    id: poId,
    reference,
    supplierId: product.supplierId,
    status: 'RECEIVED',
    lines: [{ productId: product.id, quantity: received, unitCostMinor: product.costPriceMinor }],
    createdAt: at - 3 * DAY,
    expectedAt: at,
    receivedAt: at,
  })
  appendInventory(
    ctx.state,
    product.id,
    {
      type: 'RECEIVED',
      quantity: received,
      reference: { type: 'PURCHASE_ORDER', id: poId },
      note: `Auto-replenishment ${reference} (demo)`,
      actor: 'Replenishment',
    },
    at,
  )
}

export function reserveForAuction(ctx: Ctx, record: AuctionRecord, at: number): void {
  const product = ctx.state.products.get(record.state.productId)
  if (!product) return
  ensureStock(ctx, product, at)
  const draft = planReservation(
    inventoryEvents(ctx.state, product.id),
    1,
    { type: 'AUCTION', id: record.state.id },
    'Auction scheduler',
  )
  appendInventory(ctx.state, product.id, draft, at)
}

function releaseForAuction(ctx: Ctx, record: AuctionRecord, at: number, note: string): void {
  const draft = planRelease(
    inventoryEvents(ctx.state, record.state.productId),
    { type: 'AUCTION', id: record.state.id },
    'Auction engine',
    note,
  )
  if (draft) appendInventory(ctx.state, record.state.productId, draft, at)
}

export function sellForAuction(
  ctx: Ctx,
  record: AuctionRecord,
  at: number,
  referenceId = record.state.id,
): void {
  const events = inventoryEvents(ctx.state, record.state.productId)
  const draft = planSale(events, 1, { type: 'AUCTION', id: referenceId }, 'Auction engine')
  appendInventory(ctx.state, record.state.productId, draft, at)
}

function createSeriesInstance(
  ctx: Ctx,
  series: AuctionSeries,
  cycle: number,
  now: number,
): AuctionRecord | null {
  const start = seriesCycleStart(series, cycle)
  // Instances announced ahead of their cycle are created (and reserve stock) now, not in the future.
  const createdAt = Math.min(start, now)
  const productSlug =
    series.products[hashString(`${series.key}:${cycle}`) % series.products.length]!
  const product = ctx.state.productsBySlug.get(productSlug)
  if (!product || product.status !== 'ACTIVE') return null
  const id = deterministicUuid('auction', series.key, cycle)
  const rules = mergeRules(DEFAULT_AUCTION_RULES, seriesRules(series, product.referencePriceMinor))
  const startsAt = start + series.leadMinutes * MINUTE
  const state: AuctionState = {
    id,
    productId: product.id,
    title: product.name,
    status: 'SCHEDULED',
    rules,
    startsAt,
    closeAt: startsAt + rules.timerSeconds * 1000,
    hardCloseAt: rules.hardStopAfterSeconds ? startsAt + rules.hardStopAfterSeconds * 1000 : null,
    pausedAt: null,
    remainingAtPauseMs: null,
    priceMinor: rules.startingPriceMinor,
    bidCount: 0,
    lastBidAt: null,
    leaderId: null,
    leaderName: null,
    leaderSimulated: false,
    uniqueBidders: 0,
    version: 1,
    result: null,
    cancelReason: null,
    featured: !!series.featured,
    createdAt,
    updatedAt: createdAt,
  }
  const rng = rngFor(id, 'instance')
  const record = emptyRecord(state, {
    source: 'SERIES',
    seriesKey: series.key,
    cycle,
    label: series.label ?? null,
    sim: buildSimParams(
      id,
      series.heat,
      series.openMinutes * MINUTE,
      series.extensionSeconds,
      series.closingMinutes,
      start + series.cycleMinutes * MINUTE - 8 * MINUTE,
    ),
    watchingBase: 30 + Math.floor(rng() * (60 + series.heat * 380)),
    createdBy: 'Auction scheduler',
  })
  reserveForAuction(ctx, record, createdAt)
  audit(ctx, {
    actor: SCHEDULER_ACTOR,
    action: 'auction.scheduled',
    entityType: 'AUCTION',
    entityId: id,
    summary: `Scheduled ${product.name} (${series.key} #${cycle})`,
    metadata: { startsAt, series: series.key, incrementMinor: rules.bidIncrementMinor },
    at: createdAt,
  })
  return record
}

/**
 * Each series announces its next auction this long before the cycle starts, so a series whose
 * previous auction has just closed still shows an upcoming one.
 */
const ANNOUNCE_AHEAD_MS = 45 * MINUTE

function ensureSeriesInstances(ctx: Ctx, now: number): void {
  for (const series of AUCTION_SERIES) {
    const current = seriesCycleAt(series, now + ANNOUNCE_AHEAD_MS)
    const cursor = ctx.state.seriesCursor.get(series.key)
    const from = cursor === undefined ? current - (HISTORY_CYCLES - 1) : cursor + 1
    for (let cycle = from; cycle <= current; cycle += 1) {
      const record = createSeriesInstance(ctx, series, cycle, now)
      if (record) ctx.state.auctions.set(record.state.id, record)
    }
    ctx.state.seriesCursor.set(series.key, current)
  }
}

function isAutoBidFeatureOn(ctx: Ctx): boolean {
  return resolveFlags('UK', {}, ctx.state.runtimeFlags).autobid
}

interface PendingAutoBid {
  rule: AutoBidRule
  at: number
}

function nextAutoBid(ctx: Ctx, record: AuctionRecord): PendingAutoBid | null {
  let best: PendingAutoBid | null = null
  for (const rule of ctx.state.autobids.values()) {
    if (rule.auctionId !== record.state.id || rule.status !== 'ACTIVE') continue
    const jitter = Math.floor(rngFor(rule.id, record.state.bidCount)() * 900)
    const at = nextAutoBidAt(rule, record.state, jitter)
    if (at !== null && (!best || at < best.at)) best = { rule, at }
  }
  return best
}

function stopAutoBid(
  ctx: Ctx,
  rule: AutoBidRule,
  status: AutoBidRule['status'],
  reason: string,
  at: number,
): void {
  rule.status = status
  rule.stopReason = reason
  rule.updatedAt = at
  const account = ctx.state.accounts.get(rule.userId)
  if (account && status !== 'COMPLETED') {
    notify(ctx, account, 'SYSTEM', 'AutoBid stopped', reason, `/auction/${rule.auctionId}`, at)
  }
  audit(ctx, {
    actor: ENGINE_ACTOR,
    action: 'autobid.stopped',
    entityType: 'AUTOBID',
    entityId: rule.id,
    summary: `AutoBid ${status.toLowerCase()}: ${reason}`,
    metadata: { auctionId: rule.auctionId, bidsPlaced: rule.bidsPlaced },
    at,
  })
}

function runAutoBid(ctx: Ctx, record: AuctionRecord, pending: PendingAutoBid): void {
  const { rule, at } = pending
  const account = ctx.state.accounts.get(rule.userId)
  if (!account) {
    stopAutoBid(ctx, rule, 'STOPPED', 'Member session ended.', at)
    return
  }
  const summary = summarizeWallet(account.ledger, at)
  const limits = checkBidAllowance(
    account.limits,
    usageSnapshot(account, at),
    record.state.rules.bidCreditCost,
    at,
  )
  const decision = autoBidDecision(rule, record.state, {
    now: at,
    availableCredits: summary.available,
    killSwitchActive: ctx.state.autobidKillSwitch,
    featureEnabled: isAutoBidFeatureOn(ctx),
    limitsAllowed: limits.allowed,
  })
  if (decision.action === 'STOP') {
    stopAutoBid(ctx, rule, decision.status, decision.reason, at)
    return
  }
  if (decision.action === 'WAIT') {
    // Defensive: should not happen for a due event; stop to guarantee progress.
    stopAutoBid(ctx, rule, 'STOPPED', 'AutoBid could not act.', at)
    return
  }
  const outcome = placeMemberBid(ctx, record, account, 'AUTOBID', at)
  if (outcome.accepted) {
    rule.bidsPlaced += 1
    rule.lastBidAt = at
    rule.updatedAt = at
    if (rule.bidsPlaced >= rule.maxBids)
      stopAutoBid(ctx, rule, 'EXHAUSTED', 'Your AutoBid allocation has been used.', at)
  } else {
    stopAutoBid(ctx, rule, 'STOPPED', outcome.message, at)
  }
}

function applySimulatedBid(ctx: Ctx, record: AuctionRecord, handle: string, at: number): boolean {
  const state = record.state
  const tryHandle = (candidate: string): boolean => {
    const bidderId = simulatedBidderId(candidate)
    const participant = record.participants.get(bidderId)
    const decision = evaluateBid(
      state,
      { bidderId, bidderName: candidate, kind: 'SIMULATED', at },
      {
        bidsInAuction: participant?.bids ?? 0,
        isParticipant: !!participant,
        availableCredits: Number.MAX_SAFE_INTEGER,
        eligibility: { eligible: true },
        limits: { allowed: true },
      },
    )
    if (!decision.accepted) return false
    const previousLeader = state.leaderId
    record.state = applyAcceptedBid(
      state,
      { bidderId, bidderName: candidate, kind: 'SIMULATED', at },
      decision,
    )
    const event: BidEvent = {
      id: deterministicUuid(state.id, 'bid', decision.sequence),
      auctionId: state.id,
      sequence: decision.sequence,
      bidderId,
      bidderName: candidate,
      kind: 'SIMULATED',
      simulated: true,
      priceAfterMinor: decision.priceAfterMinor,
      creditsSpent: decision.creditsCost,
      placedAt: at,
      closeAtAfter: decision.closeAtAfter,
    }
    pushRecentBid(record, event)
    const purchased = rngFor(state.id, decision.sequence, 'bucket')() < 0.85
    recordParticipant(
      record,
      bidderId,
      candidate,
      true,
      at,
      purchased ? decision.creditsCost : 0,
      purchased ? 0 : decision.creditsCost,
    )
    if (previousLeader && !previousLeader.startsWith('sim:')) {
      const account = ctx.state.accounts.get(previousLeader)
      if (account) notifyOutbid(ctx, account, record, at)
    }
    return true
  }
  if (tryHandle(handle)) return true
  // Rules such as per-member limits or participant caps can reject a simulated bidder; try others.
  for (const candidate of record.sim?.pool ?? []) {
    if (candidate !== handle && `sim:${candidate}` !== state.leaderId && tryHandle(candidate))
      return true
  }
  return false
}

/** Advances an auction to `now`: starts it, replays simulated/AutoBid events in time order and finalises it. */
export function advanceAuction(ctx: Ctx, record: AuctionRecord, now: number): void {
  if (record.state.status === 'SCHEDULED' && now >= record.state.startsAt) {
    record.state = transition(record.state, 'LIVE', { actor: 'SYSTEM', now: record.state.startsAt })
    audit(ctx, {
      actor: ENGINE_ACTOR,
      action: 'auction.transition',
      entityType: 'AUCTION',
      entityId: record.state.id,
      summary: `${record.state.title}: SCHEDULED → LIVE`,
      metadata: { from: 'SCHEDULED', to: 'LIVE' },
      at: record.state.startsAt,
    })
    if (now - record.state.startsAt < 10 * MINUTE) {
      for (const userId of record.watchers) {
        const account = ctx.state.accounts.get(userId)
        if (account)
          notify(
            ctx,
            account,
            'AUCTION_STARTING',
            `${record.state.title} is live`,
            'An auction on your watchlist has started.',
            `/auction/${record.state.id}`,
            record.state.startsAt,
          )
      }
    }
  }
  if (record.state.status !== 'LIVE') return

  for (let guard = 0; guard < 100_000; guard += 1) {
    const state = record.state
    const simulated = record.sim ? nextSimulatedBid(state, record.sim) : null
    const auto = nextAutoBid(ctx, record)
    const simAt = simulated?.at ?? Number.POSITIVE_INFINITY
    const autoAt = auto?.at ?? Number.POSITIVE_INFINITY
    const nextAt = Math.min(simAt, autoAt)
    if (!Number.isFinite(nextAt)) {
      if (now >= state.closeAt) finalizeAuction(ctx, record, state.closeAt)
      return
    }
    if (nextAt > now) return
    if (auto && autoAt <= simAt) {
      runAutoBid(ctx, record, auto)
    } else if (simulated && !applySimulatedBid(ctx, record, simulated.bidderHandle, simulated.at)) {
      record.sim = null
    }
  }
}

export function refundMemberBids(
  ctx: Ctx,
  record: AuctionRecord,
  at: number,
  reason: string,
): void {
  for (const participant of record.participants.values()) {
    if (participant.simulated) continue
    const account = ctx.state.accounts.get(participant.bidderId)
    if (!account) continue
    const refunds: ['PURCHASED' | 'PROMOTIONAL', number][] = [
      ['PURCHASED', participant.purchasedCreditsSpent],
      ['PROMOTIONAL', participant.promotionalCreditsSpent],
    ]
    let total = 0
    for (const [bucket, credits] of refunds) {
      if (credits <= 0) continue
      total += credits
      account.ledger.push({
        id: newId(),
        userId: account.id,
        type: 'BID_REFUND',
        bucket,
        credits,
        createdAt: at,
        expiresAt: bucket === 'PROMOTIONAL' ? at + PROMOTIONAL_CREDIT_VALIDITY_MS : null,
        lotId: null,
        description: `Refund · ${record.state.title} (${reason})`,
        reference: { type: 'AUCTION', id: record.state.id },
        idempotencyKey: `refund:${record.state.id}:${account.id}:${bucket}`,
      })
    }
    if (total > 0) {
      notify(
        ctx,
        account,
        'SYSTEM',
        `${total} bid credits refunded`,
        `${record.state.title}: ${reason}. Your bids have been returned to your wallet.`,
        '/wallet',
        at,
      )
      audit(ctx, {
        actor: ENGINE_ACTOR,
        action: 'wallet.refund',
        entityType: 'WALLET',
        entityId: account.id,
        summary: `Refunded ${total} bid credits for ${record.state.title}`,
        metadata: { auctionId: record.state.id, reason, credits: total },
        at,
      })
    }
  }
}

export function finalizeAuction(ctx: Ctx, record: AuctionRecord, closedAt: number): void {
  let state = transition(record.state, 'FINALIZING', { actor: 'SYSTEM', now: closedAt })
  const result = determineOutcome(state, record.participants, closedAt)
  state = transition(state, 'COMPLETED', { actor: 'SYSTEM', now: closedAt })
  record.state = { ...state, result }

  for (const rule of ctx.state.autobids.values()) {
    if (rule.auctionId === state.id && rule.status === 'ACTIVE') {
      rule.status = 'COMPLETED'
      rule.stopReason = 'The auction has ended.'
      rule.updatedAt = closedAt
    }
  }

  if (result.outcome === 'WON' && result.winnerId) {
    const winner = result.winnerSimulated ? null : ctx.state.accounts.get(result.winnerId)
    if (winner) {
      winner.previousWins += 1
      const order = createAuctionWinOrder(ctx, record, winner, closedAt)
      notify(
        ctx,
        winner,
        'AUCTION_WON',
        `You won ${state.title}!`,
        `Final price ${formatMinor(result.finalPriceMinor)}. Complete payment within ${state.rules.winnerPaymentWindowHours} hours to secure it.`,
        `/checkout?order=${order.id}`,
        closedAt,
      )
      awardAchievements(ctx, winner, closedAt)
    } else if (result.winnerSimulated) {
      sellForAuction(ctx, record, closedAt)
    } else {
      releaseForAuction(ctx, record, closedAt, 'Winner session unavailable')
    }
  } else {
    releaseForAuction(ctx, record, closedAt, OUTCOME_LABELS[result.outcome])
    if (result.bidsRefunded) refundMemberBids(ctx, record, closedAt, OUTCOME_LABELS[result.outcome])
  }

  for (const participant of record.participants.values()) {
    if (participant.simulated || participant.bidderId === result.winnerId || result.bidsRefunded)
      continue
    const account = ctx.state.accounts.get(participant.bidderId)
    if (!account) continue
    const recovery = state.rules.buyNowEnabled && state.rules.bidCreditRecoveryEnabled
    notify(
      ctx,
      account,
      'AUCTION_LOST',
      `${state.title} has ended`,
      recovery
        ? `You didn’t win this time. Buy it now within ${state.rules.recoveryWindowHours} hours and recover eligible bids.`
        : 'You didn’t win this time. See similar auctions starting soon.',
      `/auction/${state.id}`,
      closedAt,
    )
  }

  audit(ctx, {
    actor: ENGINE_ACTOR,
    action: 'auction.completed',
    entityType: 'AUCTION',
    entityId: state.id,
    severity: result.bidsRefunded ? 'NOTICE' : 'INFO',
    summary: `${state.title}: ${OUTCOME_LABELS[result.outcome]} at ${formatMinor(result.finalPriceMinor)} after ${result.bidCount} bids`,
    metadata: {
      outcome: result.outcome,
      winnerSimulated: result.winnerSimulated,
      bidCount: result.bidCount,
      uniqueBidders: result.uniqueBidders,
    },
    at: closedAt,
  })
  void ctx.deps.realtime.publish(`auction:${state.id}`, 'completed', { outcome: result.outcome })
}

/* ------------------------------------------------------------------------------------------ */
/* Flash Drops                                                                                 */
/* ------------------------------------------------------------------------------------------ */

export function dropWindowStart(periodHours: number, offsetHours: number, window: number): number {
  return DEMO_EPOCH + offsetHours * HOUR + window * periodHours * HOUR
}

function syncDrops(ctx: Ctx, now: number): void {
  const active = new Set<string>()
  for (const series of DROP_SERIES) {
    const period = series.periodHours * HOUR
    const current = Math.floor((now - DEMO_EPOCH - series.offsetHours * HOUR) / period)
    const currentEnd =
      dropWindowStart(series.periodHours, series.offsetHours, current) + series.durationHours * HOUR
    const window = now < currentEnd ? current : current + 1
    const id = deterministicUuid('drop', series.key, window)
    active.add(id)
    if (ctx.state.drops.has(id)) continue
    const product = ctx.state.productsBySlug.get(series.productSlug)
    if (!product) continue
    const startsAt = dropWindowStart(series.periodHours, series.offsetHours, window)
    ctx.state.drops.set(id, {
      seriesKey: series.key,
      window,
      demand: 0.55 + rngFor(id, 'demand')() * 0.85,
      realSold: 0,
      byUser: new Map(),
      drop: {
        id,
        slug: series.key,
        productId: product.id,
        title: series.title,
        subtitle: series.subtitle,
        dropPriceMinor: series.dropPriceMinor,
        referencePriceMinor: product.referencePriceMinor,
        stockTotal: series.stock,
        perCustomerLimit: series.perCustomerLimit,
        startsAt,
        endsAt: startsAt + series.durationHours * HOUR,
        eligibility: { minimumTier: series.minimumTier, membersOnly: series.membersOnly },
      },
    })
  }
  for (const [id, instance] of ctx.state.drops) {
    if (!active.has(id) && instance.drop.endsAt < now - 6 * HOUR) ctx.state.drops.delete(id)
  }
}

/** Simulated demand: other members buying during the window (demo only). */
export function simulatedDropSales(
  instance: { drop: { startsAt: number; endsAt: number; stockTotal: number }; demand: number },
  now: number,
): number {
  const { startsAt, endsAt, stockTotal } = instance.drop
  if (now <= startsAt) return 0
  const progress = Math.min(1, (now - startsAt) / (endsAt - startsAt))
  const curve = 1 - (1 - progress) ** 2.2
  return Math.min(stockTotal, Math.floor(stockTotal * Math.min(1, instance.demand * curve)))
}

/* ------------------------------------------------------------------------------------------ */
/* Demo fulfilment and watchlist notifications                                                 */
/* ------------------------------------------------------------------------------------------ */

const FULFILMENT_DELAYS: Partial<Record<OrderStatus, number>> = {
  PROCESSING: 2 * MINUTE,
  PACKED: 4 * MINUTE,
  SHIPPED: 6 * MINUTE,
  DELIVERED: 20 * MINUTE,
}

function progressOrder(ctx: Ctx, order: Order, account: DemoAccount, now: number): Order {
  let current = order
  const dueAt = current.paymentDueAt
  if (current.status === 'PENDING_PAYMENT' && dueAt !== null && now > dueAt) {
    current = transitionOrder(current, 'CANCELLED', dueAt, 'Payments', 'Payment window expired')
    if (current.auctionId) {
      const draft = planRelease(
        inventoryEvents(ctx.state, current.lines[0]!.productId),
        { type: 'AUCTION', id: current.auctionId },
        'Payments',
        'Payment window expired',
      )
      if (draft) appendInventory(ctx.state, current.lines[0]!.productId, draft, dueAt)
    }
    notify(
      ctx,
      account,
      'SYSTEM',
      `Order ${current.reference} cancelled`,
      'The payment window for your auction win expired.',
      `/orders/${current.id}`,
      dueAt,
    )
    return current
  }
  for (let guard = 0; guard < 6; guard += 1) {
    const next = nextFulfilmentStatus(current.status)
    if (!next || current.status === 'PENDING_PAYMENT') break
    const lastAt = current.events[current.events.length - 1]?.at ?? current.updatedAt
    const dueAt = lastAt + (FULFILMENT_DELAYS[next] ?? 5 * MINUTE)
    if (dueAt > now) break
    current = transitionOrder(
      current,
      next,
      dueAt,
      'Fulfilment (demo)',
      next === 'SHIPPED' ? 'Collected by carrier' : null,
    )
    if (next === 'SHIPPED') {
      current = {
        ...current,
        trackingNumber: current.trackingNumber ?? demoTrackingNumber(current.id),
        carrier:
          current.carrier ??
          (current.shippingMethod === 'NEXT_DAY'
            ? 'Esocity Priority (demo)'
            : 'Esocity Express (demo)'),
      }
      notify(
        ctx,
        account,
        'ORDER_SHIPPED',
        `Order ${current.reference} is on its way`,
        `Tracking ${current.trackingNumber} with ${current.carrier}.`,
        `/orders/${current.id}`,
        dueAt,
      )
    }
  }
  return current
}

function progressOrders(ctx: Ctx, now: number): void {
  for (const orderId of ctx.state.progressingOrders) {
    const order = ctx.state.orders.get(orderId)
    const account = order ? ctx.state.accounts.get(order.userId) : undefined
    if (
      !order ||
      !account ||
      order.status === 'DELIVERED' ||
      order.status === 'CANCELLED' ||
      order.status === 'REFUNDED'
    ) {
      ctx.state.progressingOrders.delete(orderId)
      continue
    }
    const updated = progressOrder(ctx, order, account, now)
    if (updated !== order) ctx.state.orders.set(orderId, updated)
  }
}

function notifyWatchers(ctx: Ctx, now: number): void {
  for (const record of ctx.state.auctions.values()) {
    if (record.state.status !== 'LIVE' || record.watchers.size === 0) continue
    if (record.state.closeAt - now > 5 * MINUTE) continue
    for (const userId of record.watchers) {
      const key = `${userId}:ending`
      if (record.notified.has(key)) continue
      record.notified.add(key)
      const account = ctx.state.accounts.get(userId)
      if (account)
        notify(
          ctx,
          account,
          'AUCTION_ENDING',
          `${record.state.title} is ending soon`,
          `Current price ${formatMinor(record.state.priceMinor)}.`,
          `/auction/${record.state.id}`,
          now,
        )
    }
  }
  for (const account of ctx.state.accounts.values()) {
    for (const item of account.watchlist) {
      if (item.type !== 'DROP') continue
      const instance = [...ctx.state.drops.values()].find(
        (drop) => drop.seriesKey === item.targetId,
      )
      if (!instance || now < instance.drop.startsAt || now > instance.drop.startsAt + 30 * MINUTE)
        continue
      const key = `drop:${instance.drop.id}`
      if (account.notificationKeys.has(key)) continue
      account.notificationKeys.add(key)
      notify(
        ctx,
        account,
        'DROP_STARTING',
        `${instance.drop.title} is live`,
        'A Flash Drop on your watchlist has started. Stock is limited.',
        '/drops',
        instance.drop.startsAt,
      )
    }
  }
}

function pruneWorld(ctx: Ctx, now: number): void {
  for (const [id, record] of ctx.state.auctions) {
    if (
      record.source !== 'SERIES' ||
      (record.state.status !== 'COMPLETED' && record.state.status !== 'CANCELLED')
    )
      continue
    const series = AUCTION_SERIES.find((item) => item.key === record.seriesKey)
    if (!series || record.cycle === null) continue
    const tooOld = record.cycle < seriesCycleAt(series, now) - HISTORY_CYCLES
    const memberInvolved =
      record.memberBids.length > 0 && now - (record.state.result?.closedAt ?? now) < 3 * DAY
    if (tooOld && !memberInvolved) {
      ctx.state.auctions.delete(id)
      for (const [ruleId, rule] of ctx.state.autobids)
        if (rule.auctionId === id) ctx.state.autobids.delete(ruleId)
    }
  }
}

/** Brings the whole demo world up to `now`. Cheap to call on every request. */
export function syncWorld(ctx: Ctx, now: number): void {
  const at = Math.max(now, ctx.state.lastSyncAt)
  ensureSeriesInstances(ctx, at)
  for (const record of ctx.state.auctions.values()) {
    if (record.state.status === 'SCHEDULED' || record.state.status === 'LIVE')
      advanceAuction(ctx, record, at)
  }
  syncDrops(ctx, at)
  progressOrders(ctx, at)
  notifyWatchers(ctx, at)
  pruneWorld(ctx, at)
  ctx.state.lastSyncAt = at
}

export { SYSTEM_ACTOR }
