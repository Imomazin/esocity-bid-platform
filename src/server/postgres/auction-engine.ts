import { and, asc, eq, inArray, isNull, lte, sql } from 'drizzle-orm'

import * as schema from '@db/schema'
import {
  applyAcceptedBid,
  determineOutcome,
  evaluateBid,
  type BidderContext,
} from '@/domain/auction/bidding'
import { checkEligibility } from '@/domain/auction/rules'
import { transition } from '@/domain/auction/state-machine'
import type { AuctionResult, AuctionState, AuctionStatus } from '@/domain/auction/types'
import { DomainError } from '@/domain/errors'
import {
  applyMaturedChanges,
  checkBidAllowance,
  type ResponsibleUseLimits,
} from '@/domain/responsible-use'
import {
  collectExpiries,
  planDebit,
  PROMOTIONAL_CREDIT_VALIDITY_MS,
  summarizeWallet,
  type CreditBucket,
  type LedgerEntry,
  type LedgerEntryType,
} from '@/domain/wallet'
import { newId, shortReference } from '@/lib/ids'
import { HOUR, startOfLondonDay, startOfLondonWeek } from '@/lib/time'

import type { Database, Transaction } from './client'
import {
  auctionStateFromRow,
  ledgerEntryFromRow,
  participantFromRow,
  stateColumns,
} from './mappers'

/**
 * PostgreSQL auction engine (production path).
 *
 * Every bid runs in one transaction that:
 *   1. replays the result if the idempotency key was already used,
 *   2. locks the auction row (SELECT … FOR UPDATE) — concurrent bids on the same auction queue here,
 *   3. reads the authoritative time from the database clock (never the browser, never app servers),
 *   4. locks the bidder's wallet row, then evaluates the bid with the SAME pure rules as the demo
 *      engine (src/domain/auction/bidding.ts),
 *   5. writes the debit ledger entries, the bid, the participant summary and the new auction state.
 * CHECK constraints (no negative balances, gap-free sequences, price = start + bids × increment)
 * and append-only triggers back these guarantees up at the database level.
 */

export interface PlaceBidInput {
  auctionId: string
  userId: string
  kind?: 'MANUAL' | 'AUTOBID'
  idempotencyKey?: string | null
  requestId?: string | null
}

export interface PlaceBidResult {
  accepted: true
  replayed: boolean
  bidId: string
  sequence: number
  priceMinor: number
  closeAt: number
  creditsSpent: number
  walletAvailable: number
  serverTime: number
}

export interface FinalizeResult {
  auctionId: string
  result: AuctionResult
  orderId: string | null
}

type Tx = Transaction | Database

const STAFF_ROLES = [
  'SUPPORT_AGENT',
  'OPERATIONS',
  'MERCHANDISER',
  'FINANCE',
  'ADMIN',
  'SUPER_ADMIN',
] as const

/** Authoritative time: the database clock at the moment of the call (after locks are held). */
async function databaseNow(tx: Tx): Promise<number> {
  const rows = await tx.execute<{ now_ms: string }>(
    sql`select floor(extract(epoch from clock_timestamp()) * 1000)::bigint as now_ms`,
  )
  return Number(rows[0]!.now_ms)
}

async function loadLedger(tx: Tx, userId: string): Promise<LedgerEntry[]> {
  const rows = await tx
    .select()
    .from(schema.bidLedgerEntries)
    .where(eq(schema.bidLedgerEntries.userId, userId))
    .orderBy(asc(schema.bidLedgerEntries.createdAt))
  return rows.map(ledgerEntryFromRow)
}

async function lockWallet(tx: Tx, userId: string) {
  await tx.insert(schema.bidWallets).values({ userId }).onConflictDoNothing()
  const [wallet] = await tx
    .select()
    .from(schema.bidWallets)
    .where(eq(schema.bidWallets.userId, userId))
    .for('update')
  return wallet!
}

interface LedgerWrite {
  type: LedgerEntryType
  bucket: CreditBucket
  credits: number
  description: string
  lotId?: string | null
  expiresAt?: number | null
  reference?: { type: string; id: string } | null
  idempotencyKey?: string | null
  at: number
}

/**
 * Appends ledger entries and moves the wallet projection in the same transaction. The wallet row
 * must already be locked by the caller. Balances can never go negative (CHECK constraints).
 */
async function writeLedger(
  tx: Tx,
  userId: string,
  wallet: { purchasedBalance: number; promotionalBalance: number; version: number },
  writes: LedgerWrite[],
) {
  let purchased = wallet.purchasedBalance
  let promotional = wallet.promotionalBalance
  for (const write of writes) {
    if (write.bucket === 'PURCHASED') purchased += write.credits
    else promotional += write.credits
    if (purchased < 0 || promotional < 0)
      throw new DomainError('INSUFFICIENT_CREDITS', 'You do not have enough bid credits.')
    const id = newId()
    await tx.insert(schema.bidLedgerEntries).values({
      id,
      userId,
      type: write.type,
      bucket: write.bucket,
      credits: write.credits,
      lotId: write.lotId ?? (write.bucket === 'PROMOTIONAL' && write.credits > 0 ? id : null),
      expiresAt: write.expiresAt ? new Date(write.expiresAt) : null,
      description: write.description,
      referenceType: write.reference?.type ?? null,
      referenceId: write.reference?.id ?? null,
      idempotencyKey: write.idempotencyKey ?? null,
      purchasedBalanceAfter: purchased,
      promotionalBalanceAfter: promotional,
      createdAt: new Date(write.at),
    })
  }
  await tx
    .update(schema.bidWallets)
    .set({
      purchasedBalance: purchased,
      promotionalBalance: promotional,
      version: wallet.version + 1,
      updatedAt: new Date(),
    })
    .where(eq(schema.bidWallets.userId, userId))
  wallet.purchasedBalance = purchased
  wallet.promotionalBalance = promotional
  wallet.version += 1
  return { purchased, promotional }
}

/** Writes EXPIRY entries for promotional lots that have lapsed, so balances stay truthful. */
async function expireLapsedCredits(
  tx: Tx,
  userId: string,
  wallet: { purchasedBalance: number; promotionalBalance: number; version: number },
  ledger: LedgerEntry[],
  now: number,
) {
  const expiries = collectExpiries(ledger, userId, now, newId)
  if (expiries.length === 0) return ledger
  await writeLedger(
    tx,
    userId,
    wallet,
    expiries.map((entry) => ({
      type: 'EXPIRY',
      bucket: 'PROMOTIONAL',
      credits: entry.credits,
      description: entry.description,
      lotId: entry.lotId,
      idempotencyKey: entry.idempotencyKey,
      at: now,
    })),
  )
  return [...ledger, ...expiries.map((entry) => ({ ...entry, createdAt: now }))]
}

async function loadLimits(tx: Tx, userId: string): Promise<ResponsibleUseLimits> {
  const [row] = await tx
    .select()
    .from(schema.responsibleUseLimits)
    .where(eq(schema.responsibleUseLimits.userId, userId))
  const pending = await tx
    .select()
    .from(schema.limitChangeRequests)
    .where(
      and(
        eq(schema.limitChangeRequests.userId, userId),
        isNull(schema.limitChangeRequests.appliedAt),
        isNull(schema.limitChangeRequests.supersededAt),
      ),
    )
  return {
    dailyBidLimit: row?.dailyBidLimit ?? null,
    weeklyBidLimit: row?.weeklyBidLimit ?? null,
    monthlyBidPurchaseBudgetMinor: row?.monthlyBidPurchaseBudgetMinor ?? null,
    coolOffUntil: row?.coolOffUntil ? row.coolOffUntil.getTime() : null,
    spendingNotifications: row?.spendingNotifications ?? true,
    bidUseNotifications: row?.bidUseNotifications ?? true,
    pendingChanges: pending.map((change) => ({
      field: change.field as 'dailyBidLimit' | 'weeklyBidLimit' | 'monthlyBidPurchaseBudgetMinor',
      value: change.value,
      requestedAt: change.requestedAt.getTime(),
      effectiveAt: change.effectiveAt.getTime(),
    })),
    updatedAt: row?.updatedAt.getTime() ?? 0,
  }
}

function usageFromLedger(ledger: LedgerEntry[], now: number) {
  const dayStart = startOfLondonDay(now)
  const weekStart = startOfLondonWeek(now)
  let today = 0
  let week = 0
  for (const entry of ledger) {
    if (entry.type !== 'AUCTION_BID') continue
    if (entry.createdAt >= dayStart) today += -entry.credits
    if (entry.createdAt >= weekStart) week += -entry.credits
  }
  return { bidCreditsToday: today, bidCreditsThisWeek: week, bidPackSpendThisMonthMinor: 0 }
}

export class PostgresAuctionEngine {
  constructor(private readonly db: Database) {}

  /** Places one bid. Throws DomainError with a customer-safe message when the bid is rejected. */
  async placeBid(input: PlaceBidInput): Promise<PlaceBidResult> {
    return this.db.transaction(async (tx) => {
      if (input.idempotencyKey) {
        const [existing] = await tx
          .select()
          .from(schema.bids)
          .where(
            and(
              eq(schema.bids.userId, input.userId),
              eq(schema.bids.idempotencyKey, input.idempotencyKey),
            ),
          )
        if (existing) {
          const wallet = await lockWallet(tx, input.userId)
          return {
            accepted: true as const,
            replayed: true,
            bidId: existing.id,
            sequence: existing.sequence,
            priceMinor: existing.priceAfterMinor,
            closeAt: existing.closeAtAfter.getTime(),
            creditsSpent: existing.creditsSpent,
            walletAvailable: wallet.purchasedBalance + wallet.promotionalBalance,
            serverTime: await databaseNow(tx),
          }
        }
      }

      const [auctionRow] = await tx
        .select()
        .from(schema.auctions)
        .where(eq(schema.auctions.id, input.auctionId))
        .for('update')
      if (!auctionRow) throw new DomainError('AUCTION_NOT_FOUND', 'We could not find that auction.')
      const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, input.userId))
      if (!user) throw new DomainError('UNAUTHENTICATED', 'Please sign in to bid.')
      const wallet = await lockWallet(tx, input.userId)
      const now = await databaseNow(tx)

      const roles = await tx
        .select({ role: schema.userRoles.role })
        .from(schema.userRoles)
        .where(eq(schema.userRoles.userId, input.userId))
      const [reward] = await tx
        .select()
        .from(schema.rewardAccounts)
        .where(eq(schema.rewardAccounts.userId, input.userId))
      const [participantRow] = await tx
        .select()
        .from(schema.auctionParticipants)
        .where(
          and(
            eq(schema.auctionParticipants.auctionId, input.auctionId),
            eq(schema.auctionParticipants.userId, input.userId),
          ),
        )

      let ledger = await loadLedger(tx, input.userId)
      ledger = await expireLapsedCredits(tx, input.userId, wallet, ledger, now)
      const limits = applyMaturedChanges(await loadLimits(tx, input.userId), now)
      const state = auctionStateFromRow(auctionRow)
      const cost = state.rules.bidCreditCost
      const summary = summarizeWallet(ledger, now)

      const isStaff = roles.some((row) => (STAFF_ROLES as readonly string[]).includes(row.role))
      const context: BidderContext = {
        bidsInAuction: participantRow?.bids ?? 0,
        isParticipant: !!participantRow,
        availableCredits: summary.available,
        eligibility: checkEligibility(
          state.rules.eligibility,
          {
            tier: reward?.tier ?? 'MEMBER',
            previousWins: user.previousWins,
            accountCreatedAt: user.createdAt.getTime(),
            market: user.market,
            ageVerifiedAtLeast: user.ageVerifiedAt ? 18 : 0,
          },
          now,
        ),
        limits: checkBidAllowance(limits, usageFromLedger(ledger, now), cost, now),
        restricted:
          user.status === 'RESTRICTED' || user.status === 'CLOSED'
            ? { message: 'Bidding is paused on your account. Please contact support.' }
            : isStaff
              ? { message: 'Esocity staff accounts cannot bid in auctions.' }
              : null,
      }
      const attempt = {
        bidderId: input.userId,
        bidderName: user.displayName,
        kind: input.kind ?? ('MANUAL' as const),
        at: now,
      }
      const decision = evaluateBid(state, attempt, context)
      if (!decision.accepted) throw new DomainError(decision.code, decision.message)

      const bidId = newId()
      const allocations = planDebit(ledger, decision.creditsCost, now)
      await writeLedger(
        tx,
        input.userId,
        wallet,
        allocations.map((allocation) => ({
          type: 'AUCTION_BID' as const,
          bucket: allocation.bucket,
          credits: -allocation.credits,
          lotId: allocation.lotId,
          description: `Bid · ${state.title}`,
          reference: { type: 'BID', id: bidId },
          at: now,
        })),
      )
      const purchasedSpent = allocations
        .filter((item) => item.bucket === 'PURCHASED')
        .reduce((total, item) => total + item.credits, 0)
      const promotionalSpent = decision.creditsCost - purchasedSpent

      await tx.insert(schema.bids).values({
        id: bidId,
        auctionId: input.auctionId,
        sequence: decision.sequence,
        userId: input.userId,
        kind: attempt.kind,
        priceAfterMinor: decision.priceAfterMinor,
        creditsSpent: decision.creditsCost,
        closeAtAfter: new Date(decision.closeAtAfter),
        idempotencyKey: input.idempotencyKey ?? null,
        requestId: input.requestId ?? null,
        placedAt: new Date(now),
      })
      await tx
        .insert(schema.auctionParticipants)
        .values({
          auctionId: input.auctionId,
          userId: input.userId,
          bids: 1,
          purchasedCreditsSpent: purchasedSpent,
          promotionalCreditsSpent: promotionalSpent,
          firstBidAt: new Date(now),
          lastBidAt: new Date(now),
        })
        .onConflictDoUpdate({
          target: [schema.auctionParticipants.auctionId, schema.auctionParticipants.userId],
          set: {
            bids: sql`${schema.auctionParticipants.bids} + 1`,
            purchasedCreditsSpent: sql`${schema.auctionParticipants.purchasedCreditsSpent} + ${purchasedSpent}`,
            promotionalCreditsSpent: sql`${schema.auctionParticipants.promotionalCreditsSpent} + ${promotionalSpent}`,
            lastBidAt: new Date(now),
          },
        })

      const next = applyAcceptedBid(state, attempt, decision)
      const updated = await tx
        .update(schema.auctions)
        .set(stateColumns(next))
        .where(
          and(eq(schema.auctions.id, input.auctionId), eq(schema.auctions.version, state.version)),
        )
        .returning({ id: schema.auctions.id })
      if (updated.length !== 1)
        throw new DomainError(
          'CONFLICT',
          'The auction changed while your bid was processed. Please try again.',
        )

      return {
        accepted: true as const,
        replayed: false,
        bidId,
        sequence: decision.sequence,
        priceMinor: decision.priceAfterMinor,
        closeAt: decision.closeAtAfter,
        creditsSpent: decision.creditsCost,
        walletAvailable: wallet.purchasedBalance + wallet.promotionalBalance,
        serverTime: now,
      }
    })
  }

  /** Grants credits (bid pack fulfilment, goodwill, refunds) as new ledger entries. Idempotent by key. */
  async grantCredits(input: {
    userId: string
    type: LedgerEntryType
    bucket: CreditBucket
    credits: number
    description: string
    idempotencyKey: string
    reference?: { type: string; id: string } | null
    validityMs?: number
  }) {
    if (!Number.isSafeInteger(input.credits) || input.credits <= 0)
      throw new DomainError('VALIDATION_FAILED', 'Credits must be a positive whole number.')
    return this.db.transaction(async (tx) => {
      const wallet = await lockWallet(tx, input.userId)
      const [existing] = await tx
        .select({ id: schema.bidLedgerEntries.id })
        .from(schema.bidLedgerEntries)
        .where(
          and(
            eq(schema.bidLedgerEntries.userId, input.userId),
            eq(schema.bidLedgerEntries.idempotencyKey, input.idempotencyKey),
          ),
        )
      if (existing)
        return { replayed: true, available: wallet.purchasedBalance + wallet.promotionalBalance }
      const now = await databaseNow(tx)
      await writeLedger(tx, input.userId, wallet, [
        {
          type: input.type,
          bucket: input.bucket,
          credits: input.credits,
          description: input.description,
          expiresAt:
            input.bucket === 'PROMOTIONAL'
              ? now + (input.validityMs ?? PROMOTIONAL_CREDIT_VALIDITY_MS)
              : null,
          reference: input.reference ?? null,
          idempotencyKey: input.idempotencyKey,
          at: now,
        },
      ])
      return { replayed: false, available: wallet.purchasedBalance + wallet.promotionalBalance }
    })
  }

  /** Operator/system lifecycle change with the state-machine guards, transition log and audit. */
  async transitionAuction(input: {
    auctionId: string
    to: AuctionStatus
    actor: { type: 'ADMIN' | 'SYSTEM'; id: string; name: string; role?: string }
    reason?: string
  }) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(schema.auctions)
        .where(eq(schema.auctions.id, input.auctionId))
        .for('update')
      if (!row) throw new DomainError('AUCTION_NOT_FOUND', 'Auction not found.')
      const now = await databaseNow(tx)
      const state = auctionStateFromRow(row)
      const next = transition(state, input.to, {
        actor: input.actor.type,
        now,
        reason: input.reason,
      })
      await tx
        .update(schema.auctions)
        .set(stateColumns({ ...next, updatedAt: now }))
        .where(eq(schema.auctions.id, input.auctionId))
      await tx.insert(schema.auctionTransitions).values({
        auctionId: input.auctionId,
        fromStatus: state.status,
        toStatus: input.to,
        actorType: input.actor.type,
        actorId: input.actor.id,
        reason: input.reason ?? null,
        occurredAt: new Date(now),
      })
      if (input.to === 'CANCELLED')
        await this.refundAllBids(
          tx,
          input.auctionId,
          `Refund · ${state.title} (auction cancelled)`,
          now,
        )
      await tx.insert(schema.auditEvents).values({
        actorType: input.actor.type,
        actorId: input.actor.id,
        actorName: input.actor.name,
        actorRole: input.actor.role ?? null,
        action: 'auction.transition',
        entityType: 'AUCTION',
        entityId: input.auctionId,
        severity: input.to === 'CANCELLED' ? 'WARNING' : input.to === 'PAUSED' ? 'NOTICE' : 'INFO',
        summary: `${state.title}: ${state.status} → ${input.to}${input.reason ? ` (${input.reason})` : ''}`,
        metadata: { from: state.status, to: input.to },
        occurredAt: new Date(now),
      })
      return next
    })
  }

  /** Refunds every participant's credits (both buckets), locking wallets in a stable order. */
  private async refundAllBids(tx: Tx, auctionId: string, description: string, now: number) {
    const participants = await tx
      .select()
      .from(schema.auctionParticipants)
      .where(eq(schema.auctionParticipants.auctionId, auctionId))
      .orderBy(asc(schema.auctionParticipants.userId))
    for (const participant of participants) {
      const wallet = await lockWallet(tx, participant.userId)
      const writes: LedgerWrite[] = []
      if (participant.purchasedCreditsSpent > 0) {
        writes.push({
          type: 'BID_REFUND',
          bucket: 'PURCHASED',
          credits: participant.purchasedCreditsSpent,
          description,
          reference: { type: 'AUCTION', id: auctionId },
          idempotencyKey: `refund:${auctionId}:purchased`,
          at: now,
        })
      }
      if (participant.promotionalCreditsSpent > 0) {
        writes.push({
          type: 'BID_REFUND',
          bucket: 'PROMOTIONAL',
          credits: participant.promotionalCreditsSpent,
          description,
          expiresAt: now + PROMOTIONAL_CREDIT_VALIDITY_MS,
          reference: { type: 'AUCTION', id: auctionId },
          idempotencyKey: `refund:${auctionId}:promotional`,
          at: now,
        })
      }
      if (writes.length > 0) await writeLedger(tx, participant.userId, wallet, writes)
    }
  }

  /**
   * Finalises one auction whose authoritative clock has expired. Safe to call concurrently from
   * several workers: the row lock plus the status check make it run exactly once.
   */
  async finalizeAuction(auctionId: string): Promise<FinalizeResult | null> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(schema.auctions)
        .where(eq(schema.auctions.id, auctionId))
        .for('update')
      if (!row || row.status !== 'LIVE') return null
      const now = await databaseNow(tx)
      if (now < row.closeAt.getTime()) return null
      const state: AuctionState = auctionStateFromRow(row)
      const closedAt = row.closeAt.getTime()
      const finalizing = transition(state, 'FINALIZING', { actor: 'SYSTEM', now })
      const participantRows = await tx
        .select()
        .from(schema.auctionParticipants)
        .where(eq(schema.auctionParticipants.auctionId, auctionId))
      const result = determineOutcome(
        finalizing,
        participantRows.map((participant) => participantFromRow(participant)),
        closedAt,
      )
      const completed = transition(finalizing, 'COMPLETED', { actor: 'SYSTEM', now })

      let orderId: string | null = null
      if (result.outcome === 'WON' && result.winnerId) {
        const [product] = await tx
          .select()
          .from(schema.products)
          .where(eq(schema.products.id, row.productId))
        orderId = newId()
        const total = result.finalPriceMinor
        await tx.insert(schema.orders).values({
          id: orderId,
          reference: shortReference('ESB', orderId),
          userId: result.winnerId,
          source: 'AUCTION_WIN',
          status: 'PENDING_PAYMENT',
          currency: row.currency,
          subtotalMinor: total,
          totalMinor: total,
          taxMinor: Math.round((total * 2_000) / 12_000),
          auctionId,
          paymentDueAt: new Date(closedAt + row.winnerPaymentWindowHours * HOUR),
          createdAt: new Date(now),
          updatedAt: new Date(now),
        })
        await tx.insert(schema.orderLines).values({
          orderId,
          productId: row.productId,
          productName: product?.name ?? row.title,
          brandName: '',
          shippingClass: product?.shippingClass ?? 'STANDARD',
          quantity: 1,
          unitPriceMinor: total,
          lineTotalMinor: total,
        })
        await tx.insert(schema.orderEvents).values({
          orderId,
          status: 'PENDING_PAYMENT',
          note: 'Auction won — awaiting payment',
          actor: 'Auction engine',
          occurredAt: new Date(now),
        })
        await tx
          .update(schema.users)
          .set({ previousWins: sql`${schema.users.previousWins} + 1` })
          .where(eq(schema.users.id, result.winnerId))
      }
      if (result.bidsRefunded)
        await this.refundAllBids(
          tx,
          auctionId,
          `Refund · ${row.title} (${result.outcome === 'RESERVE_NOT_MET' ? 'reserve not met' : 'not enough bidders'})`,
          now,
        )

      await tx.insert(schema.auctionResults).values({
        auctionId,
        outcome: result.outcome,
        winnerId: result.winnerId,
        finalPriceMinor: result.finalPriceMinor,
        currency: row.currency,
        bidCount: result.bidCount,
        uniqueBidders: result.uniqueBidders,
        winnerBidCount: result.winnerBidCount,
        bidsRefunded: result.bidsRefunded,
        closedAt: new Date(closedAt),
        orderId,
      })
      await tx.insert(schema.auctionTransitions).values([
        {
          auctionId,
          fromStatus: 'LIVE',
          toStatus: 'FINALIZING',
          actorType: 'SYSTEM',
          actorId: 'auction-engine',
          occurredAt: new Date(now),
        },
        {
          auctionId,
          fromStatus: 'FINALIZING',
          toStatus: 'COMPLETED',
          actorType: 'SYSTEM',
          actorId: 'auction-engine',
          occurredAt: new Date(now),
        },
      ])
      await tx
        .update(schema.auctions)
        .set(stateColumns({ ...completed, updatedAt: now }))
        .where(eq(schema.auctions.id, auctionId))
      await tx.insert(schema.auditEvents).values({
        actorType: 'SYSTEM',
        actorId: 'auction-engine',
        actorName: 'Esocity Bid engine',
        action: 'auction.finalized',
        entityType: 'AUCTION',
        entityId: auctionId,
        severity: 'INFO',
        summary: `${row.title}: ${result.outcome} at ${result.finalPriceMinor} minor units after ${result.bidCount} bids`,
        metadata: {
          outcome: result.outcome,
          bidCount: result.bidCount,
          uniqueBidders: result.uniqueBidders,
          bidsRefunded: result.bidsRefunded,
        },
        occurredAt: new Date(now),
      })
      return { auctionId, result, orderId }
    })
  }

  /** Finalises every auction whose clock has expired (cron/worker entry point). */
  async finalizeDueAuctions(limit = 50): Promise<FinalizeResult[]> {
    const due = await this.db
      .select({ id: schema.auctions.id })
      .from(schema.auctions)
      .where(
        and(
          eq(schema.auctions.status, 'LIVE'),
          lte(schema.auctions.closeAt, sql`clock_timestamp()`),
        ),
      )
      .orderBy(asc(schema.auctions.closeAt))
      .limit(limit)
    const results: FinalizeResult[] = []
    for (const { id } of due) {
      const result = await this.finalizeAuction(id)
      if (result) results.push(result)
    }
    return results
  }

  /** Starts scheduled auctions whose start time has arrived (cron/worker entry point). */
  async startDueAuctions(limit = 50): Promise<string[]> {
    const due = await this.db
      .select({ id: schema.auctions.id })
      .from(schema.auctions)
      .where(
        and(
          eq(schema.auctions.status, 'SCHEDULED'),
          lte(schema.auctions.startsAt, sql`clock_timestamp()`),
        ),
      )
      .orderBy(asc(schema.auctions.startsAt))
      .limit(limit)
    const started: string[] = []
    for (const { id } of due) {
      try {
        await this.transitionAuction({
          auctionId: id,
          to: 'LIVE',
          actor: { type: 'SYSTEM', id: 'auction-engine', name: 'Esocity Bid engine' },
        })
        started.push(id)
      } catch (error) {
        // Another worker started it first; the state machine rejects the duplicate transition.
        if (!(error instanceof DomainError)) throw error
      }
    }
    return started
  }

  /** Current wallet summary computed from the ledger (the source of truth). */
  async walletSummary(userId: string) {
    const ledger = await loadLedger(this.db, userId)
    const now = await databaseNow(this.db)
    return summarizeWallet(ledger, now)
  }

  /** Participants of several auctions (used by reconciliation jobs and tests). */
  async participants(auctionIds: string[]) {
    if (auctionIds.length === 0) return []
    return this.db
      .select()
      .from(schema.auctionParticipants)
      .where(inArray(schema.auctionParticipants.auctionId, auctionIds))
  }
}
