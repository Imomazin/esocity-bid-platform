import { DEFAULT_AUCTION_RULES } from '@/domain/auction/rules'
import type { AuctionRules, AuctionState, Participant } from '@/domain/auction/types'
import type { BidderContext } from '@/domain/auction/bidding'
import type { LedgerEntry } from '@/domain/wallet'
import { SECOND } from '@/lib/time'

/** A fixed reference instant so tests never depend on the wall clock. */
export const T0 = Date.UTC(2026, 8, 1, 12, 0, 0)

export function rules(overrides: Partial<AuctionRules> = {}): AuctionRules {
  return {
    ...DEFAULT_AUCTION_RULES,
    ...overrides,
    eligibility: { ...DEFAULT_AUCTION_RULES.eligibility, ...overrides.eligibility },
  }
}

/** A LIVE auction that started at T0 with the given rules and state overrides. */
export function liveAuction(
  overrides: Partial<AuctionState> = {},
  ruleOverrides: Partial<AuctionRules> = {},
): AuctionState {
  const auctionRules = rules(ruleOverrides)
  return {
    id: 'auction-1',
    productId: 'product-1',
    title: 'Test auction',
    status: 'LIVE',
    rules: auctionRules,
    startsAt: T0,
    closeAt: T0 + auctionRules.timerSeconds * SECOND,
    hardCloseAt: auctionRules.hardStopAfterSeconds
      ? T0 + auctionRules.hardStopAfterSeconds * SECOND
      : null,
    pausedAt: null,
    remainingAtPauseMs: null,
    priceMinor: auctionRules.startingPriceMinor,
    bidCount: 0,
    lastBidAt: null,
    leaderId: null,
    leaderName: null,
    leaderSimulated: false,
    uniqueBidders: 0,
    version: 1,
    result: null,
    cancelReason: null,
    featured: false,
    createdAt: T0 - 60 * SECOND,
    updatedAt: T0,
    ...overrides,
  }
}

export function bidder(overrides: Partial<BidderContext> = {}): BidderContext {
  return {
    bidsInAuction: 0,
    isParticipant: false,
    availableCredits: 100,
    eligibility: { eligible: true },
    limits: { allowed: true },
    restricted: null,
    ...overrides,
  }
}

export function participant(
  bidderId: string,
  bids: number,
  overrides: Partial<Participant> = {},
): Participant {
  return {
    bidderId,
    bidderName: bidderId,
    simulated: false,
    bids,
    purchasedCreditsSpent: bids,
    promotionalCreditsSpent: 0,
    firstBidAt: T0,
    lastBidAt: T0,
    ...overrides,
  }
}

let entrySequence = 0

export function entry(
  overrides: Partial<LedgerEntry> & Pick<LedgerEntry, 'type' | 'bucket' | 'credits'>,
): LedgerEntry {
  entrySequence += 1
  return {
    id: `entry-${String(entrySequence).padStart(4, '0')}`,
    userId: 'user-1',
    createdAt: T0,
    expiresAt: null,
    lotId: null,
    description: overrides.type,
    reference: null,
    idempotencyKey: null,
    ...overrides,
  }
}
