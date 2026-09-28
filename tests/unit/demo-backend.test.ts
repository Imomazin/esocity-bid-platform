import { describe, expect, it } from 'vitest'

import { summarizeWallet } from '@/domain/wallet'
import { MINUTE } from '@/lib/time'
import { DemoBackend } from '@/server/demo/backend'
import {
  FIRST_NAMES,
  LAST_NAMES,
  SIMULATED_HANDLES,
  isSimulatedBidderId,
} from '@/server/demo/data/people'
import type { AuctionRecord } from '@/server/demo/state'
import { MemoryLockProvider } from '@/server/infra/locks'
import { DemoAnalyticsTracker } from '@/server/providers/analytics'
import { DemoEmailProvider } from '@/server/providers/email'
import { DemoPaymentProvider } from '@/server/providers/payments'
import { DemoRealtimePublisher } from '@/server/providers/realtime'
import { DemoShippingProvider } from '@/server/providers/shipping'

const START = Date.UTC(2026, 8, 28, 14, 7, 0)
const ADMIN = {
  id: 'test-admin',
  name: 'Test Admin',
  role: 'SUPER_ADMIN' as const,
  roles: ['SUPER_ADMIN' as const],
}

/** A demo backend on a frozen clock, so the simulation only moves when a test moves time. */
function createBackend() {
  let now = START
  const backend = new DemoBackend(
    {
      payments: new DemoPaymentProvider(),
      email: new DemoEmailProvider(),
      realtime: new DemoRealtimePublisher(),
      shipping: new DemoShippingProvider(),
      analytics: new DemoAnalyticsTracker(),
    },
    { locks: new MemoryLockProvider(), clock: () => now },
  )
  return {
    backend,
    advance(ms: number) {
      now += ms
    },
  }
}

function members(backend: DemoBackend, count: number): string[] {
  return Array.from({ length: count }, () => backend.ensureSessionAccount(crypto.randomUUID()).id)
}

/** A live auction any demo member may bid in, with time to spare. */
function openAuction(backend: DemoBackend): AuctionRecord {
  const now = backend.now()
  const record = [...backend.state.auctions.values()].find(({ state }) => {
    const { rules } = state
    return (
      state.status === 'LIVE' &&
      state.closeAt - now > 5 * MINUTE &&
      rules.preventSelfOutbid &&
      rules.perUserBidLimit === null &&
      rules.maximumParticipants === null &&
      rules.eligibility.maxPreviousWins === null &&
      rules.eligibility.minimumTier === null &&
      rules.eligibility.minimumAccountAgeDays === null
    )
  })
  if (!record) throw new Error('No open auction in the demo world')
  return record
}

const available = (backend: DemoBackend, userId: string) =>
  summarizeWallet(backend.state.accounts.get(userId)!.ledger, backend.now()).available

describe('demo world', () => {
  it('ships a realistic catalogue, auction schedule and drops', () => {
    const { backend } = createBackend()
    const health = backend.health()
    expect(health.products).toBeGreaterThanOrEqual(40)
    const auctions = [...backend.state.auctions.values()]
    expect(
      auctions.filter(
        (record) => record.state.status === 'LIVE' || record.state.status === 'SCHEDULED',
      ).length,
    ).toBeGreaterThanOrEqual(12)
    expect(
      auctions.filter((record) => record.state.status === 'LIVE').length,
    ).toBeGreaterThanOrEqual(6)
    expect(backend.listDrops().length).toBeGreaterThanOrEqual(3)
    expect(backend.state.orders.size).toBeGreaterThan(0)
  })

  it('keeps at least 12 auctions open around the clock and runs a full day without errors', () => {
    const { backend, advance } = createBackend()
    let minOpen = Number.POSITIVE_INFINITY
    let minLive = Number.POSITIVE_INFINITY
    for (let step = 0; step < 24 * 6; step += 1) {
      advance(10 * MINUTE)
      backend.sync()
      const statuses = [...backend.state.auctions.values()].map((record) => record.state.status)
      minOpen = Math.min(
        minOpen,
        statuses.filter((status) => status === 'LIVE' || status === 'SCHEDULED').length,
      )
      minLive = Math.min(minLive, statuses.filter((status) => status === 'LIVE').length)
    }
    expect(minOpen).toBeGreaterThanOrEqual(12)
    expect(minLive).toBeGreaterThanOrEqual(4)
    // Every stock position is still consistent after a day of reservations, sales and replenishment.
    for (const product of backend.state.products.values())
      expect(backend.admin.product(product.id)).not.toBeNull()
    expect(() => backend.admin.inventory()).not.toThrow()
  })

  it('uses anonymised, clearly simulated bidders', () => {
    const { backend, advance } = createBackend()
    advance(10 * MINUTE)
    backend.sync()
    const simulatedBids = [...backend.state.auctions.values()]
      .flatMap((record) => record.recentBids)
      .filter((bid) => bid.simulated)
    expect(simulatedBids.length).toBeGreaterThan(0)
    for (const bid of simulatedBids) {
      expect(isSimulatedBidderId(bid.bidderId)).toBe(true)
      expect(bid.kind).toBe('SIMULATED')
    }
    const fullNames = new Set(
      FIRST_NAMES.flatMap((first) => LAST_NAMES.map((last) => `${first} ${last}`)),
    )
    for (const handle of SIMULATED_HANDLES) {
      expect(handle).not.toContain(' ')
      expect(FIRST_NAMES).not.toContain(handle)
      expect(fullNames.has(handle)).toBe(false)
    }
  })
})

describe('demo auction engine under concurrency', () => {
  it('serialises simultaneous bids from many members: gap-free sequence, exact price and exact debits', async () => {
    const { backend } = createBackend()
    const record = openAuction(backend)
    const before = { ...record.state }
    const bidders = members(backend, 12)
    const walletsBefore = new Map(bidders.map((id) => [id, available(backend, id)]))

    const results = await Promise.allSettled(
      bidders.map((id) => backend.placeBid(id, record.state.id, null)),
    )
    const accepted = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value)

    expect(accepted).toHaveLength(bidders.length)
    expect(accepted.map((result) => result.sequence).sort((a, b) => a - b)).toEqual(
      bidders.map((_, index) => before.bidCount + index + 1),
    )
    expect(record.state.bidCount).toBe(before.bidCount + bidders.length)
    expect(record.state.priceMinor).toBe(
      before.priceMinor + bidders.length * before.rules.bidIncrementMinor,
    )
    for (const id of bidders)
      expect(available(backend, id)).toBe(walletsBefore.get(id)! - before.rules.bidCreditCost)
  })

  it('treats a double-click as one bid: the second request cannot outbid the leader', async () => {
    const { backend } = createBackend()
    const record = openAuction(backend)
    const [member] = members(backend, 1)
    const wallet = available(backend, member!)
    const results = await Promise.allSettled([
      backend.placeBid(member!, record.state.id, null),
      backend.placeBid(member!, record.state.id, null),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((result) => result.status === 'rejected')
    expect(rejected && rejected.status === 'rejected' ? rejected.reason : null).toMatchObject({
      code: 'ALREADY_LEADING',
    })
    expect(available(backend, member!)).toBe(wallet - record.state.rules.bidCreditCost)
  })

  it('enforces a self-imposed cool-off on every bid', async () => {
    const { backend } = createBackend()
    const record = openAuction(backend)
    const [member] = members(backend, 1)
    backend.updateLimits(member!, { coolOffDays: 1 }, null)
    await expect(backend.placeBid(member!, record.state.id, null)).rejects.toMatchObject({
      code: 'RESPONSIBLE_USE_LIMIT',
    })
  })

  it('asks for the updated terms before bidding, buying bids or checking out, until accepted', async () => {
    const { backend } = createBackend()
    const record = openAuction(backend)
    const [member] = members(backend, 1)
    backend.state.accounts.get(member!)!.compliance.termsAcceptedVersion = '2025-01-01'
    await expect(backend.placeBid(member!, record.state.id, null)).rejects.toMatchObject({
      code: 'NOT_ELIGIBLE',
    })
    await expect(
      backend.purchaseBidPackage(member!, 'starter', { paymentMethod: 'DEMO_CARD' }),
    ).rejects.toMatchObject({ code: 'NOT_ELIGIBLE', details: { requirement: 'TERMS' } })
    expect(backend.termsStatus(member!).upToDate).toBe(false)
    expect(() => backend.acceptTerms(member!, '2025-01-01', null)).toThrow(
      expect.objectContaining({ code: 'CONFLICT' }),
    )
    const current = backend.termsStatus(member!).currentVersion
    expect(backend.acceptTerms(member!, current, null).upToDate).toBe(true)
    await expect(backend.placeBid(member!, record.state.id, null)).resolves.toMatchObject({
      accepted: true,
    })
  })

  it('stops every AutoBid agent when operations pull the kill switch', () => {
    const { backend } = createBackend()
    const record = openAuction(backend)
    const [member] = members(backend, 1)
    const agent = backend.setAutoBid(member!, record.state.id, { maxBids: 5, maxPriceMinor: null })
    expect(agent.status).toBe('ACTIVE')
    backend.admin.setKillSwitch(true, 'Incident drill', ADMIN)
    expect(backend.state.autobids.get(agent.id)?.status).toBe('STOPPED')
    expect(() =>
      backend.setAutoBid(member!, record.state.id, { maxBids: 5, maxPriceMinor: null }),
    ).toThrow(expect.objectContaining({ code: 'FEATURE_DISABLED' }))
  })

  it('never lets a member bid on an auction that has closed', async () => {
    const { backend } = createBackend()
    const [member] = members(backend, 1)
    const closed = [...backend.state.auctions.values()].find(
      (record) => record.state.status === 'COMPLETED',
    )
    expect(closed).toBeDefined()
    await expect(backend.placeBid(member!, closed!.state.id, null)).rejects.toMatchObject({
      code: 'AUCTION_ENDED',
    })
  })
})
