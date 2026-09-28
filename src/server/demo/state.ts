import type { AutoBidRule } from '@/domain/auction/autobid'
import type { AuctionState, BidEvent, Participant } from '@/domain/auction/types'
import type { Brand, Category, Product, PurchaseOrder, Supplier } from '@/domain/catalog'
import type { KycStatus } from '@/domain/compliance'
import type { FlashDrop } from '@/domain/drops'
import type { FraudCase, RiskClass } from '@/domain/fraud'
import type { InventoryEvent } from '@/domain/inventory'
import type { Notification, NotificationPreferences } from '@/domain/notifications'
import type { Address, Order } from '@/domain/orders'
import type { Promotion } from '@/domain/promotions'
import type { ResponsibleUseLimits } from '@/domain/responsible-use'
import type { RewardEntry, RewardTier } from '@/domain/rewards'
import type { SupportTicket } from '@/domain/support'
import type { BidPackage, LedgerEntry } from '@/domain/wallet'
import type { FlagSet } from '@/lib/config/flags'
import type { MemoryAuditLog } from '@/server/infra/audit'

/** Parameters that drive simulated competing bidders for one demo auction. */
export interface SimParams {
  heat: number
  targetBids: number
  openingMeanGapMs: number
  /** 0–1: how early in the extension window simulated bidders tend to respond. */
  closingPace: number
  pool: string[]
  /** After this time simulated bidders stop, guaranteeing the auction completes. */
  giveUpAt: number
}

export interface AuctionRecord {
  state: AuctionState
  source: 'SERIES' | 'ADMIN'
  seriesKey: string | null
  cycle: number | null
  label: string | null
  sim: SimParams | null
  participants: Map<string, Participant>
  /** Most recent bids (all bidders), oldest first, capped. */
  recentBids: BidEvent[]
  /** Immutable log of real member bids. */
  memberBids: BidEvent[]
  watchers: Set<string>
  watchingBase: number
  notified: Set<string>
  buyNowConversions: number
  buyNowRevenueMinor: number
  recoveredValueMinor: number
  purchasedCreditsUsed: number
  promotionalCreditsUsed: number
  createdBy: string
  description: string | null
}

export type WatchTargetType = 'AUCTION' | 'PRODUCT' | 'DROP'

export interface WatchItem {
  type: WatchTargetType
  targetId: string
  addedAt: number
  priceAtAddMinor: number | null
  notify: boolean
}

export interface CartItem {
  id: string
  productId: string
  quantity: number
  addedAt: number
}

export interface DemoAccount {
  id: string
  kind: 'SESSION'
  createdAt: number
  lastSeenAt: number
  displayName: string
  handle: string
  profile: {
    firstName: string
    lastName: string
    email: string
    phone: string
    marketingOptIn: boolean
    ageVerified: boolean
  }
  market: 'UK'
  addresses: Address[]
  preferences: {
    theme: 'system' | 'light' | 'dark'
    notifications: NotificationPreferences
    interests: string[]
    currency: 'GBP'
    region: 'UK'
  }
  limits: ResponsibleUseLimits
  ledger: LedgerEntry[]
  rewards: RewardEntry[]
  watchlist: WatchItem[]
  cart: CartItem[]
  notifications: Notification[]
  orderIds: string[]
  viewedCategories: Set<string>
  viewedProducts: string[]
  bidTimestamps: number[]
  recoveredAuctions: Set<string>
  previousWins: number
  bidPackSpend: { at: number; amountMinor: number }[]
  promoRedemptions: Map<string, number>
  ticketIds: string[]
  weeklyStreak: number
  restricted: { reason: string } | null
  /** Terms acceptance and identity status (compliance hooks, see src/domain/compliance.ts). */
  compliance: {
    termsAcceptedVersion: string | null
    termsAcceptedAt: number | null
    kycStatus: KycStatus
  }
  /** De-duplication keys for one-off notifications (e.g. drop started). */
  notificationKeys: Set<string>
  /** Seeded participation in auctions that pre-date the live demo world (display only). */
  archivedBidding: ArchivedBidding[]
}

export interface ArchivedBidding {
  auctionId: string
  title: string
  bids: number
  lastBidAt: number
  outcome: 'WON' | 'LOST' | 'REFUNDED'
  status: 'COMPLETED' | 'CANCELLED'
}

export interface PaymentRecord {
  id: string
  providerReference: string
  userId: string
  customerName: string
  kind: 'ORDER' | 'BID_PACK'
  orderId: string | null
  bidPackOrderId: string | null
  amountMinor: number
  currency: 'GBP'
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
  provider: 'demo' | 'stripe'
  methodLabel: string
  refundedMinor: number
  createdAt: number
  events: { status: string; at: number; note: string | null }[]
  simulated: boolean
}

export interface RefundRecord {
  id: string
  paymentId: string
  orderId: string | null
  amountMinor: number
  reason: string
  status: 'SUCCEEDED' | 'FAILED'
  providerReference: string
  createdAt: number
  actor: string
}

export interface BidPackOrder {
  id: string
  reference: string
  userId: string
  customerName: string
  packageId: string
  packageName: string
  credits: number
  bonusCredits: number
  promoBonusCredits: number
  priceMinor: number
  discountMinor: number
  totalMinor: number
  promotionCode: string | null
  paymentId: string
  status: 'PAID' | 'FAILED'
  createdAt: number
  simulated: boolean
}

export interface CustomerSummary {
  id: string
  name: string
  email: string
  city: string
  joinedAt: number
  lastActiveAt: number
  tier: RewardTier
  lifetimeSpendMinor: number
  orders: number
  bidsUsed: number
  bidPackSpendMinor: number
  wins: number
  status: 'ACTIVE' | 'UNDER_REVIEW' | 'RESTRICTED'
  riskClass: RiskClass
  simulated: boolean
}

export interface DailyMetric {
  day: number
  gmvMinor: number
  auctionRevenueMinor: number
  buyNowRevenueMinor: number
  marketplaceRevenueMinor: number
  dropRevenueMinor: number
  bidPackRevenueMinor: number
  refundsMinor: number
  orders: number
  newUsers: number
  activeUsers: number
  returningUsers: number
  auctionsCompleted: number
  bidsPlaced: number
  uniqueBidders: number
  sessions: number
  checkoutStarts: number
  checkoutCompletions: number
  bidPackViews: number
  bidPackPurchases: number
  dropViews: number
  dropPurchases: number
  buyNowViews: number
  buyNowPurchases: number
  watchlistAdds: number
  watchlistToBid: number
  supportTickets: number
}

export interface DropInstance {
  drop: FlashDrop
  seriesKey: string
  window: number
  /** 0.55–1.4: simulated demand relative to stock. */
  demand: number
  realSold: number
  byUser: Map<string, number>
}

export interface DemoState {
  clock: () => number
  bootAt: number
  anchorDay: number
  categories: Category[]
  brands: Brand[]
  suppliers: Supplier[]
  products: Map<string, Product>
  productsBySlug: Map<string, Product>
  inventory: Map<string, InventoryEvent[]>
  purchaseOrders: PurchaseOrder[]
  auctions: Map<string, AuctionRecord>
  seriesCursor: Map<string, number>
  autobids: Map<string, AutoBidRule>
  drops: Map<string, DropInstance>
  packages: BidPackage[]
  promotions: Map<string, Promotion>
  accounts: Map<string, DemoAccount>
  customers: CustomerSummary[]
  orders: Map<string, Order>
  payments: PaymentRecord[]
  refunds: RefundRecord[]
  bidPackOrders: BidPackOrder[]
  tickets: SupportTicket[]
  fraudCases: FraudCase[]
  audit: MemoryAuditLog
  daily: DailyMetric[]
  runtimeFlags: Partial<FlagSet>
  autobidKillSwitch: boolean
  /** Orders whose lifecycle advances automatically (demo fulfilment, payment windows). */
  progressingOrders: Set<string>
  lastSyncAt: number
  sequence: { order: number; ticket: number; bidPack: number }
}

export const RECENT_BIDS_CAP = 40
export const MAX_SESSION_ACCOUNTS = 5_000
