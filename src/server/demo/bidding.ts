import { applyAcceptedBid, evaluateBid } from '@/domain/auction/bidding'
import type { BidEvent, BidKind, Participant } from '@/domain/auction/types'
import type { DomainErrorCode } from '@/domain/errors'
import { assessRisk, detectBidSignals } from '@/domain/fraud'
import { checkBidAllowance, thresholdCrossed } from '@/domain/responsible-use'
import { LOW_BALANCE_THRESHOLD, planDebit, summarizeWallet } from '@/domain/wallet'
import { newId } from '@/lib/ids'
import { formatMinor } from '@/lib/money'

import {
  bidderEligibility,
  audit,
  expireCredits,
  isSimulatedId,
  memberActor,
  notify,
  track,
  usageSnapshot,
  type Ctx,
} from './context'
import { RECENT_BIDS_CAP, type AuctionRecord, type DemoAccount } from './state'

export type MemberBidOutcome =
  | { accepted: true; event: BidEvent; creditsSpent: number; availableAfter: number }
  | { accepted: false; code: DomainErrorCode; message: string }

export function pushRecentBid(record: AuctionRecord, event: BidEvent): void {
  record.recentBids.push(event)
  if (record.recentBids.length > RECENT_BIDS_CAP)
    record.recentBids.splice(0, record.recentBids.length - RECENT_BIDS_CAP)
}

export function recordParticipant(
  record: AuctionRecord,
  bidderId: string,
  bidderName: string,
  simulated: boolean,
  at: number,
  purchased: number,
  promotional: number,
): void {
  const existing: Participant = record.participants.get(bidderId) ?? {
    bidderId,
    bidderName,
    simulated,
    bids: 0,
    purchasedCreditsSpent: 0,
    promotionalCreditsSpent: 0,
    firstBidAt: at,
    lastBidAt: at,
  }
  existing.bids += 1
  existing.purchasedCreditsSpent += purchased
  existing.promotionalCreditsSpent += promotional
  existing.lastBidAt = at
  record.participants.set(bidderId, existing)
  record.purchasedCreditsUsed += purchased
  record.promotionalCreditsUsed += promotional
}

/**
 * Places a bid for a real member at `at`. The caller must hold the auction lock and must have
 * advanced the auction to `at`, so the evaluation sees authoritative, current state.
 */
export function placeMemberBid(
  ctx: Ctx,
  record: AuctionRecord,
  account: DemoAccount,
  kind: BidKind,
  at: number,
): MemberBidOutcome {
  const { state } = ctx
  expireCredits(account, at)
  const summaryBefore = summarizeWallet(account.ledger, at)
  const participant = record.participants.get(account.id)
  const usage = usageSnapshot(account, at)
  const cost = record.state.rules.bidCreditCost
  const limitDecision = checkBidAllowance(account.limits, usage, cost, at)
  const eligibility = bidderEligibility(account, record.state.rules.eligibility, at)
  const attempt = { bidderId: account.id, bidderName: account.handle, kind, at }
  const decision = evaluateBid(record.state, attempt, {
    bidsInAuction: participant?.bids ?? 0,
    isParticipant: !!participant,
    availableCredits: summaryBefore.available,
    eligibility,
    limits: limitDecision.allowed
      ? { allowed: true }
      : { allowed: false, message: limitDecision.message },
    restricted: account.restricted
      ? { message: 'Bidding is temporarily unavailable on this account. Please contact support.' }
      : null,
  })
  if (!decision.accepted) {
    track(
      ctx,
      'BID_REJECTED',
      { auctionId: record.state.id, code: decision.code, kind },
      account.id,
    )
    return { accepted: false, code: decision.code, message: decision.message }
  }

  const bidId = newId()
  const allocations = planDebit(account.ledger, decision.creditsCost, at)
  let purchased = 0
  let promotional = 0
  for (const allocation of allocations) {
    account.ledger.push({
      id: newId(),
      userId: account.id,
      type: 'AUCTION_BID',
      bucket: allocation.bucket,
      credits: -allocation.credits,
      createdAt: at,
      expiresAt: null,
      lotId: allocation.lotId,
      description: `${kind === 'AUTOBID' ? 'AutoBid' : 'Bid'} · ${record.state.title}`,
      reference: { type: 'BID', id: bidId },
      idempotencyKey: null,
    })
    if (allocation.bucket === 'PURCHASED') purchased += allocation.credits
    else promotional += allocation.credits
  }

  const previousLeader = record.state.leaderId
  record.state = applyAcceptedBid(record.state, attempt, decision)
  const event: BidEvent = {
    id: bidId,
    auctionId: record.state.id,
    sequence: decision.sequence,
    bidderId: account.id,
    bidderName: account.handle,
    kind,
    simulated: false,
    priceAfterMinor: decision.priceAfterMinor,
    creditsSpent: decision.creditsCost,
    placedAt: at,
    closeAtAfter: decision.closeAtAfter,
  }
  pushRecentBid(record, event)
  record.memberBids.push(event)
  recordParticipant(record, account.id, account.handle, false, at, purchased, promotional)

  account.bidTimestamps.push(at)
  if (account.bidTimestamps.length > 200)
    account.bidTimestamps.splice(0, account.bidTimestamps.length - 200)

  if (previousLeader && previousLeader !== account.id && !isSimulatedId(previousLeader)) {
    const previous = state.accounts.get(previousLeader)
    if (previous) notifyOutbid(ctx, previous, record, at)
  }

  const summaryAfter = summarizeWallet(account.ledger, at)
  if (
    summaryBefore.available >= LOW_BALANCE_THRESHOLD &&
    summaryAfter.available < LOW_BALANCE_THRESHOLD
  ) {
    notify(
      ctx,
      account,
      'BID_BALANCE_LOW',
      'Your bid balance is running low',
      `You have ${summaryAfter.available} bid credits left.`,
      '/wallet',
      at,
    )
  }
  if (account.limits.bidUseNotifications) {
    const crossed = thresholdCrossed(
      account.limits.dailyBidLimit,
      usage.bidCreditsToday,
      usage.bidCreditsToday + cost,
    )
    if (crossed !== null) {
      notify(
        ctx,
        account,
        'LIMIT_THRESHOLD',
        crossed >= 1
          ? 'Daily bid limit reached'
          : `You have used ${Math.round(crossed * 100)}% of today’s bid limit`,
        `Daily limit: ${account.limits.dailyBidLimit} bids. You can review your limits at any time.`,
        '/account#responsible-use',
        at,
      )
    }
  }

  screenBidBehaviour(ctx, account, at)

  audit(ctx, {
    actor: memberActor(account),
    action: kind === 'AUTOBID' ? 'bid.autobid_accepted' : 'bid.accepted',
    entityType: 'BID',
    entityId: bidId,
    summary: `Bid #${decision.sequence} on ${record.state.title} at ${formatMinor(decision.priceAfterMinor)}`,
    metadata: {
      auctionId: record.state.id,
      sequence: decision.sequence,
      priceAfterMinor: decision.priceAfterMinor,
      credits: decision.creditsCost,
      purchased,
      promotional,
      closeAtAfter: decision.closeAtAfter,
    },
    at,
  })
  track(
    ctx,
    'BID_ACCEPTED',
    { auctionId: record.state.id, kind, sequence: decision.sequence },
    account.id,
  )
  void ctx.deps.realtime.publish(`auction:${record.state.id}`, 'bid', {
    priceMinor: record.state.priceMinor,
    closeAt: record.state.closeAt,
    version: record.state.version,
  })
  return {
    accepted: true,
    event,
    creditsSpent: decision.creditsCost,
    availableAfter: summaryAfter.available,
  }
}

const OUTBID_NOTIFY_INTERVAL_MS = 2 * 60_000

export function notifyOutbid(
  ctx: Ctx,
  account: DemoAccount,
  record: AuctionRecord,
  at: number,
): void {
  const recent = account.notifications.find(
    (notification) =>
      notification.type === 'OUTBID' &&
      notification.href === `/auction/${record.state.id}` &&
      at - notification.createdAt < OUTBID_NOTIFY_INTERVAL_MS,
  )
  if (recent) return
  notify(
    ctx,
    account,
    'OUTBID',
    `You’ve been outbid on ${record.state.title}`,
    `The price is now ${formatMinor(record.state.priceMinor)}. Bid again before the clock runs out.`,
    `/auction/${record.state.id}`,
    at,
  )
}

/** Risk screening on bid behaviour. Creates a review case; never accuses or blocks automatically. */
function screenBidBehaviour(ctx: Ctx, account: DemoAccount, at: number): void {
  const signals = detectBidSignals(account.bidTimestamps, at)
  if (signals.length === 0) return
  const assessment = assessRisk(signals, at)
  if (assessment.riskClass === 'LOW') return
  const open = ctx.state.fraudCases.find(
    (item) =>
      item.userId === account.id && (item.status === 'OPEN' || item.status === 'UNDER_REVIEW'),
  )
  if (open) {
    open.assessment = assessment
    return
  }
  ctx.state.fraudCases.unshift({
    id: newId(),
    userId: account.id,
    customerName: `${account.displayName} (${account.handle})`,
    assessment,
    status: 'OPEN',
    decision: null,
    createdAt: at,
    simulated: false,
  })
  audit(ctx, {
    actor: { type: 'SYSTEM', id: 'risk-engine', name: 'Risk engine' },
    action: 'fraud.assessment_created',
    entityType: 'FRAUD_CASE',
    entityId: account.id,
    severity: assessment.riskClass === 'CRITICAL' ? 'WARNING' : 'NOTICE',
    summary: `Risk indicators on bidding activity (score ${assessment.score}, ${assessment.riskClass.toLowerCase()})`,
    metadata: {
      signals: assessment.signals.map((signal) => signal.code),
      recommended: assessment.recommendedAction,
    },
    at,
  })
}
