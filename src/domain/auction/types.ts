import type { MarketCode } from '@/lib/config/market'
import type { RewardTier } from '@/domain/rewards'

export const AUCTION_STATUSES = [
  'DRAFT',
  'SCHEDULED',
  'LIVE',
  'PAUSED',
  'FINALIZING',
  'COMPLETED',
  'CANCELLED',
] as const

export type AuctionStatus = (typeof AUCTION_STATUSES)[number]

/** How bid credit recovery is applied when a losing bidder buys the item at Buy Now price. */
export type RecoveryMode = 'RETURN_BIDS' | 'PRICE_CREDIT'

export interface EligibilityRules {
  /** Minimum Esocity Rewards tier required to bid. */
  minimumTier: RewardTier | null
  /** Beginner auctions: only members with at most this many previous wins may bid. */
  maxPreviousWins: number | null
  minimumAccountAgeDays: number | null
  markets: MarketCode[]
  minimumAge: number
}

/**
 * Configurable auction rules. Different formats (penny auctions, beginner auctions, reserve
 * auctions, hard-stop auctions) are expressed purely through configuration.
 */
export interface AuctionRules {
  /** Opening price in minor units. */
  startingPriceMinor: number
  /** Amount each accepted bid adds to the auction price, in minor units. */
  bidIncrementMinor: number
  /** Bid credits consumed per bid. */
  bidCreditCost: number
  /** Initial countdown once the auction goes live, in seconds. */
  timerSeconds: number
  /** Each accepted bid guarantees at least this many seconds remain on the clock. */
  timerExtensionSeconds: number
  minimumParticipants: number
  maximumParticipants: number | null
  /** Optional hard stop, in seconds after the auction starts; extensions never pass it. */
  hardStopAfterSeconds: number | null
  buyNowEnabled: boolean
  /** Overrides the product Buy Now price for this auction. */
  buyNowPriceMinor: number | null
  bidCreditRecoveryEnabled: boolean
  recoveryMode: RecoveryMode
  recoveryWindowHours: number
  /** Whether promotional (free) bids count towards recovery. */
  recoverPromotionalBids: boolean
  /** Optional reserve price; if not met at close, no sale occurs and bids are refunded. */
  reservePriceMinor: number | null
  winnerPaymentWindowHours: number
  perUserBidLimit: number | null
  autoBidEnabled: boolean
  /** Customer protection: the current leader cannot outbid themselves. */
  preventSelfOutbid: boolean
  eligibility: EligibilityRules
}

export type BidKind = 'MANUAL' | 'AUTOBID' | 'SIMULATED'

export interface BidEvent {
  id: string
  auctionId: string
  /** Monotonic, gap-free sequence within the auction. */
  sequence: number
  bidderId: string
  bidderName: string
  kind: BidKind
  simulated: boolean
  priceAfterMinor: number
  creditsSpent: number
  placedAt: number
  closeAtAfter: number
}

export type AuctionOutcome = 'WON' | 'NO_BIDS' | 'RESERVE_NOT_MET' | 'MIN_PARTICIPANTS_NOT_MET'

export interface AuctionResult {
  outcome: AuctionOutcome
  winnerId: string | null
  winnerName: string | null
  winnerSimulated: boolean
  finalPriceMinor: number
  closedAt: number
  bidCount: number
  uniqueBidders: number
  winnerBidCount: number
  /** Whether bid credits were refunded to bidders (no-sale outcomes and cancellations). */
  bidsRefunded: boolean
}

/** Authoritative, persisted auction state. */
export interface AuctionState {
  id: string
  productId: string
  title: string
  status: AuctionStatus
  rules: AuctionRules
  startsAt: number
  /** Authoritative close time. Clients derive countdowns from this and server time only. */
  closeAt: number
  hardCloseAt: number | null
  pausedAt: number | null
  remainingAtPauseMs: number | null
  priceMinor: number
  bidCount: number
  lastBidAt: number | null
  leaderId: string | null
  leaderName: string | null
  leaderSimulated: boolean
  uniqueBidders: number
  /** Incremented on every state change (optimistic concurrency and cache validation). */
  version: number
  result: AuctionResult | null
  cancelReason: string | null
  featured: boolean
  createdAt: number
  updatedAt: number
}

export interface Participant {
  bidderId: string
  bidderName: string
  simulated: boolean
  bids: number
  purchasedCreditsSpent: number
  promotionalCreditsSpent: number
  firstBidAt: number
  lastBidAt: number
}
