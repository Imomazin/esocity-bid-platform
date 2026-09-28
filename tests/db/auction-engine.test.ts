import { and, asc, eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import * as schema from '@db/schema'
import { DomainError } from '@/domain/errors'

import {
  createLiveAuction,
  createMember,
  resetDatabase,
  setupContext,
  type TestContext,
} from './helpers'

let ctx: TestContext

beforeAll(async () => {
  await resetDatabase()
  ctx = await setupContext()
})

afterAll(async () => {
  await ctx?.handle.close()
})

async function errorCode(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise
    return null
  } catch (error) {
    if (error instanceof DomainError) return error.code
    // Drizzle wraps driver errors; the PostgreSQL message is on `cause`.
    const cause = (error as Error & { cause?: Error }).cause
    return `UNEXPECTED:${cause?.message ?? (error as Error).message}`
  }
}

describe('PostgreSQL auction engine', () => {
  it('accepts a bid and debits the wallet in the same transaction', async () => {
    const member = await createMember(ctx, 10)
    const auction = await createLiveAuction(ctx)
    const result = await ctx.engine.placeBid({ auctionId: auction.id, userId: member.id })
    expect(result).toMatchObject({
      accepted: true,
      sequence: 1,
      priceMinor: 1,
      creditsSpent: 1,
      walletAvailable: 9,
    })

    const [row] = await ctx.handle.db
      .select()
      .from(schema.auctions)
      .where(eq(schema.auctions.id, auction.id))
    expect(row).toMatchObject({
      bidCount: 1,
      priceMinor: 1,
      leaderId: member.id,
      uniqueBidders: 1,
      version: 2,
    })
    const [wallet] = await ctx.handle.db
      .select()
      .from(schema.bidWallets)
      .where(eq(schema.bidWallets.userId, member.id))
    expect(wallet).toMatchObject({ purchasedBalance: 9, promotionalBalance: 0 })
    const summary = await ctx.engine.walletSummary(member.id)
    expect(summary.available).toBe(9)
  })

  it('serialises concurrent bids from many members: gap-free sequences and no lost updates', async () => {
    const auction = await createLiveAuction(ctx, { bidIncrementMinor: 5 })
    const members = await Promise.all(Array.from({ length: 30 }, () => createMember(ctx, 5)))
    const results = await Promise.allSettled(
      members.map((member) => ctx.engine.placeBid({ auctionId: auction.id, userId: member.id })),
    )
    const accepted = results.filter((result) => result.status === 'fulfilled')
    expect(accepted).toHaveLength(30)

    const bids = await ctx.handle.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.auctionId, auction.id))
      .orderBy(asc(schema.bids.sequence))
    expect(bids.map((bid) => bid.sequence)).toEqual(
      Array.from({ length: 30 }, (_, index) => index + 1),
    )
    expect(bids.map((bid) => bid.priceAfterMinor)).toEqual(
      Array.from({ length: 30 }, (_, index) => (index + 1) * 5),
    )
    expect(new Set(bids.map((bid) => bid.userId)).size).toBe(30)

    const [row] = await ctx.handle.db
      .select()
      .from(schema.auctions)
      .where(eq(schema.auctions.id, auction.id))
    expect(row).toMatchObject({
      bidCount: 30,
      priceMinor: 150,
      uniqueBidders: 30,
      leaderId: bids[29]!.userId,
    })
    // Every accepted bid consumed exactly one credit from exactly one wallet.
    const debits = await ctx.handle.db.execute<{ total: string }>(
      sql`select coalesce(sum(credits), 0) as total from bid_ledger_entries where type = 'AUCTION_BID' and reference_id in (select id::text from bids where auction_id = ${auction.id})`,
    )
    expect(Number(debits[0]!.total)).toBe(-30)
  })

  it('stops a double-click from spending twice: the leader cannot outbid themselves', async () => {
    const member = await createMember(ctx, 10)
    const auction = await createLiveAuction(ctx)
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        ctx.engine.placeBid({ auctionId: auction.id, userId: member.id }),
      ),
    )
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )
    expect(
      rejected.every(
        (result) =>
          result.reason instanceof DomainError && result.reason.code === 'ALREADY_LEADING',
      ),
    ).toBe(true)
    const summary = await ctx.engine.walletSummary(member.id)
    expect(summary.available).toBe(9)
  })

  it('replays an idempotent retry without charging again', async () => {
    const member = await createMember(ctx, 5)
    const auction = await createLiveAuction(ctx)
    const first = await ctx.engine.placeBid({
      auctionId: auction.id,
      userId: member.id,
      idempotencyKey: 'retry-key-1',
    })
    const second = await ctx.engine.placeBid({
      auctionId: auction.id,
      userId: member.id,
      idempotencyKey: 'retry-key-1',
    })
    expect(second.replayed).toBe(true)
    expect(second.bidId).toBe(first.bidId)
    expect(second.walletAvailable).toBe(4)
    const bids = await ctx.handle.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.auctionId, auction.id))
    expect(bids).toHaveLength(1)
  })

  it('never lets a wallet go negative, even with concurrent bids across auctions', async () => {
    const member = await createMember(ctx, 3)
    const auctions = await Promise.all(Array.from({ length: 6 }, () => createLiveAuction(ctx)))
    const results = await Promise.allSettled(
      auctions.map((auction) => ctx.engine.placeBid({ auctionId: auction.id, userId: member.id })),
    )
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3)
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    )
    expect(
      rejected.every(
        (result) =>
          result.reason instanceof DomainError && result.reason.code === 'INSUFFICIENT_CREDITS',
      ),
    ).toBe(true)
    const [wallet] = await ctx.handle.db
      .select()
      .from(schema.bidWallets)
      .where(eq(schema.bidWallets.userId, member.id))
    expect(wallet).toMatchObject({ purchasedBalance: 0, promotionalBalance: 0 })
    // The database itself rejects a negative balance.
    const code = await errorCode(
      ctx.handle.db
        .update(schema.bidWallets)
        .set({ purchasedBalance: -1 })
        .where(eq(schema.bidWallets.userId, member.id)),
    )
    expect(code).toMatch(/UNEXPECTED:.*/)
  })

  it('rejects bids once the authoritative clock has expired', async () => {
    const member = await createMember(ctx, 5)
    const now = Date.now()
    const auction = await createLiveAuction(ctx, {
      startsAt: new Date(now - 700_000),
      closeAt: new Date(now - 1_000),
    })
    expect(await errorCode(ctx.engine.placeBid({ auctionId: auction.id, userId: member.id }))).toBe(
      'AUCTION_ENDED',
    )
    const summary = await ctx.engine.walletSummary(member.id)
    expect(summary.available).toBe(5)
  })

  it('does not let Esocity staff bid', async () => {
    const staff = await createMember(ctx, 5, { role: 'OPERATIONS' })
    const auction = await createLiveAuction(ctx)
    expect(await errorCode(ctx.engine.placeBid({ auctionId: auction.id, userId: staff.id }))).toBe(
      'ACCOUNT_RESTRICTED',
    )
  })

  it('finalises exactly once, picks the leader and creates the winner order', async () => {
    const [alice, bob] = await Promise.all([createMember(ctx, 5), createMember(ctx, 5)])
    const auction = await createLiveAuction(ctx)
    await ctx.engine.placeBid({ auctionId: auction.id, userId: alice!.id })
    await ctx.engine.placeBid({ auctionId: auction.id, userId: bob!.id })
    await ctx.handle.db
      .update(schema.auctions)
      .set({ closeAt: new Date(Date.now() - 1_000) })
      .where(eq(schema.auctions.id, auction.id))

    const [first, second] = await Promise.all([
      ctx.engine.finalizeAuction(auction.id),
      ctx.engine.finalizeAuction(auction.id),
    ])
    const results = [first, second].filter((result) => result !== null)
    expect(results).toHaveLength(1)
    expect(results[0]!.result).toMatchObject({
      outcome: 'WON',
      winnerId: bob!.id,
      finalPriceMinor: 2,
      bidsRefunded: false,
    })

    const [row] = await ctx.handle.db
      .select()
      .from(schema.auctions)
      .where(eq(schema.auctions.id, auction.id))
    expect(row!.status).toBe('COMPLETED')
    const orders = await ctx.handle.db
      .select()
      .from(schema.orders)
      .where(and(eq(schema.orders.auctionId, auction.id), eq(schema.orders.source, 'AUCTION_WIN')))
    expect(orders).toHaveLength(1)
    expect(orders[0]).toMatchObject({ userId: bob!.id, status: 'PENDING_PAYMENT', totalMinor: 2 })
    expect(await errorCode(ctx.engine.placeBid({ auctionId: auction.id, userId: alice!.id }))).toBe(
      'AUCTION_ENDED',
    )
  })

  it('refunds every bid when the minimum number of bidders is not met', async () => {
    const member = await createMember(ctx, 5)
    const auction = await createLiveAuction(ctx, { minimumParticipants: 3 })
    await ctx.engine.placeBid({ auctionId: auction.id, userId: member.id })
    expect((await ctx.engine.walletSummary(member.id)).available).toBe(4)
    await ctx.handle.db
      .update(schema.auctions)
      .set({ closeAt: new Date(Date.now() - 1_000) })
      .where(eq(schema.auctions.id, auction.id))
    const finalized = await ctx.engine.finalizeAuction(auction.id)
    expect(finalized!.result).toMatchObject({
      outcome: 'MIN_PARTICIPANTS_NOT_MET',
      bidsRefunded: true,
      winnerId: null,
    })
    expect((await ctx.engine.walletSummary(member.id)).available).toBe(5)
  })

  it('refunds member bids when an operator cancels an auction', async () => {
    const [alice, bob] = await Promise.all([createMember(ctx, 5), createMember(ctx, 5)])
    const auction = await createLiveAuction(ctx)
    await ctx.engine.placeBid({ auctionId: auction.id, userId: alice!.id })
    await ctx.engine.placeBid({ auctionId: auction.id, userId: bob!.id })
    await ctx.engine.transitionAuction({
      auctionId: auction.id,
      to: 'CANCELLED',
      reason: 'Supplier stock issue',
      actor: { type: 'ADMIN', id: 'ops-1', name: 'Ops', role: 'OPERATIONS' },
    })
    expect((await ctx.engine.walletSummary(alice!.id)).available).toBe(5)
    expect((await ctx.engine.walletSummary(bob!.id)).available).toBe(5)
    const audit = await ctx.handle.db
      .select()
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.entityId, auction.id))
    expect(
      audit.some((event) => event.action === 'auction.transition' && event.severity === 'WARNING'),
    ).toBe(true)
  })

  it('requires a reason to pause and never lets an operator complete an auction', async () => {
    const auction = await createLiveAuction(ctx)
    const actor = { type: 'ADMIN' as const, id: 'ops-1', name: 'Ops' }
    expect(
      await errorCode(ctx.engine.transitionAuction({ auctionId: auction.id, to: 'PAUSED', actor })),
    ).toBe('INVALID_TRANSITION')
    expect(
      await errorCode(
        ctx.engine.transitionAuction({ auctionId: auction.id, to: 'COMPLETED', actor }),
      ),
    ).toBe('INVALID_TRANSITION')
    const paused = await ctx.engine.transitionAuction({
      auctionId: auction.id,
      to: 'PAUSED',
      reason: 'Checking stock',
      actor,
    })
    expect(paused.status).toBe('PAUSED')
  })

  it('keeps ledgers and the audit log append-only at the database level', async () => {
    const member = await createMember(ctx, 5)
    const auction = await createLiveAuction(ctx)
    await ctx.engine.placeBid({ auctionId: auction.id, userId: member.id })
    expect(
      await errorCode(
        ctx.handle.db
          .update(schema.bids)
          .set({ priceAfterMinor: 999 })
          .where(eq(schema.bids.auctionId, auction.id)),
      ),
    ).toMatch(/append-only/)
    expect(
      await errorCode(
        ctx.handle.db
          .delete(schema.bidLedgerEntries)
          .where(eq(schema.bidLedgerEntries.userId, member.id)),
      ),
    ).toMatch(/append-only/)
    expect(await errorCode(ctx.handle.db.delete(schema.auditEvents))).toMatch(/append-only/)
  })
})
