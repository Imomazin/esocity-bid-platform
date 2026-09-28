import type { DomainErrorCode } from '@/domain/errors'
import { SECOND } from '@/lib/time'

import type { EligibilityDecision } from './rules'
import type { AuctionOutcome, AuctionResult, AuctionState, BidKind, Participant } from './types'

/**
 * The authoritative bid algorithm.
 *
 * `evaluateBid` is a pure function: given the locked, current auction state and the bidder's
 * context it decides whether the bid is accepted and what the next state is. It is shared by the
 * in-memory demo engine and the PostgreSQL engine (which runs it inside a transaction holding a
 * row lock on the auction), so both implementations enforce identical rules.
 *
 * The browser never decides anything here: it only submits an intent to bid.
 */

export interface BidAttempt {
  bidderId: string
  bidderName: string
  kind: BidKind
  /** Server time at which the bid is processed. */
  at: number
}

export interface BidderContext {
  /** Bids this bidder has already placed in this auction. */
  bidsInAuction: number
  isParticipant: boolean
  /** Spendable bid credits (after expiring stale promotional credits). */
  availableCredits: number
  eligibility: EligibilityDecision
  /** Responsible-use limit decision for spending `bidCreditCost` credits now. */
  limits: { allowed: true } | { allowed: false; message: string }
  /** Account-level restriction (e.g. a risk hold pending human review). */
  restricted?: { message: string } | null
}

export interface BidRejection {
  accepted: false
  code: DomainErrorCode
  message: string
}

export interface BidAcceptance {
  accepted: true
  sequence: number
  priceAfterMinor: number
  closeAtAfter: number
  creditsCost: number
  extendedByMs: number
  newParticipant: boolean
}

export type BidDecision = BidAcceptance | BidRejection

function reject(code: DomainErrorCode, message: string): BidRejection {
  return { accepted: false, code, message }
}

/** New authoritative close time after a bid at `at`. */
export function closeAtAfterBid(
  state: Pick<AuctionState, 'closeAt' | 'hardCloseAt' | 'rules'>,
  at: number,
): number {
  const extended = Math.max(state.closeAt, at + state.rules.timerExtensionSeconds * SECOND)
  return state.hardCloseAt === null ? extended : Math.min(extended, state.hardCloseAt)
}

/** True when the authoritative clock has expired. Bids at or after closeAt are rejected. */
export function isClockExpired(state: Pick<AuctionState, 'closeAt'>, now: number): boolean {
  return now >= state.closeAt
}

export function remainingMs(
  state: Pick<AuctionState, 'closeAt' | 'status' | 'remainingAtPauseMs'>,
  now: number,
): number {
  if (state.status === 'PAUSED') return state.remainingAtPauseMs ?? 0
  return Math.max(0, state.closeAt - now)
}

export function evaluateBid(
  state: AuctionState,
  attempt: BidAttempt,
  bidder: BidderContext,
): BidDecision {
  switch (state.status) {
    case 'LIVE':
      break
    case 'PAUSED':
      return reject(
        'AUCTION_PAUSED',
        'This auction is temporarily paused. Your bid was not placed.',
      )
    case 'FINALIZING':
    case 'COMPLETED':
      return reject('AUCTION_ENDED', 'This auction has ended.')
    case 'CANCELLED':
      return reject('AUCTION_NOT_LIVE', 'This auction was cancelled.')
    default:
      return reject('AUCTION_NOT_LIVE', 'This auction is not open for bidding yet.')
  }
  if (attempt.at < state.startsAt) {
    return reject('AUCTION_NOT_LIVE', 'This auction is not open for bidding yet.')
  }
  if (isClockExpired(state, attempt.at)) {
    return reject('AUCTION_ENDED', 'This auction has ended.')
  }
  if (bidder.restricted) {
    return reject('ACCOUNT_RESTRICTED', bidder.restricted.message)
  }
  if (state.rules.preventSelfOutbid && state.leaderId === attempt.bidderId) {
    return reject('ALREADY_LEADING', 'You are already the leading bidder.')
  }
  if (state.rules.perUserBidLimit !== null && bidder.bidsInAuction >= state.rules.perUserBidLimit) {
    return reject(
      'BID_LIMIT_REACHED',
      `You have reached the ${state.rules.perUserBidLimit}-bid limit for this auction.`,
    )
  }
  if (
    state.rules.maximumParticipants !== null &&
    !bidder.isParticipant &&
    state.uniqueBidders >= state.rules.maximumParticipants
  ) {
    return reject(
      'PARTICIPANT_CAP_REACHED',
      'This auction has reached its maximum number of bidders.',
    )
  }
  if (!bidder.eligibility.eligible) {
    return reject(
      'NOT_ELIGIBLE',
      bidder.eligibility.reasons[0] ?? 'You are not eligible for this auction.',
    )
  }
  if (!bidder.limits.allowed) {
    return reject('RESPONSIBLE_USE_LIMIT', bidder.limits.message)
  }
  if (bidder.availableCredits < state.rules.bidCreditCost) {
    return reject('INSUFFICIENT_CREDITS', 'You do not have enough bid credits for this bid.')
  }
  const closeAtAfter = closeAtAfterBid(state, attempt.at)
  return {
    accepted: true,
    sequence: state.bidCount + 1,
    priceAfterMinor: state.priceMinor + state.rules.bidIncrementMinor,
    closeAtAfter,
    creditsCost: state.rules.bidCreditCost,
    extendedByMs: closeAtAfter - state.closeAt,
    newParticipant: !bidder.isParticipant,
  }
}

/** Returns the state after an accepted bid. */
export function applyAcceptedBid(
  state: AuctionState,
  attempt: BidAttempt,
  decision: BidAcceptance,
): AuctionState {
  return {
    ...state,
    priceMinor: decision.priceAfterMinor,
    closeAt: decision.closeAtAfter,
    bidCount: decision.sequence,
    lastBidAt: attempt.at,
    leaderId: attempt.bidderId,
    leaderName: attempt.bidderName,
    leaderSimulated: attempt.kind === 'SIMULATED',
    uniqueBidders: state.uniqueBidders + (decision.newParticipant ? 1 : 0),
    version: state.version + 1,
    updatedAt: attempt.at,
  }
}

/** Whether the engine must finalise the auction now. */
export function isDueForFinalization(state: AuctionState, now: number): boolean {
  return state.status === 'LIVE' && isClockExpired(state, now)
}

/**
 * Determines the outcome at close. Pure and deterministic: the winner is always the leader at
 * the authoritative close time, subject to reserve and minimum-participant rules.
 */
export function determineOutcome(
  state: AuctionState,
  participants: ReadonlyMap<string, Participant> | readonly Participant[],
  closedAt: number,
): AuctionResult {
  const list = Array.isArray(participants)
    ? participants
    : [...(participants as ReadonlyMap<string, Participant>).values()]
  const uniqueBidders = list.length
  let outcome: AuctionOutcome = 'WON'
  if (state.bidCount === 0 || !state.leaderId) outcome = 'NO_BIDS'
  else if (uniqueBidders < state.rules.minimumParticipants) outcome = 'MIN_PARTICIPANTS_NOT_MET'
  else if (
    state.rules.reservePriceMinor !== null &&
    state.priceMinor < state.rules.reservePriceMinor
  )
    outcome = 'RESERVE_NOT_MET'
  const winner =
    outcome === 'WON'
      ? list.find((participant) => participant.bidderId === state.leaderId)
      : undefined
  return {
    outcome,
    winnerId: outcome === 'WON' ? state.leaderId : null,
    winnerName: outcome === 'WON' ? state.leaderName : null,
    winnerSimulated: outcome === 'WON' ? state.leaderSimulated : false,
    finalPriceMinor: state.priceMinor,
    closedAt,
    bidCount: state.bidCount,
    uniqueBidders,
    winnerBidCount: winner?.bids ?? 0,
    bidsRefunded: outcome === 'MIN_PARTICIPANTS_NOT_MET' || outcome === 'RESERVE_NOT_MET',
  }
}

export const OUTCOME_LABELS: Record<AuctionOutcome, string> = {
  WON: 'Won',
  NO_BIDS: 'Closed without bids',
  RESERVE_NOT_MET: 'Reserve not met — bids refunded',
  MIN_PARTICIPANTS_NOT_MET: 'Not enough bidders — bids refunded',
}
