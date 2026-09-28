import type * as schema from '@db/schema'
import type { AuctionRules, AuctionState, Participant } from '@/domain/auction/types'
import type { LedgerEntry, LedgerReferenceType } from '@/domain/wallet'

/** Row ↔ domain mapping for the PostgreSQL engine. Domain objects use epoch milliseconds. */

type AuctionRow = typeof schema.auctions.$inferSelect
type ParticipantRow = typeof schema.auctionParticipants.$inferSelect
type LedgerRow = typeof schema.bidLedgerEntries.$inferSelect

const ms = (value: Date | null): number | null => (value ? value.getTime() : null)

export function rulesFromRow(row: AuctionRow): AuctionRules {
  return {
    startingPriceMinor: row.startingPriceMinor,
    bidIncrementMinor: row.bidIncrementMinor,
    bidCreditCost: row.bidCreditCost,
    timerSeconds: row.timerSeconds,
    timerExtensionSeconds: row.timerExtensionSeconds,
    minimumParticipants: row.minimumParticipants,
    maximumParticipants: row.maximumParticipants,
    hardStopAfterSeconds: row.hardStopAfterSeconds,
    buyNowEnabled: row.buyNowEnabled,
    buyNowPriceMinor: row.buyNowPriceMinor,
    bidCreditRecoveryEnabled: row.bidCreditRecoveryEnabled,
    recoveryMode: row.recoveryMode,
    recoveryWindowHours: row.recoveryWindowHours,
    recoverPromotionalBids: row.recoverPromotionalBids,
    reservePriceMinor: row.reservePriceMinor,
    winnerPaymentWindowHours: row.winnerPaymentWindowHours,
    perUserBidLimit: row.perUserBidLimit,
    autoBidEnabled: row.autoBidEnabled,
    preventSelfOutbid: row.preventSelfOutbid,
    eligibility: row.eligibility,
  }
}

export function rulesToColumns(rules: AuctionRules) {
  return {
    startingPriceMinor: rules.startingPriceMinor,
    bidIncrementMinor: rules.bidIncrementMinor,
    bidCreditCost: rules.bidCreditCost,
    timerSeconds: rules.timerSeconds,
    timerExtensionSeconds: rules.timerExtensionSeconds,
    minimumParticipants: rules.minimumParticipants,
    maximumParticipants: rules.maximumParticipants,
    hardStopAfterSeconds: rules.hardStopAfterSeconds,
    buyNowEnabled: rules.buyNowEnabled,
    buyNowPriceMinor: rules.buyNowPriceMinor,
    bidCreditRecoveryEnabled: rules.bidCreditRecoveryEnabled,
    recoveryMode: rules.recoveryMode,
    recoveryWindowHours: rules.recoveryWindowHours,
    recoverPromotionalBids: rules.recoverPromotionalBids,
    reservePriceMinor: rules.reservePriceMinor,
    winnerPaymentWindowHours: rules.winnerPaymentWindowHours,
    perUserBidLimit: rules.perUserBidLimit,
    autoBidEnabled: rules.autoBidEnabled,
    preventSelfOutbid: rules.preventSelfOutbid,
    eligibility: rules.eligibility,
  }
}

export function auctionStateFromRow(row: AuctionRow): AuctionState {
  return {
    id: row.id,
    productId: row.productId,
    title: row.title,
    status: row.status,
    rules: rulesFromRow(row),
    startsAt: row.startsAt.getTime(),
    closeAt: row.closeAt.getTime(),
    hardCloseAt: ms(row.hardCloseAt),
    pausedAt: ms(row.pausedAt),
    remainingAtPauseMs: row.remainingAtPauseMs,
    priceMinor: row.priceMinor,
    bidCount: row.bidCount,
    lastBidAt: ms(row.lastBidAt),
    leaderId: row.leaderId,
    leaderName: row.leaderName,
    leaderSimulated: false,
    uniqueBidders: row.uniqueBidders,
    version: row.version,
    result: null,
    cancelReason: row.cancelReason,
    featured: row.featured,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }
}

/** Columns that change when the engine moves an auction to a new state. */
export function stateColumns(state: AuctionState) {
  return {
    status: state.status,
    startsAt: new Date(state.startsAt),
    closeAt: new Date(state.closeAt),
    hardCloseAt: state.hardCloseAt === null ? null : new Date(state.hardCloseAt),
    pausedAt: state.pausedAt === null ? null : new Date(state.pausedAt),
    remainingAtPauseMs: state.remainingAtPauseMs,
    priceMinor: state.priceMinor,
    bidCount: state.bidCount,
    uniqueBidders: state.uniqueBidders,
    lastBidAt: state.lastBidAt === null ? null : new Date(state.lastBidAt),
    leaderId: state.leaderId,
    leaderName: state.leaderName,
    version: state.version,
    cancelReason: state.cancelReason,
    updatedAt: new Date(state.updatedAt),
  }
}

export function participantFromRow(row: ParticipantRow, name = 'Member'): Participant {
  return {
    bidderId: row.userId,
    bidderName: name,
    simulated: false,
    bids: row.bids,
    purchasedCreditsSpent: row.purchasedCreditsSpent,
    promotionalCreditsSpent: row.promotionalCreditsSpent,
    firstBidAt: row.firstBidAt.getTime(),
    lastBidAt: row.lastBidAt.getTime(),
  }
}

export function ledgerEntryFromRow(row: LedgerRow): LedgerEntry {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    bucket: row.bucket,
    credits: row.credits,
    createdAt: row.createdAt.getTime(),
    expiresAt: ms(row.expiresAt),
    lotId: row.lotId,
    description: row.description,
    reference:
      row.referenceType && row.referenceId
        ? { type: row.referenceType as LedgerReferenceType, id: row.referenceId }
        : null,
    idempotencyKey: row.idempotencyKey,
  }
}
