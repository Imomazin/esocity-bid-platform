import type { AutoBidStatus } from '@/domain/auction/autobid'
import type { RecoveryQuote } from '@/domain/auction/recovery'
import type {
  AuctionOutcome,
  AuctionRules,
  AuctionStatus,
  BidKind,
  RecoveryMode,
} from '@/domain/auction/types'
import type { ArtKey, ArtPalette, ProductCondition, ShippingClass } from '@/domain/catalog'
import type { DropStatus } from '@/domain/drops'
import type { StockLevel } from '@/domain/inventory'
import type { Notification, NotificationPreferences } from '@/domain/notifications'
import type { Address, Order } from '@/domain/orders'
import type {
  LimitDecision,
  PendingLimitChange,
  ResponsibleUseLimits,
} from '@/domain/responsible-use'
import type {
  AchievementProgress,
  RedemptionOption,
  RewardEntry,
  RewardTier,
  TierProgress,
} from '@/domain/rewards'
import type { SupportTicket } from '@/domain/support'
import type { BidPackage, CreditBucket, LedgerEntryType, WalletSummary } from '@/domain/wallet'

/**
 * View models returned by the backend to pages and API routes. They are serialisable and
 * customer-safe: admin-only data (e.g. cost prices) never appears in customer views.
 */

export interface ProductCard {
  id: string
  slug: string
  name: string
  brandName: string
  brandSlug: string
  categorySlug: string
  categoryName: string
  subcategory: string
  referencePriceMinor: number
  buyNowPriceMinor: number
  savingsBps: number
  art: ArtKey
  palette: ArtPalette
  colourway: string
  stockLevel: StockLevel
  available: number
  rating: number
  reviewCount: number
  condition: ProductCondition
  shippingClass: ShippingClass
  tags: string[]
  popularity: number
  createdAt: number
  liveAuction: {
    id: string
    status: AuctionStatus
    priceMinor: number
    closeAt: number
    startsAt: number
  } | null
  watched: boolean
}

export interface ProductDetail extends ProductCard {
  description: string
  highlights: string[]
  attributes: Record<string, string>
  sku: string
  images: { alt: string; art: ArtKey; variant: number; url?: string }[]
  related: ProductCard[]
  relatedAuctions: AuctionCard[]
  activeAuction: AuctionCard | null
  drop: DropView | null
  returnsWindowDays: number
  deliveryNote: string
}

export interface AuctionLeader {
  name: string
  isViewer: boolean
  simulated: boolean
}

export interface AuctionResultView {
  outcome: AuctionOutcome
  winnerName: string | null
  winnerIsViewer: boolean
  winnerSimulated: boolean
  finalPriceMinor: number
  closedAt: number
  winnerBidCount: number
  bidCount: number
  uniqueBidders: number
  bidsRefunded: boolean
}

/** Live-updatable subset of an auction, used by polling/real-time updates. */
export interface AuctionSnapshot {
  id: string
  status: AuctionStatus
  priceMinor: number
  startsAt: number
  closeAt: number
  hardCloseAt: number | null
  remainingAtPauseMs: number | null
  bidCount: number
  uniqueBidders: number
  leader: AuctionLeader | null
  lastBidAt: number | null
  version: number
  result: AuctionResultView | null
}

export interface AuctionRulesSummary {
  bidIncrementMinor: number
  bidCreditCost: number
  timerExtensionSeconds: number
  buyNowEnabled: boolean
  buyNowPriceMinor: number
  recoveryEnabled: boolean
  recoveryMode: RecoveryMode
  recoveryWindowHours: number
  hardStop: boolean
  minimumTier: RewardTier | null
  maxPreviousWins: number | null
  reserve: boolean
  minimumParticipants: number
  autoBidEnabled: boolean
  perUserBidLimit: number | null
}

export interface AuctionCard extends AuctionSnapshot {
  title: string
  label: string | null
  featured: boolean
  product: ProductCard
  rules: AuctionRulesSummary
  watchingCount: number
  watched: boolean
  viewerParticipating: boolean
}

export interface BidView {
  id: string
  sequence: number
  bidderName: string
  isViewer: boolean
  simulated: boolean
  kind: BidKind
  priceAfterMinor: number
  placedAt: number
}

export interface AutoBidView {
  id: string
  auctionId: string
  auctionTitle: string
  maxBids: number
  maxPriceMinor: number | null
  bidsPlaced: number
  remaining: number
  status: AutoBidStatus
  stopReason: string | null
  createdAt: number
}

export interface ViewerAuctionState {
  walletAvailable: number
  bidsPlaced: number
  purchasedCreditsSpent: number
  promotionalCreditsSpent: number
  isLeader: boolean
  eligibility: { eligible: boolean; reasons: string[] }
  limits: LimitDecision
  autobid: AutoBidView | null
  recovery: RecoveryQuote | null
  winOrderId: string | null
  autoBidAvailable: boolean
}

export interface AuctionDetail extends AuctionCard {
  fullRules: AuctionRules
  rulesText: string[]
  recentBids: BidView[]
  viewer: ViewerAuctionState | null
  description: string
  highlights: string[]
  attributes: Record<string, string>
  similar: AuctionCard[]
  serverTime: number
  simulatedBidders: boolean
}

export interface LiveAuctionPayload {
  serverTime: number
  snapshot: AuctionSnapshot
  recentBids: BidView[]
  viewer: ViewerAuctionState | null
}

export interface BidResultView {
  accepted: true
  sequence: number
  priceMinor: number
  closeAt: number
  creditsSpent: number
  walletAvailable: number
  serverTime: number
  snapshot: AuctionSnapshot
}

export interface WalletEntryView {
  id: string
  type: LedgerEntryType
  bucket: CreditBucket
  label: string
  description: string
  credits: number
  count: number
  createdAt: number
  expiresAt: number | null
  balanceAfter: number
}

export interface BidPackageView extends BidPackage {
  totalCredits: number
  pricePerCreditMinor: number
  bestValue: boolean
}

export interface WalletView {
  summary: WalletSummary
  entries: WalletEntryView[]
  packages: BidPackageView[]
  usage: { bidCreditsToday: number; bidCreditsThisWeek: number; bidPackSpendThisMonthMinor: number }
  limits: ResponsibleUseLimits
  autobids: AutoBidView[]
}

export interface DropView {
  id: string
  slug: string
  title: string
  subtitle: string
  product: ProductCard
  dropPriceMinor: number
  referencePriceMinor: number
  savingsBps: number
  stockTotal: number
  stockRemaining: number
  sold: number
  perCustomerLimit: number
  startsAt: number
  endsAt: number
  status: DropStatus
  eligibility: { eligible: boolean; reason: string | null }
  minimumTier: RewardTier | null
  membersOnly: boolean
  viewerPurchased: number
  watched: boolean
}

export interface CartLineView {
  id: string
  product: ProductCard
  quantity: number
  unitPriceMinor: number
  lineTotalMinor: number
  available: number
}

export interface CartView {
  lines: CartLineView[]
  itemCount: number
  subtotalMinor: number
}

export type CheckoutMode =
  | { kind: 'CART' }
  | { kind: 'ORDER'; orderId: string }
  | { kind: 'AUCTION_BUY_NOW'; auctionId: string }
  | { kind: 'DROP'; dropId: string; quantity: number }

export interface CheckoutLineView {
  product: ProductCard
  quantity: number
  unitPriceMinor: number
  lineTotalMinor: number
  note: string | null
}

export interface CheckoutPreview {
  mode: CheckoutMode
  title: string
  lines: CheckoutLineView[]
  pricing: {
    subtotalMinor: number
    discountMinor: number
    recoveryCreditMinor: number
    shippingMinor: number
    bulkySurchargeMinor: number
    freeShippingApplied: boolean
    taxMinor: number
    taxLabel: string
    taxInclusive: boolean
    totalMinor: number
    requiresShipping: boolean
  }
  promotion: { code: string; valid: boolean; message: string } | null
  promoAllowed: boolean
  recovery: RecoveryQuote | null
  shippingMethods: {
    id: string
    label: string
    description: string
    priceMinor: number
    freeOverMinor: number | null
  }[]
  selectedShippingMethod: string
  addresses: Address[]
  paymentMethods: { id: string; label: string; description: string }[]
  paymentDueAt: number | null
  warnings: string[]
}

export interface OrderView extends Order {
  lineArt: Record<string, { art: ArtKey; palette: ArtPalette }>
}

export interface RewardsView {
  balance: number
  progress: TierProgress
  tiers: {
    tier: RewardTier
    label: string
    threshold: number
    multiplierBps: number
    perks: string[]
  }[]
  entries: RewardEntry[]
  achievements: AchievementProgress[]
  redemptions: (RedemptionOption & { affordable: boolean })[]
  weeklyStreak: number
  referral: { code: string; enabled: boolean }
}

export interface WatchlistView {
  auctions: AuctionCard[]
  products: (ProductCard & { priceAtAddMinor: number | null; priceChangeMinor: number })[]
  drops: DropView[]
  startingSoon: AuctionCard[]
  endingSoon: AuctionCard[]
  priceDrops: (ProductCard & { priceChangeMinor: number })[]
}

export interface LimitsView {
  limits: ResponsibleUseLimits
  pending: PendingLimitChange[]
  usage: WalletView['usage']
}

export interface AccountOverview {
  profile: {
    displayName: string
    firstName: string
    lastName: string
    email: string
    phone: string
    handle: string
    memberSince: number
    marketingOptIn: boolean
  }
  addresses: Address[]
  preferences: {
    theme: 'system' | 'light' | 'dark'
    interests: string[]
    currency: string
    region: string
  }
  notificationPreferences: NotificationPreferences
  limits: LimitsView
  wallet: WalletSummary
  rewards: { balance: number; tier: RewardTier; progress: TierProgress }
  biddingActivity: {
    auctionId: string
    title: string
    status: AuctionStatus
    bids: number
    creditsSpent: number
    lastBidAt: number
    outcome: 'LEADING' | 'OUTBID' | 'WON' | 'LOST' | 'REFUNDED' | 'LIVE'
    /** Past auction from seeded history; it no longer has a detail page. */
    archived: boolean
  }[]
  recentOrders: Order[]
  stats: { orders: number; wins: number; bidsPlaced: number; watchlist: number }
}

export interface NotificationsView {
  items: Notification[]
  unread: number
}

export interface ViewerSummary {
  userId: string
  displayName: string
  handle: string
  walletAvailable: number
  unreadNotifications: number
  cartCount: number
  tier: RewardTier
}

export type { SupportTicket }
