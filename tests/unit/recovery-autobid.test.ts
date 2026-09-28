import { describe, expect, it } from 'vitest'

import {
  AUTOBID_REACTION_MS,
  AUTOBID_TRIGGER_MS,
  autoBidDecision,
  nextAutoBidAt,
  remainingAllocation,
  validateAutoBidConfig,
  type AutoBidContext,
  type AutoBidRule,
} from '@/domain/auction/autobid'
import { quoteRecovery, type RecoveryInput } from '@/domain/auction/recovery'
import type { AuctionResult } from '@/domain/auction/types'
import { HOUR, MINUTE, SECOND } from '@/lib/time'

import { T0, liveAuction, rules } from './fixtures'

const CLOSED_AT = T0 + HOUR

function result(overrides: Partial<AuctionResult> = {}): AuctionResult {
  return {
    outcome: 'WON',
    winnerId: 'winner',
    winnerName: 'winner',
    winnerSimulated: false,
    finalPriceMinor: 2_450,
    closedAt: CLOSED_AT,
    bidCount: 2_450,
    uniqueBidders: 14,
    winnerBidCount: 300,
    bidsRefunded: false,
    ...overrides,
  }
}

function recovery(overrides: Partial<RecoveryInput> = {}): RecoveryInput {
  return {
    rules: rules({ recoveryMode: 'RETURN_BIDS', recoveryWindowHours: 48 }),
    auction: { id: 'auction-1', status: 'COMPLETED', result: result(), leaderId: 'winner' },
    userId: 'member',
    purchasedCreditsSpent: 30,
    promotionalCreditsSpent: 10,
    creditValueMinor: 60,
    buyNowPriceMinor: 19_999,
    now: CLOSED_AT + HOUR,
    alreadyRecovered: false,
    marketAllowsRecovery: true,
    featureEnabled: true,
    ...overrides,
  }
}

describe('bid credit recovery', () => {
  it('returns purchased and (when allowed) promotional bids to the wallet', () => {
    const quote = quoteRecovery(recovery())
    expect(quote).toMatchObject({
      eligible: true,
      mode: 'RETURN_BIDS',
      credits: 40,
      purchasedCredits: 30,
      promotionalCredits: 10,
      payableMinor: 19_999,
    })
    expect(quote.windowEndsAt).toBe(CLOSED_AT + 48 * HOUR)
    const purchasedOnly = quoteRecovery(
      recovery({ rules: rules({ recoverPromotionalBids: false }) }),
    )
    expect(purchasedOnly.credits).toBe(30)
  })

  it('credits only purchased bids against the price, never below zero', () => {
    const quote = quoteRecovery(recovery({ rules: rules({ recoveryMode: 'PRICE_CREDIT' }) }))
    expect(quote).toMatchObject({
      eligible: true,
      credits: 30,
      promotionalCredits: 0,
      valueMinor: 1_800,
      payableMinor: 18_199,
    })
    const capped = quoteRecovery(
      recovery({
        rules: rules({ recoveryMode: 'PRICE_CREDIT' }),
        purchasedCreditsSpent: 1_000,
        buyNowPriceMinor: 5_000,
      }),
    )
    expect(capped).toMatchObject({ valueMinor: 5_000, payableMinor: 0 })
    const promoOnly = quoteRecovery(
      recovery({ rules: rules({ recoveryMode: 'PRICE_CREDIT' }), purchasedCreditsSpent: 0 }),
    )
    expect(promoOnly.eligible).toBe(false)
  })

  it.each([
    ['the winner', { userId: 'winner' }, 'You won this auction.'],
    ['the window has closed', { now: CLOSED_AT + 49 * HOUR }, 'The recovery window has closed.'],
    [
      'already recovered',
      { alreadyRecovered: true },
      'You have already used bid recovery for this auction.',
    ],
    [
      'no bids placed',
      { purchasedCreditsSpent: 0, promotionalCreditsSpent: 0 },
      'You have not bid in this auction.',
    ],
    [
      'the market does not allow it',
      { marketAllowsRecovery: false },
      'Bid recovery is not available in your market.',
    ],
    [
      'the feature flag is off',
      { featureEnabled: false },
      'Bid recovery is not available in your market.',
    ],
    [
      'bids were already refunded',
      {
        auction: {
          id: 'auction-1',
          status: 'COMPLETED' as const,
          result: result({ outcome: 'RESERVE_NOT_MET', winnerId: null, bidsRefunded: true }),
          leaderId: 'winner',
        },
      },
      'Bids for this auction were already refunded.',
    ],
  ])('is refused when %s', (_label, overrides, reason) => {
    const quote = quoteRecovery(recovery(overrides as Partial<RecoveryInput>))
    expect(quote.eligible).toBe(false)
    expect(quote.reasons).toContain(reason)
    expect(quote.credits).toBe(0)
    expect(quote.valueMinor).toBe(0)
  })
})

describe('AutoBid', () => {
  const agent = (overrides: Partial<AutoBidRule> = {}): AutoBidRule => ({
    id: 'agent-1',
    auctionId: 'auction-1',
    userId: 'member',
    userName: 'member',
    maxBids: 10,
    maxPriceMinor: null,
    bidsPlaced: 0,
    status: 'ACTIVE',
    stopReason: null,
    createdAt: T0,
    updatedAt: T0,
    lastBidAt: null,
    ...overrides,
  })
  const context = (overrides: Partial<AutoBidContext> = {}): AutoBidContext => ({
    now: T0,
    availableCredits: 100,
    killSwitchActive: false,
    featureEnabled: true,
    limitsAllowed: true,
    ...overrides,
  })

  it('validates configuration against the auction', () => {
    const auction = liveAuction({ priceMinor: 500 }, { perUserBidLimit: 50 })
    expect(validateAutoBidConfig({ maxBids: 20, maxPriceMinor: null }, auction)).toBeNull()
    expect(validateAutoBidConfig({ maxBids: 0, maxPriceMinor: null }, auction)).toMatch(/between/)
    expect(validateAutoBidConfig({ maxBids: 60, maxPriceMinor: null }, auction)).toMatch(
      /at most 50/,
    )
    expect(validateAutoBidConfig({ maxBids: 20, maxPriceMinor: 500 }, auction)).toMatch(
      /above the current/,
    )
    expect(
      validateAutoBidConfig(
        { maxBids: 20, maxPriceMinor: null },
        liveAuction({}, { autoBidEnabled: false }),
      ),
    ).toMatch(/not available/)
    expect(
      validateAutoBidConfig(
        { maxBids: 20, maxPriceMinor: null },
        liveAuction({ status: 'COMPLETED' }),
      ),
    ).toMatch(/upcoming or live/)
  })

  it('waits for the final seconds and bids only when not leading', () => {
    const auction = liveAuction({
      closeAt: T0 + MINUTE,
      lastBidAt: T0,
      leaderId: 'rival',
      bidCount: 1,
    })
    const fireAt = nextAutoBidAt(agent(), auction)
    expect(fireAt).toBe(T0 + MINUTE - AUTOBID_TRIGGER_MS)
    expect(autoBidDecision(agent(), auction, context({ now: fireAt! - 1 }))).toEqual({
      action: 'WAIT',
    })
    expect(autoBidDecision(agent(), auction, context({ now: fireAt! }))).toEqual({ action: 'BID' })
    const leading = { ...auction, leaderId: 'member' }
    expect(nextAutoBidAt(agent(), leading)).toBeNull()
    expect(autoBidDecision(agent(), leading, context({ now: fireAt! }))).toEqual({ action: 'WAIT' })
  })

  it('reacts no sooner than the human-like reaction delay after the previous bid', () => {
    const lastBidAt = T0 + MINUTE - 2 * SECOND
    const auction = liveAuction({ closeAt: T0 + MINUTE, lastBidAt, leaderId: 'rival', bidCount: 5 })
    expect(nextAutoBidAt(agent(), auction)).toBe(lastBidAt + AUTOBID_REACTION_MS)
  })

  it('stops immediately when the kill switch or feature flag is off', () => {
    const auction = liveAuction({ leaderId: 'rival', bidCount: 1 })
    expect(autoBidDecision(agent(), auction, context({ killSwitchActive: true }))).toMatchObject({
      action: 'STOP',
      status: 'STOPPED',
    })
    expect(autoBidDecision(agent(), auction, context({ featureEnabled: false }))).toMatchObject({
      action: 'STOP',
      status: 'STOPPED',
    })
    expect(
      autoBidDecision(agent(), liveAuction({}, { autoBidEnabled: false }), context()),
    ).toMatchObject({ action: 'STOP', status: 'STOPPED' })
  })

  it('stops when the allocation, price ceiling, credits or responsible-use limits run out', () => {
    const auction = liveAuction({ priceMinor: 999, leaderId: 'rival', bidCount: 999 })
    expect(autoBidDecision(agent({ bidsPlaced: 10 }), auction, context())).toMatchObject({
      status: 'EXHAUSTED',
    })
    expect(autoBidDecision(agent({ maxPriceMinor: 999 }), auction, context())).toMatchObject({
      status: 'EXHAUSTED',
    })
    expect(autoBidDecision(agent(), auction, context({ availableCredits: 0 }))).toMatchObject({
      status: 'STOPPED',
      reason: 'You ran out of bid credits.',
    })
    expect(autoBidDecision(agent(), auction, context({ limitsAllowed: false }))).toMatchObject({
      status: 'STOPPED',
    })
    expect(autoBidDecision(agent(), liveAuction({ status: 'COMPLETED' }), context())).toMatchObject(
      { status: 'COMPLETED' },
    )
    expect(remainingAllocation(agent({ bidsPlaced: 12 }))).toBe(0)
  })
})
