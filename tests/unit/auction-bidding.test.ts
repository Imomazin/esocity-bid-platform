import { describe, expect, it } from 'vitest'

import {
  applyAcceptedBid,
  closeAtAfterBid,
  determineOutcome,
  evaluateBid,
  isDueForFinalization,
  remainingMs,
  type BidAttempt,
} from '@/domain/auction/bidding'
import {
  auctionRulesSchema,
  checkEligibility,
  lockedRuleViolations,
  mergeRules,
  type BidderEligibilityProfile,
} from '@/domain/auction/rules'
import type { AuctionState } from '@/domain/auction/types'
import { DAY, MINUTE, SECOND } from '@/lib/time'

import { T0, bidder, liveAuction, participant, rules } from './fixtures'

const attempt = (bidderId: string, at: number): BidAttempt => ({
  bidderId,
  bidderName: bidderId,
  kind: 'MANUAL',
  at,
})

function rejection(state: AuctionState, bid: BidAttempt, context = bidder()) {
  const decision = evaluateBid(state, bid, context)
  return decision.accepted ? null : decision.code
}

describe('evaluateBid', () => {
  it('accepts a valid bid: price rises by the increment and the sequence advances', () => {
    const auction = liveAuction(
      { priceMinor: 120, bidCount: 12 },
      { bidIncrementMinor: 1, bidCreditCost: 1 },
    )
    const decision = evaluateBid(auction, attempt('alice', T0 + MINUTE), bidder())
    expect(decision).toMatchObject({
      accepted: true,
      sequence: 13,
      priceAfterMinor: 121,
      creditsCost: 1,
      newParticipant: true,
    })
  })

  it.each([
    ['DRAFT', 'AUCTION_NOT_LIVE'],
    ['SCHEDULED', 'AUCTION_NOT_LIVE'],
    ['PAUSED', 'AUCTION_PAUSED'],
    ['FINALIZING', 'AUCTION_ENDED'],
    ['COMPLETED', 'AUCTION_ENDED'],
    ['CANCELLED', 'AUCTION_NOT_LIVE'],
  ] as const)('rejects bids while %s', (status, code) => {
    expect(rejection(liveAuction({ status }), attempt('alice', T0 + SECOND))).toBe(code)
  })

  it('rejects bids at or after the authoritative close time, even by a millisecond', () => {
    const auction = liveAuction({ closeAt: T0 + MINUTE })
    expect(rejection(auction, attempt('alice', T0 + MINUTE - 1))).toBeNull()
    expect(rejection(auction, attempt('alice', T0 + MINUTE))).toBe('AUCTION_ENDED')
  })

  it('rejects bids before the start time', () => {
    expect(rejection(liveAuction(), attempt('alice', T0 - 1))).toBe('AUCTION_NOT_LIVE')
  })

  it('stops the leader from outbidding themselves when configured', () => {
    const auction = liveAuction({ leaderId: 'alice', bidCount: 1, priceMinor: 1 })
    expect(rejection(auction, attempt('alice', T0 + SECOND))).toBe('ALREADY_LEADING')
    const permissive = liveAuction(
      { leaderId: 'alice', bidCount: 1, priceMinor: 1 },
      { preventSelfOutbid: false },
    )
    expect(rejection(permissive, attempt('alice', T0 + SECOND))).toBeNull()
  })

  it('enforces per-user limits, participant caps, eligibility, responsible-use limits and credits', () => {
    const at = T0 + SECOND
    expect(
      rejection(
        liveAuction({}, { perUserBidLimit: 3 }),
        attempt('alice', at),
        bidder({ bidsInAuction: 3, isParticipant: true }),
      ),
    ).toBe('BID_LIMIT_REACHED')
    const capped = liveAuction({ uniqueBidders: 2 }, { maximumParticipants: 2 })
    expect(rejection(capped, attempt('carol', at))).toBe('PARTICIPANT_CAP_REACHED')
    expect(
      rejection(capped, attempt('bob', at), bidder({ isParticipant: true, bidsInAuction: 1 })),
    ).toBeNull()
    expect(
      rejection(
        liveAuction(),
        attempt('alice', at),
        bidder({ eligibility: { eligible: false, reasons: ['Region'] } }),
      ),
    ).toBe('NOT_ELIGIBLE')
    expect(
      rejection(
        liveAuction(),
        attempt('alice', at),
        bidder({ limits: { allowed: false, message: 'Daily limit' } }),
      ),
    ).toBe('RESPONSIBLE_USE_LIMIT')
    expect(
      rejection(
        liveAuction({}, { bidCreditCost: 2 }),
        attempt('alice', at),
        bidder({ availableCredits: 1 }),
      ),
    ).toBe('INSUFFICIENT_CREDITS')
    expect(
      rejection(
        liveAuction(),
        attempt('alice', at),
        bidder({ restricted: { message: 'Under review' } }),
      ),
    ).toBe('ACCOUNT_RESTRICTED')
  })

  it('extends the clock so at least the extension window remains, but never past a hard stop', () => {
    const auction = liveAuction({ closeAt: T0 + 10 * SECOND }, { timerExtensionSeconds: 15 })
    expect(closeAtAfterBid(auction, T0 + 8 * SECOND)).toBe(T0 + 23 * SECOND)
    // Plenty of time left: a bid does not add time.
    const early = liveAuction({ closeAt: T0 + 10 * MINUTE }, { timerExtensionSeconds: 15 })
    expect(closeAtAfterBid(early, T0 + MINUTE)).toBe(T0 + 10 * MINUTE)
    const hardStop = liveAuction(
      { closeAt: T0 + 10 * SECOND, hardCloseAt: T0 + 12 * SECOND },
      { timerExtensionSeconds: 15 },
    )
    expect(closeAtAfterBid(hardStop, T0 + 8 * SECOND)).toBe(T0 + 12 * SECOND)
  })

  it('applies an accepted bid to produce the next authoritative state', () => {
    const auction = liveAuction(
      { closeAt: T0 + 5 * SECOND, priceMinor: 40, bidCount: 40, uniqueBidders: 3 },
      { timerExtensionSeconds: 15 },
    )
    const bid = attempt('dave', T0 + 2 * SECOND)
    const decision = evaluateBid(auction, bid, bidder())
    if (!decision.accepted) throw new Error('expected acceptance')
    const next = applyAcceptedBid(auction, bid, decision)
    expect(next).toMatchObject({
      priceMinor: 41,
      bidCount: 41,
      leaderId: 'dave',
      uniqueBidders: 4,
      closeAt: T0 + 17 * SECOND,
      lastBidAt: T0 + 2 * SECOND,
      version: auction.version + 1,
    })
    expect(decision.extendedByMs).toBe(12 * SECOND)
  })

  it('reports remaining time from server state only', () => {
    expect(remainingMs(liveAuction({ closeAt: T0 + 5 * SECOND }), T0)).toBe(5 * SECOND)
    expect(remainingMs(liveAuction({ closeAt: T0 + 5 * SECOND }), T0 + MINUTE)).toBe(0)
    expect(
      remainingMs(liveAuction({ status: 'PAUSED', remainingAtPauseMs: 42_000 }), T0 + DAY),
    ).toBe(42_000)
    expect(isDueForFinalization(liveAuction({ closeAt: T0 }), T0)).toBe(true)
    expect(isDueForFinalization(liveAuction({ closeAt: T0, status: 'PAUSED' }), T0)).toBe(false)
  })
})

describe('determineOutcome', () => {
  const closedAt = T0 + DAY

  it('awards the auction to the leader at close', () => {
    const auction = liveAuction({
      leaderId: 'bob',
      leaderName: 'bob',
      bidCount: 30,
      priceMinor: 30,
    })
    const result = determineOutcome(
      auction,
      [participant('alice', 12), participant('bob', 18)],
      closedAt,
    )
    expect(result).toMatchObject({
      outcome: 'WON',
      winnerId: 'bob',
      finalPriceMinor: 30,
      winnerBidCount: 18,
      uniqueBidders: 2,
      bidsRefunded: false,
    })
  })

  it('closes without a sale when nobody bid', () => {
    expect(determineOutcome(liveAuction(), [], closedAt)).toMatchObject({
      outcome: 'NO_BIDS',
      winnerId: null,
      bidsRefunded: false,
    })
  })

  it('refunds bids when the minimum number of bidders is not reached', () => {
    const auction = liveAuction(
      { leaderId: 'alice', bidCount: 5, priceMinor: 5 },
      { minimumParticipants: 2 },
    )
    expect(determineOutcome(auction, [participant('alice', 5)], closedAt)).toMatchObject({
      outcome: 'MIN_PARTICIPANTS_NOT_MET',
      winnerId: null,
      bidsRefunded: true,
    })
  })

  it('refunds bids when the reserve is not met', () => {
    const auction = liveAuction(
      { leaderId: 'alice', bidCount: 5, priceMinor: 5 },
      { reservePriceMinor: 10, minimumParticipants: 1 },
    )
    expect(
      determineOutcome(auction, new Map([['alice', participant('alice', 5)]]), closedAt),
    ).toMatchObject({
      outcome: 'RESERVE_NOT_MET',
      bidsRefunded: true,
    })
  })
})

describe('auction rules', () => {
  const profile: BidderEligibilityProfile = {
    tier: 'MEMBER',
    previousWins: 0,
    accountCreatedAt: T0 - 90 * DAY,
    market: 'UK',
    ageVerifiedAtLeast: 18,
  }

  it('validates cross-field constraints', () => {
    expect(auctionRulesSchema.safeParse(rules()).success).toBe(true)
    const errors = auctionRulesSchema.safeParse(
      rules({
        minimumParticipants: 5,
        maximumParticipants: 3,
        timerSeconds: 3_600,
        hardStopAfterSeconds: 600,
        buyNowEnabled: false,
        bidCreditRecoveryEnabled: true,
      }),
    )
    expect(errors.success).toBe(false)
    const paths = errors.error?.issues.map((issue) => issue.path.join('.'))
    expect(paths).toEqual(
      expect.arrayContaining([
        'maximumParticipants',
        'hardStopAfterSeconds',
        'bidCreditRecoveryEnabled',
      ]),
    )
  })

  it('merges eligibility patches without dropping existing fields', () => {
    const merged = mergeRules(rules(), {
      eligibility: { ...rules().eligibility, maxPreviousWins: 0 },
    })
    expect(merged.eligibility).toMatchObject({
      maxPreviousWins: 0,
      markets: ['UK'],
      minimumAge: 18,
    })
  })

  it('locks sensitive rules once bidding starts and everything after close', () => {
    const current = rules()
    expect(lockedRuleViolations('SCHEDULED', current, { bidIncrementMinor: 10 })).toEqual([])
    expect(
      lockedRuleViolations('LIVE', current, { bidIncrementMinor: 10, autoBidEnabled: false }),
    ).toEqual(['bidIncrementMinor'])
    // Unchanged values are not violations.
    expect(
      lockedRuleViolations('LIVE', current, { bidIncrementMinor: current.bidIncrementMinor }),
    ).toEqual([])
    // AutoBid may be switched off (kill switch) but not back on while live.
    expect(lockedRuleViolations('LIVE', current, { autoBidEnabled: false })).toEqual([])
    expect(
      lockedRuleViolations('LIVE', rules({ autoBidEnabled: false }), { autoBidEnabled: true }),
    ).toEqual(['autoBidEnabled'])
    expect(lockedRuleViolations('COMPLETED', current, { autoBidEnabled: false })).toEqual([
      'autoBidEnabled',
    ])
  })

  it('explains every eligibility failure', () => {
    expect(checkEligibility(rules().eligibility, profile, T0)).toEqual({ eligible: true })
    const decision = checkEligibility(
      {
        minimumTier: 'GOLD',
        maxPreviousWins: 0,
        minimumAccountAgeDays: 120,
        markets: ['IE'],
        minimumAge: 21,
      },
      { ...profile, previousWins: 2 },
      T0,
    )
    expect(decision.eligible).toBe(false)
    if (!decision.eligible) expect(decision.reasons).toHaveLength(5)
  })
})
