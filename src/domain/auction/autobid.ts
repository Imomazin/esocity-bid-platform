import { SECOND } from '@/lib/time'

import type { AuctionState } from './types'

/**
 * AutoBid (Bid Agent).
 *
 * A member configures a maximum number of bids (and optionally a maximum auction price). The
 * SERVER places bids on their behalf in the final seconds of the countdown whenever they are not
 * leading. There is no browser-side automation. A global kill switch and a per-auction switch
 * can stop every agent immediately.
 */

export type AutoBidStatus = 'ACTIVE' | 'EXHAUSTED' | 'COMPLETED' | 'CANCELLED' | 'STOPPED'

export interface AutoBidRule {
  id: string
  auctionId: string
  userId: string
  userName: string
  maxBids: number
  maxPriceMinor: number | null
  bidsPlaced: number
  status: AutoBidStatus
  stopReason: string | null
  createdAt: number
  updatedAt: number
  lastBidAt: number | null
}

export const AUTOBID_LIMITS = { minBids: 1, maxBids: 500 } as const

/** The agent bids when this much time (or less) remains on the clock. */
export const AUTOBID_TRIGGER_MS = 3 * SECOND
/** Minimum reaction delay after the previous bid, mirroring human-like pacing. */
export const AUTOBID_REACTION_MS = 700

export interface AutoBidConfigInput {
  maxBids: number
  maxPriceMinor: number | null
}

export function validateAutoBidConfig(
  input: AutoBidConfigInput,
  auction: AuctionState,
): string | null {
  if (
    !Number.isInteger(input.maxBids) ||
    input.maxBids < AUTOBID_LIMITS.minBids ||
    input.maxBids > AUTOBID_LIMITS.maxBids
  ) {
    return `Choose between ${AUTOBID_LIMITS.minBids} and ${AUTOBID_LIMITS.maxBids} bids.`
  }
  if (auction.rules.perUserBidLimit !== null && input.maxBids > auction.rules.perUserBidLimit) {
    return `This auction allows at most ${auction.rules.perUserBidLimit} bids per member.`
  }
  if (input.maxPriceMinor !== null) {
    if (!Number.isInteger(input.maxPriceMinor) || input.maxPriceMinor < 0)
      return 'Enter a valid maximum price.'
    if (input.maxPriceMinor < auction.priceMinor + auction.rules.bidIncrementMinor) {
      return 'The maximum price must be above the current auction price.'
    }
  }
  if (!auction.rules.autoBidEnabled) return 'AutoBid is not available for this auction.'
  if (auction.status !== 'LIVE' && auction.status !== 'SCHEDULED')
    return 'AutoBid can only be set on upcoming or live auctions.'
  return null
}

export type AutoBidDecision =
  | { action: 'WAIT' }
  | { action: 'BID' }
  | { action: 'STOP'; status: Exclude<AutoBidStatus, 'ACTIVE'>; reason: string }

export interface AutoBidContext {
  now: number
  availableCredits: number
  killSwitchActive: boolean
  featureEnabled: boolean
  limitsAllowed: boolean
}

/** Decides what an agent should do right now. */
export function autoBidDecision(
  rule: AutoBidRule,
  auction: AuctionState,
  ctx: AutoBidContext,
): AutoBidDecision {
  if (rule.status !== 'ACTIVE') return { action: 'WAIT' }
  if (ctx.killSwitchActive || !ctx.featureEnabled || !auction.rules.autoBidEnabled) {
    return {
      action: 'STOP',
      status: 'STOPPED',
      reason: 'AutoBid was switched off by Esocity operations.',
    }
  }
  if (
    auction.status === 'COMPLETED' ||
    auction.status === 'CANCELLED' ||
    auction.status === 'FINALIZING'
  ) {
    return { action: 'STOP', status: 'COMPLETED', reason: 'The auction has ended.' }
  }
  if (auction.status !== 'LIVE') return { action: 'WAIT' }
  if (rule.bidsPlaced >= rule.maxBids) {
    return { action: 'STOP', status: 'EXHAUSTED', reason: 'Your AutoBid allocation has been used.' }
  }
  const nextPrice = auction.priceMinor + auction.rules.bidIncrementMinor
  if (rule.maxPriceMinor !== null && nextPrice > rule.maxPriceMinor) {
    return { action: 'STOP', status: 'EXHAUSTED', reason: 'The auction passed your maximum price.' }
  }
  if (ctx.availableCredits < auction.rules.bidCreditCost) {
    return { action: 'STOP', status: 'STOPPED', reason: 'You ran out of bid credits.' }
  }
  if (!ctx.limitsAllowed) {
    return { action: 'STOP', status: 'STOPPED', reason: 'Your responsible-use limit was reached.' }
  }
  if (auction.leaderId === rule.userId) return { action: 'WAIT' }
  const fireAt = nextAutoBidAt(rule, auction)
  if (fireAt === null || ctx.now < fireAt) return { action: 'WAIT' }
  return { action: 'BID' }
}

/**
 * When the agent will next bid, or null if it has nothing to do (e.g. it is leading).
 * The agent waits for the final seconds, then reacts no sooner than AUTOBID_REACTION_MS after
 * the previous bid.
 */
export function nextAutoBidAt(
  rule: AutoBidRule,
  auction: AuctionState,
  jitterMs = 0,
): number | null {
  if (rule.status !== 'ACTIVE' || auction.status !== 'LIVE') return null
  if (auction.leaderId === rule.userId) return null
  const lastEventAt = auction.lastBidAt ?? auction.startsAt
  const fireAt = Math.max(
    lastEventAt + AUTOBID_REACTION_MS + jitterMs,
    auction.closeAt - AUTOBID_TRIGGER_MS + jitterMs,
  )
  return fireAt < auction.closeAt ? fireAt : null
}

export function remainingAllocation(rule: AutoBidRule): number {
  return Math.max(0, rule.maxBids - rule.bidsPlaced)
}

export const AUTOBID_STATUS_LABELS: Record<AutoBidStatus, string> = {
  ACTIVE: 'Active',
  EXHAUSTED: 'Allocation used',
  COMPLETED: 'Auction ended',
  CANCELLED: 'Cancelled',
  STOPPED: 'Stopped',
}
