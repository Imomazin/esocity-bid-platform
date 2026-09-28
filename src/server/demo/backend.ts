import { validateAutoBidConfig, type AutoBidRule } from '@/domain/auction/autobid'
import { describeRules, type AuctionRulesPatch } from '@/domain/auction/rules'
import type { AuctionStatus } from '@/domain/auction/types'
import type { Product } from '@/domain/catalog'
import { DomainError } from '@/domain/errors'
import type { RiskAction } from '@/domain/fraud'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  MANDATORY_NOTIFICATION_TYPES,
  type NotificationPreferences,
} from '@/domain/notifications'
import type { OrderStatus } from '@/domain/orders'
import { evaluatePromotion, type Promotion } from '@/domain/promotions'
import {
  applyMaturedChanges,
  requestLimitChange,
  type LimitChangeRequest,
} from '@/domain/responsible-use'
import {
  evaluateAchievements,
  qualifyingPoints,
  REDEMPTION_OPTIONS,
  rewardBalance,
  TIER_DEFINITIONS,
  tierForPoints,
  tierProgress,
} from '@/domain/rewards'
import {
  defaultPriority,
  TICKET_CATEGORIES,
  type TicketCategory,
  type TicketStatus,
} from '@/domain/support'
import { summarizeWallet } from '@/domain/wallet'
import { getMarket } from '@/lib/config/market'
import { newId } from '@/lib/ids'
import { money, savingsBasisPoints } from '@/lib/money'
import { DAY, HOUR } from '@/lib/time'
import type { AuditQuery } from '@/server/infra/audit'
import { MemoryAuditLog } from '@/server/infra/audit'
import type { LockProvider } from '@/server/infra/locks'
import type { PaymentMethodOption } from '@/server/providers/payments'
import {
  HeuristicRecommender,
  type RecommendationProvider,
} from '@/server/providers/recommendations'
import {
  LocalSearchProvider,
  matchBrands,
  matchCategories,
  productDocument,
  type SearchProvider,
} from '@/server/providers/search'
import type {
  AccountOverview,
  AuctionCard,
  AuctionDetail,
  AutoBidView,
  BidResultView,
  CartView,
  CheckoutMode,
  CheckoutPreview,
  DropView,
  LimitsView,
  LiveAuctionPayload,
  NotificationsView,
  OrderView,
  ProductCard,
  ProductDetail,
  RewardsView,
  ViewerSummary,
  WalletView,
  WatchlistView,
} from '@/server/views'

import { createSessionAccount, removeSessionAccount } from './accounts'
import * as admin from './admin'
import { placeMemberBid } from './bidding'
import {
  findPromotion,
  placeOrder as placeOrderFlow,
  previewCheckout as previewCheckoutFlow,
  purchaseBidPackage as purchaseBidPackageFlow,
  redeemReward,
} from './commerce'
import {
  accountTier,
  audit,
  availableStock,
  memberActor,
  track,
  type Ctx,
  type DemoDeps,
} from './context'
import { BID_PACKAGES, buildPromotions, FAQS } from './data/commerce'
import { BRANDS, buildProducts, CATEGORIES, initialStock, SUPPLIERS } from './data/catalog'
import {
  generateCustomers,
  generateFraudCases,
  generateHistory,
  generateTickets,
  seedAudit,
  seedInventory,
  seedPurchaseOrders,
} from './history'
import type { AuctionRecord, DemoAccount, DemoState, WatchTargetType } from './state'
import { achievementStats } from './orders'
import {
  auctionCard,
  auctionSnapshot,
  autoBidView,
  bidView,
  categoryName,
  dropView,
  liveAuctionFor,
  orderView,
  packageViews,
  productCard,
  recentBidViews,
  viewerAuctionState,
  walletView,
} from './views'
import { advanceAuction, syncWorld } from './world'

export interface ProductFilter {
  q?: string
  category?: string
  subcategory?: string
  brands?: string[]
  minPriceMinor?: number
  maxPriceMinor?: number
  availability?: 'all' | 'in-stock' | 'auction'
  condition?: string
  sort?: 'recommended' | 'price-asc' | 'price-desc' | 'newest' | 'popular' | 'rating' | 'savings'
  page?: number
  pageSize?: number
}

export interface AuctionFilter {
  status?: 'live' | 'scheduled' | 'completed' | 'all'
  category?: string
  sort?: 'ending' | 'newest' | 'price' | 'popular' | 'value'
  q?: string
  limit?: number
}

export interface BackendOptions {
  clock?: () => number
  locks: LockProvider
  audit?: MemoryAuditLog
  search?: SearchProvider
  recommendations?: RecommendationProvider
}

function createState(clock: () => number, auditLog: MemoryAuditLog): DemoState {
  const now = clock()
  const anchorDay = Math.floor(now / DAY) * DAY
  const products = buildProducts(anchorDay)
  const state: DemoState = {
    clock,
    bootAt: now,
    anchorDay,
    categories: CATEGORIES,
    brands: BRANDS,
    suppliers: SUPPLIERS,
    products: new Map(products.map((product) => [product.id, product])),
    productsBySlug: new Map(products.map((product) => [product.slug, product])),
    inventory: new Map(),
    purchaseOrders: [],
    auctions: new Map(),
    seriesCursor: new Map(),
    autobids: new Map(),
    drops: new Map(),
    packages: BID_PACKAGES.map((pack) => ({ ...pack })),
    promotions: new Map(buildPromotions(anchorDay).map((promotion) => [promotion.id, promotion])),
    accounts: new Map(),
    customers: [],
    orders: new Map(),
    payments: [],
    refunds: [],
    bidPackOrders: [],
    tickets: [],
    fraudCases: [],
    audit: auditLog,
    daily: [],
    runtimeFlags: {},
    autobidKillSwitch: false,
    progressingOrders: new Set(),
    lastSyncAt: 0,
    sequence: { order: 0, ticket: 3_000, bidPack: 0 },
  }
  seedInventory(state, initialStock)
  seedPurchaseOrders(state, now)
  state.customers = generateCustomers(anchorDay, now)
  const history = generateHistory(state, now)
  for (const order of history.orders) state.orders.set(order.id, order)
  state.payments = history.payments
  state.refunds = history.refunds
  state.bidPackOrders = history.bidPackOrders
  state.daily = history.daily
  state.fraudCases = generateFraudCases(state, now)
  state.tickets = generateTickets(state, now)
  seedAudit(state, now)
  return state
}

/**
 * Demo backend: an in-memory, deterministic implementation of the Esocity Bid commerce backend.
 *
 * It is intentionally separate from the production persistence layer (PostgreSQL + Redis, see
 * src/server/postgres and docs/ARCHITECTURE.md). Both run the same domain rules from src/domain.
 * State is per server instance and resets safely when the instance restarts.
 */
export class DemoBackend {
  readonly ctx: Ctx
  private readonly locks: LockProvider
  private readonly search: SearchProvider
  private readonly recommender: RecommendationProvider

  constructor(deps: DemoDeps, options: BackendOptions) {
    const clock = options.clock ?? (() => Date.now())
    this.ctx = { state: createState(clock, options.audit ?? new MemoryAuditLog()), deps }
    this.locks = options.locks
    this.search = options.search ?? new LocalSearchProvider()
    this.recommender = options.recommendations ?? new HeuristicRecommender()
    syncWorld(this.ctx, clock())
  }

  get state(): DemoState {
    return this.ctx.state
  }

  now(): number {
    return this.ctx.state.clock()
  }

  /** Brings the world up to the authoritative server time and returns that time. */
  sync(): number {
    const now = this.now()
    syncWorld(this.ctx, now)
    return now
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Session accounts                                                                           */
  /* ---------------------------------------------------------------------------------------- */

  ensureSessionAccount(sessionId: string): DemoAccount {
    const now = this.sync()
    const existing = this.state.accounts.get(sessionId)
    if (existing) {
      existing.lastSeenAt = now
      return existing
    }
    return createSessionAccount(this.ctx, sessionId, now)
  }

  hasSessionAccount(sessionId: string): boolean {
    return this.state.accounts.has(sessionId)
  }

  resetSessionAccount(sessionId: string): void {
    removeSessionAccount(this.ctx, sessionId)
  }

  private account(userId: string): DemoAccount {
    const account = this.state.accounts.get(userId)
    if (!account)
      throw new DomainError('UNAUTHENTICATED', 'Please enter the demo platform to continue.')
    account.lastSeenAt = this.now()
    return account
  }

  private maybeAccount(userId?: string | null): DemoAccount | null {
    return userId ? (this.state.accounts.get(userId) ?? null) : null
  }

  viewerSummary(userId: string): ViewerSummary {
    const now = this.sync()
    const account = this.account(userId)
    return {
      userId,
      displayName: account.displayName,
      handle: account.handle,
      walletAvailable: summarizeWallet(account.ledger, now).available,
      unreadNotifications: account.notifications.filter((item) => item.readAt === null).length,
      cartCount: account.cart.reduce((total, item) => total + item.quantity, 0),
      tier: accountTier(account, now),
    }
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Catalogue & search                                                                         */
  /* ---------------------------------------------------------------------------------------- */

  categories() {
    return this.state.categories.map((category) => ({
      ...category,
      productCount: [...this.state.products.values()].filter(
        (product) => product.categorySlug === category.slug && product.status === 'ACTIVE',
      ).length,
      liveAuctions: [...this.state.auctions.values()].filter(
        (record) =>
          record.state.status === 'LIVE' &&
          this.state.products.get(record.state.productId)?.categorySlug === category.slug,
      ).length,
    }))
  }

  category(slug: string) {
    return this.categories().find((category) => category.slug === slug) ?? null
  }

  brands() {
    return this.state.brands
  }

  private activeProducts(): Product[] {
    return [...this.state.products.values()].filter((product) => product.status === 'ACTIVE')
  }

  listProducts(filter: ProductFilter, viewerId?: string | null) {
    this.sync()
    const viewer = this.maybeAccount(viewerId)
    let products = this.activeProducts()
    if (filter.q && filter.q.trim()) {
      const hits = this.search.search(
        filter.q,
        products.map((product) =>
          productDocument(
            product,
            this.state.categories.find((category) => category.slug === product.categorySlug),
          ),
        ),
        100,
      )
      const order = new Map(hits.map((hit, index) => [hit.id, index]))
      products = products
        .filter((product) => order.has(product.id))
        .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
    }
    const inCategory = filter.category
      ? products.filter((product) => product.categorySlug === filter.category)
      : products
    const brandFacet = new Map<string, { slug: string; name: string; count: number }>()
    const subcategoryFacet = new Map<string, number>()
    for (const product of inCategory) {
      const brand = brandFacet.get(product.brandSlug) ?? {
        slug: product.brandSlug,
        name: product.brandName,
        count: 0,
      }
      brand.count += 1
      brandFacet.set(product.brandSlug, brand)
      subcategoryFacet.set(
        product.subcategory,
        (subcategoryFacet.get(product.subcategory) ?? 0) + 1,
      )
    }
    let filtered = inCategory
    if (filter.subcategory)
      filtered = filtered.filter((product) => product.subcategory === filter.subcategory)
    if (filter.brands && filter.brands.length > 0)
      filtered = filtered.filter((product) => filter.brands!.includes(product.brandSlug))
    if (filter.minPriceMinor !== undefined)
      filtered = filtered.filter((product) => product.buyNowPriceMinor >= filter.minPriceMinor!)
    if (filter.maxPriceMinor !== undefined)
      filtered = filtered.filter((product) => product.buyNowPriceMinor <= filter.maxPriceMinor!)
    if (filter.condition)
      filtered = filtered.filter((product) => product.condition === filter.condition)
    let cards = filtered.map((product) => productCard(this.ctx, product, viewer))
    if (filter.availability === 'in-stock')
      cards = cards.filter((card) => card.stockLevel !== 'OUT_OF_STOCK')
    if (filter.availability === 'auction') cards = cards.filter((card) => card.liveAuction !== null)
    const sorters: Record<
      NonNullable<ProductFilter['sort']>,
      (a: ProductCard, b: ProductCard) => number
    > = {
      recommended: (a, b) =>
        b.popularity + (b.liveAuction ? 8 : 0) - (a.popularity + (a.liveAuction ? 8 : 0)),
      'price-asc': (a, b) => a.buyNowPriceMinor - b.buyNowPriceMinor,
      'price-desc': (a, b) => b.buyNowPriceMinor - a.buyNowPriceMinor,
      newest: (a, b) => b.createdAt - a.createdAt,
      popular: (a, b) => b.reviewCount - a.reviewCount,
      rating: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
      savings: (a, b) => b.savingsBps - a.savingsBps,
    }
    if (!(filter.q && (!filter.sort || filter.sort === 'recommended')))
      cards.sort(sorters[filter.sort ?? 'recommended'])
    const pageSize = filter.pageSize ?? 24
    const page = Math.max(1, filter.page ?? 1)
    const prices = inCategory.map((product) => product.buyNowPriceMinor)
    return {
      items: cards.slice((page - 1) * pageSize, page * pageSize),
      total: cards.length,
      page,
      pageSize,
      facets: {
        brands: [...brandFacet.values()].sort((a, b) => a.name.localeCompare(b.name)),
        subcategories: [...subcategoryFacet.entries()].map(([name, count]) => ({ name, count })),
        priceRange: {
          min: prices.length ? Math.min(...prices) : 0,
          max: prices.length ? Math.max(...prices) : 0,
        },
      },
    }
  }

  productDetail(slug: string, viewerId?: string | null): ProductDetail | null {
    const now = this.sync()
    const product = this.state.productsBySlug.get(slug)
    if (!product || product.status === 'ARCHIVED') return null
    const viewer = this.maybeAccount(viewerId)
    if (viewer) {
      viewer.viewedCategories.add(product.categorySlug)
      viewer.viewedProducts = [
        product.id,
        ...viewer.viewedProducts.filter((id) => id !== product.id),
      ].slice(0, 20)
    }
    track(
      this.ctx,
      'PRODUCT_VIEW',
      { productId: product.id, category: product.categorySlug },
      viewer?.id ?? null,
    )
    const live = liveAuctionFor(this.ctx, product.id)
    const similar = this.recommender.similar(product, this.activeProducts(), 6)
    const relatedAuctions = [...this.state.auctions.values()]
      .filter(
        (record) =>
          record.state.status === 'LIVE' &&
          record.state.productId !== product.id &&
          this.state.products.get(record.state.productId)?.categorySlug === product.categorySlug,
      )
      .slice(0, 4)
      .map((record) => auctionCard(this.ctx, record, viewer))
    const drop = [...this.state.drops.values()].find(
      (instance) => instance.drop.productId === product.id,
    )
    const market = getMarket('UK')
    return {
      ...productCard(this.ctx, product, viewer),
      description: product.description,
      highlights: product.highlights,
      attributes: product.attributes,
      sku: product.sku,
      images: product.images,
      related: similar.map((item) =>
        productCard(this.ctx, this.state.products.get(item.productId)!, viewer),
      ),
      relatedAuctions,
      activeAuction: live ? auctionCard(this.ctx, live, viewer) : null,
      drop: drop ? dropView(this.ctx, drop, viewer, now) : null,
      returnsWindowDays: market.returnsWindowDays,
      deliveryNote:
        product.shippingClass === 'DIGITAL'
          ? 'Delivered instantly by email.'
          : product.shippingClass === 'LARGE'
            ? 'Two-person delivery to a room of your choice. A bulky-item surcharge applies.'
            : 'Standard delivery 3–5 working days, free over £50. Express and next-day available.',
    }
  }

  searchSuggestions(query: string) {
    this.sync()
    const q = query.trim()
    if (q.length < 2) return { products: [], brands: [], categories: [], auctions: [] }
    const products = this.activeProducts()
    const hits = this.search.search(
      q,
      products.map((product) =>
        productDocument(
          product,
          this.state.categories.find((category) => category.slug === product.categorySlug),
        ),
      ),
      6,
    )
    const auctions = [...this.state.auctions.values()]
      .filter((record) => record.state.status === 'LIVE' || record.state.status === 'SCHEDULED')
      .filter((record) => record.state.title.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 4)
    return {
      products: hits.map((hit) => {
        const product = this.state.products.get(hit.id)!
        return {
          slug: product.slug,
          name: product.name,
          brandName: product.brandName,
          priceMinor: product.buyNowPriceMinor,
        }
      }),
      brands: matchBrands(q, this.state.brands).map((brand) => ({
        slug: brand.slug,
        name: brand.name,
      })),
      categories: matchCategories(q, this.state.categories).map((category) => ({
        slug: category.slug,
        name: category.name,
      })),
      auctions: auctions.map((record) => ({
        id: record.state.id,
        title: record.state.title,
        status: record.state.status,
        priceMinor: record.state.priceMinor,
      })),
    }
  }

  searchAll(query: string, viewerId?: string | null) {
    const products = this.listProducts({ q: query, pageSize: 48 }, viewerId)
    const q = query.toLowerCase().trim()
    const viewer = this.maybeAccount(viewerId)
    const auctions = q
      ? [...this.state.auctions.values()]
          .filter((record) => record.state.status === 'LIVE' || record.state.status === 'SCHEDULED')
          .filter((record) => {
            const product = this.state.products.get(record.state.productId)
            return `${record.state.title} ${product?.brandName ?? ''} ${product?.categorySlug ?? ''}`
              .toLowerCase()
              .includes(q)
          })
          .map((record) => auctionCard(this.ctx, record, viewer))
      : []
    return {
      products: products.items,
      total: products.total,
      auctions,
      brands: matchBrands(query, this.state.brands),
      categories: matchCategories(query, this.state.categories),
    }
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Auctions                                                                                   */
  /* ---------------------------------------------------------------------------------------- */

  private auctionRecords(): AuctionRecord[] {
    return [...this.state.auctions.values()]
  }

  listAuctions(filter: AuctionFilter = {}, viewerId?: string | null): AuctionCard[] {
    this.sync()
    const viewer = this.maybeAccount(viewerId)
    const q = filter.q?.toLowerCase().trim()
    const statusMatch = (status: AuctionStatus) => {
      switch (filter.status ?? 'live') {
        case 'live':
          return status === 'LIVE' || status === 'PAUSED'
        case 'scheduled':
          return status === 'SCHEDULED'
        case 'completed':
          return status === 'COMPLETED'
        case 'all':
          return status !== 'DRAFT' && status !== 'CANCELLED'
      }
    }
    let records = this.auctionRecords().filter((record) => statusMatch(record.state.status))
    if (filter.category)
      records = records.filter(
        (record) =>
          this.state.products.get(record.state.productId)?.categorySlug === filter.category,
      )
    if (q) records = records.filter((record) => record.state.title.toLowerCase().includes(q))
    const sort =
      filter.sort ??
      (filter.status === 'completed'
        ? 'newest'
        : filter.status === 'scheduled'
          ? 'ending'
          : 'ending')
    records.sort((a, b) => {
      switch (sort) {
        case 'ending':
          return filter.status === 'scheduled'
            ? a.state.startsAt - b.state.startsAt
            : a.state.closeAt - b.state.closeAt
        case 'newest':
          return (
            (b.state.result?.closedAt ?? b.state.startsAt) -
            (a.state.result?.closedAt ?? a.state.startsAt)
          )
        case 'price':
          return b.state.priceMinor - a.state.priceMinor
        case 'popular':
          return b.state.uniqueBidders - a.state.uniqueBidders
        case 'value':
          return (
            (this.state.products.get(b.state.productId)?.referencePriceMinor ?? 0) -
            (this.state.products.get(a.state.productId)?.referencePriceMinor ?? 0)
          )
      }
    })
    return records
      .slice(0, filter.limit ?? 60)
      .map((record) => auctionCard(this.ctx, record, viewer))
  }

  auctionDetail(id: string, viewerId?: string | null): AuctionDetail | null {
    const now = this.sync()
    const record = this.state.auctions.get(id)
    if (!record || record.state.status === 'DRAFT') return null
    const viewer = this.maybeAccount(viewerId)
    const product = this.state.products.get(record.state.productId)!
    if (viewer) viewer.viewedCategories.add(product.categorySlug)
    track(this.ctx, 'AUCTION_VIEW', { auctionId: id }, viewer?.id ?? null)
    const similar = this.auctionRecords()
      .filter(
        (candidate) =>
          candidate.state.id !== id &&
          (candidate.state.status === 'LIVE' || candidate.state.status === 'SCHEDULED'),
      )
      .map((candidate) => ({
        candidate,
        product: this.state.products.get(candidate.state.productId)!,
      }))
      .sort(
        (a, b) =>
          Number(b.product.categorySlug === product.categorySlug) -
            Number(a.product.categorySlug === product.categorySlug) ||
          a.candidate.state.closeAt - b.candidate.state.closeAt,
      )
      .slice(0, 4)
      .map(({ candidate }) => auctionCard(this.ctx, candidate, viewer))
    return {
      ...auctionCard(this.ctx, record, viewer),
      fullRules: record.state.rules,
      rulesText: describeRules(record.state.rules),
      recentBids: recentBidViews(record, viewer?.id, 12),
      viewer: viewer ? viewerAuctionState(this.ctx, record, viewer, now) : null,
      description: record.description ?? product.description,
      highlights: product.highlights,
      attributes: product.attributes,
      similar,
      serverTime: now,
      simulatedBidders: !!record.sim,
    }
  }

  liveAuction(id: string, viewerId?: string | null): LiveAuctionPayload | null {
    const now = this.sync()
    const record = this.state.auctions.get(id)
    if (!record || record.state.status === 'DRAFT') return null
    const viewer = this.maybeAccount(viewerId)
    return {
      serverTime: now,
      snapshot: auctionSnapshot(record, viewer?.id),
      recentBids: recentBidViews(record, viewer?.id, 12),
      viewer: viewer ? viewerAuctionState(this.ctx, record, viewer, now) : null,
    }
  }

  snapshots(ids: string[], viewerId?: string | null) {
    const now = this.sync()
    return {
      serverTime: now,
      auctions: ids
        .map((id) => this.state.auctions.get(id))
        .filter((record): record is AuctionRecord => !!record && record.state.status !== 'DRAFT')
        .map((record) => auctionSnapshot(record, viewerId)),
    }
  }

  liveCount(): number {
    this.sync()
    let count = 0
    for (const record of this.state.auctions.values())
      if (record.state.status === 'LIVE') count += 1
    return count
  }

  recentlyWon(limit = 8, viewerId?: string | null): AuctionCard[] {
    this.sync()
    const viewer = this.maybeAccount(viewerId)
    return this.auctionRecords()
      .filter(
        (record) => record.state.status === 'COMPLETED' && record.state.result?.outcome === 'WON',
      )
      .sort((a, b) => (b.state.result?.closedAt ?? 0) - (a.state.result?.closedAt ?? 0))
      .slice(0, limit)
      .map((record) => auctionCard(this.ctx, record, viewer))
  }

  /**
   * Authoritative bid placement. Serialised per auction by the lock provider; inside the lock the
   * auction is advanced to the server's current time before the bid is evaluated.
   */
  async placeBid(
    userId: string,
    auctionId: string,
    requestId: string | null,
  ): Promise<BidResultView> {
    return this.locks.withLock(`auction:${auctionId}`, async () => {
      const now = this.now()
      const record = this.state.auctions.get(auctionId)
      if (!record || record.state.status === 'DRAFT')
        throw new DomainError('AUCTION_NOT_FOUND', 'We could not find that auction.')
      const account = this.account(userId)
      advanceAuction(this.ctx, record, now)
      track(this.ctx, 'BID_SUBMITTED', { auctionId }, userId)
      const outcome = placeMemberBid(this.ctx, record, account, 'MANUAL', now)
      if (!outcome.accepted) throw new DomainError(outcome.code, outcome.message)
      void requestId
      return {
        accepted: true,
        sequence: outcome.event.sequence,
        priceMinor: record.state.priceMinor,
        closeAt: record.state.closeAt,
        creditsSpent: outcome.creditsSpent,
        walletAvailable: outcome.availableAfter,
        serverTime: now,
        snapshot: auctionSnapshot(record, userId),
      }
    })
  }

  toggleWatch(userId: string, type: WatchTargetType, targetId: string, watch?: boolean) {
    this.sync()
    const account = this.account(userId)
    const index = account.watchlist.findIndex(
      (item) => item.type === type && item.targetId === targetId,
    )
    const shouldWatch = watch ?? index === -1
    if (type === 'AUCTION' && !this.state.auctions.has(targetId))
      throw new DomainError('AUCTION_NOT_FOUND', 'Auction not found.')
    if (type === 'PRODUCT' && !this.state.products.has(targetId))
      throw new DomainError('NOT_FOUND', 'Product not found.')
    if (shouldWatch && index === -1) {
      const product = type === 'PRODUCT' ? this.state.products.get(targetId) : undefined
      account.watchlist.unshift({
        type,
        targetId,
        addedAt: this.now(),
        priceAtAddMinor: product?.buyNowPriceMinor ?? null,
        notify: true,
      })
      if (type === 'AUCTION') this.state.auctions.get(targetId)?.watchers.add(userId)
      track(this.ctx, 'AUCTION_WATCH', { type, targetId }, userId)
    }
    if (!shouldWatch && index !== -1) {
      account.watchlist.splice(index, 1)
      if (type === 'AUCTION') this.state.auctions.get(targetId)?.watchers.delete(userId)
    }
    return { watched: shouldWatch }
  }

  setAutoBid(
    userId: string,
    auctionId: string,
    input: { maxBids: number; maxPriceMinor: number | null },
  ): AutoBidView {
    const now = this.sync()
    const account = this.account(userId)
    const record = this.state.auctions.get(auctionId)
    if (!record) throw new DomainError('AUCTION_NOT_FOUND', 'Auction not found.')
    if (this.state.autobidKillSwitch || this.state.runtimeFlags.autobid === false)
      throw new DomainError('FEATURE_DISABLED', 'AutoBid is temporarily unavailable.')
    const invalid = validateAutoBidConfig(input, record.state)
    if (invalid) throw new DomainError('AUTOBID_INVALID', invalid)
    for (const rule of this.state.autobids.values()) {
      if (rule.auctionId === auctionId && rule.userId === userId && rule.status === 'ACTIVE') {
        rule.status = 'CANCELLED'
        rule.stopReason = 'Replaced by a new AutoBid setting.'
        rule.updatedAt = now
      }
    }
    const rule: AutoBidRule = {
      id: newId(),
      auctionId,
      userId,
      userName: account.handle,
      maxBids: input.maxBids,
      maxPriceMinor: input.maxPriceMinor,
      bidsPlaced: 0,
      status: 'ACTIVE',
      stopReason: null,
      createdAt: now,
      updatedAt: now,
      lastBidAt: null,
    }
    this.state.autobids.set(rule.id, rule)
    audit(this.ctx, {
      actor: memberActor(account),
      action: 'autobid.created',
      entityType: 'AUTOBID',
      entityId: rule.id,
      summary: `AutoBid set on ${record.state.title}: up to ${input.maxBids} bids${input.maxPriceMinor ? `, max price ${(input.maxPriceMinor / 100).toFixed(2)}` : ''}`,
      metadata: { auctionId, maxBids: input.maxBids, maxPriceMinor: input.maxPriceMinor },
      at: now,
    })
    return autoBidView(this.ctx, rule)
  }

  cancelAutoBid(userId: string, ruleId: string): AutoBidView {
    const now = this.sync()
    const account = this.account(userId)
    const rule = this.state.autobids.get(ruleId)
    if (!rule || rule.userId !== userId) throw new DomainError('NOT_FOUND', 'AutoBid not found.')
    if (rule.status === 'ACTIVE') {
      rule.status = 'CANCELLED'
      rule.stopReason = 'Cancelled by you.'
      rule.updatedAt = now
      audit(this.ctx, {
        actor: memberActor(account),
        action: 'autobid.cancelled',
        entityType: 'AUTOBID',
        entityId: rule.id,
        summary: 'AutoBid cancelled by member',
        metadata: { auctionId: rule.auctionId, bidsPlaced: rule.bidsPlaced },
        at: now,
      })
    }
    return autoBidView(this.ctx, rule)
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Discover, drops & recommendations                                                         */
  /* ---------------------------------------------------------------------------------------- */

  private signalsFor(account: DemoAccount | null) {
    if (!account) return null
    const watchedProducts = account.watchlist
      .map((item) =>
        item.type === 'PRODUCT'
          ? item.targetId
          : item.type === 'AUCTION'
            ? this.state.auctions.get(item.targetId)?.state.productId
            : undefined,
      )
      .filter((id): id is string => !!id)
    const bidCategories = new Set<string>()
    for (const record of this.state.auctions.values()) {
      if (record.participants.has(account.id)) {
        const product = this.state.products.get(record.state.productId)
        if (product) bidCategories.add(product.categorySlug)
      }
    }
    const purchased = account.orderIds.flatMap(
      (id) => this.state.orders.get(id)?.lines.map((line) => line.productId) ?? [],
    )
    return {
      viewedCategories: [...account.viewedCategories],
      watchedProductIds: watchedProducts,
      watchedCategories: watchedProducts
        .map((id) => this.state.products.get(id)?.categorySlug)
        .filter((slug): slug is string => !!slug),
      biddedCategories: [...bidCategories],
      purchasedProductIds: purchased,
      purchasedBrands: purchased
        .map((id) => this.state.products.get(id)?.brandSlug)
        .filter((slug): slug is string => !!slug),
    }
  }

  recommendations(viewerId?: string | null, limit = 8) {
    this.sync()
    const viewer = this.maybeAccount(viewerId)
    const signals = this.signalsFor(viewer) ?? {
      viewedCategories: [],
      watchedProductIds: [],
      watchedCategories: [],
      biddedCategories: [],
      purchasedProductIds: [],
      purchasedBrands: [],
    }
    return this.recommender.recommend(this.activeProducts(), signals, limit).map((item) => ({
      reason: item.reason,
      product: productCard(this.ctx, this.state.products.get(item.productId)!, viewer),
    }))
  }

  listDrops(viewerId?: string | null): DropView[] {
    const now = this.sync()
    const viewer = this.maybeAccount(viewerId)
    const rank = { LIVE: 0, UPCOMING: 1, SOLD_OUT: 2, ENDED: 3 }
    return [...this.state.drops.values()]
      .map((instance) => dropView(this.ctx, instance, viewer, now))
      .sort((a, b) => rank[a.status] - rank[b.status] || a.startsAt - b.startsAt)
  }

  discover(viewerId?: string | null) {
    const now = this.sync()
    const viewer = this.maybeAccount(viewerId)
    const live = this.listAuctions({ status: 'live', limit: 100 }, viewerId)
    const scheduled = this.listAuctions({ status: 'scheduled', limit: 12 }, viewerId)
    const recentlyWon = this.recentlyWon(12, viewerId)
    const recommended = this.recommendations(viewerId, 8)
    const watchedAuctionIds = new Set(
      viewer?.watchlist.filter((item) => item.type === 'AUCTION').map((item) => item.targetId) ??
        [],
    )
    const signals = this.signalsFor(viewer)
    let becauseYouWatched: { title: string; items: ProductCard[] } | null = null
    const anchorId = signals?.watchedProductIds[0]
    const anchor = anchorId ? this.state.products.get(anchorId) : undefined
    if (anchor) {
      becauseYouWatched = {
        title: `Because you watched ${anchor.name}`,
        items: this.recommender
          .similar(anchor, this.activeProducts(), 6)
          .map((item) => productCard(this.ctx, this.state.products.get(item.productId)!, viewer)),
      }
    }
    const favouriteCategory = signals?.viewedCategories[0] ?? 'electronics'
    const buyNow = this.activeProducts()
      .filter(
        (product) =>
          product.shippingClass !== 'DIGITAL' && availableStock(this.state, product.id) > 0,
      )
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 8)
      .map((product) => productCard(this.ctx, product, viewer))
    const topSavings = [...recentlyWon].sort(
      (a, b) =>
        savingsBasisPoints(
          money(b.product.referencePriceMinor),
          money(b.result?.finalPriceMinor ?? 0),
        ) -
        savingsBasisPoints(
          money(a.product.referencePriceMinor),
          money(a.result?.finalPriceMinor ?? 0),
        ),
    )
    return {
      serverTime: now,
      liveNow: [...live]
        .sort(
          (a, b) => Number(b.featured) - Number(a.featured) || b.uniqueBidders - a.uniqueBidders,
        )
        .slice(0, 8),
      endingSoon: [...live]
        .filter((auction) => auction.status === 'LIVE')
        .sort((a, b) => a.closeAt - b.closeAt)
        .slice(0, 8),
      trending: [...live].sort((a, b) => b.bidCount - a.bidCount).slice(0, 4),
      newAuctions: scheduled,
      buyNow,
      drops: this.listDrops(viewerId),
      recommended,
      becauseYouWatched,
      popularInCategory: {
        category: { slug: favouriteCategory, name: categoryName(this.ctx, favouriteCategory) },
        items: this.activeProducts()
          .filter((product) => product.categorySlug === favouriteCategory)
          .sort((a, b) => b.popularity - a.popularity)
          .slice(0, 6)
          .map((product) => productCard(this.ctx, product, viewer)),
      },
      categories: this.categories(),
      recentlyWon: recentlyWon.slice(0, 8),
      topSavings: topSavings.slice(0, 4),
      watchlistReminders: [...live, ...scheduled]
        .filter((auction) => watchedAuctionIds.has(auction.id))
        .slice(0, 4),
    }
  }

  landing() {
    const now = this.sync()
    const live = this.listAuctions({ status: 'live', limit: 100 })
    return {
      serverTime: now,
      liveNow: [...live]
        .sort((a, b) => Number(b.featured) - Number(a.featured) || a.closeAt - b.closeAt)
        .slice(0, 6),
      liveCount: live.length,
      scheduledCount: this.auctionRecords().filter((record) => record.state.status === 'SCHEDULED')
        .length,
      marketplace: this.activeProducts()
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 8)
        .map((product) => productCard(this.ctx, product, null)),
      drops: this.listDrops().slice(0, 3),
      categories: this.categories(),
      recentlyWon: this.recentlyWon(6),
      productCount: this.activeProducts().length,
    }
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Wallet & bid packs                                                                         */
  /* ---------------------------------------------------------------------------------------- */

  wallet(userId: string): WalletView {
    const now = this.sync()
    return walletView(this.ctx, this.account(userId), now)
  }

  bidPackages() {
    return packageViews(this.ctx)
  }

  validateBidPackCode(userId: string, code: string, packageId: string) {
    const now = this.sync()
    const account = this.account(userId)
    const pack = this.state.packages.find((item) => item.id === packageId && item.active)
    if (!pack) throw new DomainError('NOT_FOUND', 'That bid pack is not available.')
    const promotion = findPromotion(this.ctx, code)
    if (!promotion)
      return {
        code: code.toUpperCase(),
        valid: false,
        message: 'This code is not recognised.',
        discountMinor: 0,
        bonusCredits: 0,
      }
    const result = evaluatePromotion({
      promotion,
      context: 'BID_PACK',
      now,
      userRedemptions: account.promoRedemptions.get(promotion.id) ?? 0,
      isNewCustomer: account.orderIds.length === 0,
      tier: accountTier(account, now),
      subtotalMinor: pack.priceMinor,
      bidPackId: pack.id,
    })
    return result.valid
      ? {
          code: promotion.code,
          valid: true,
          message: result.effect.summary,
          discountMinor: result.effect.discountMinor,
          bonusCredits: result.effect.bonusCredits,
        }
      : {
          code: promotion.code,
          valid: false,
          message: result.reason,
          discountMinor: 0,
          bonusCredits: 0,
        }
  }

  async purchaseBidPackage(
    userId: string,
    packageId: string,
    options: {
      promoCode?: string | null
      paymentMethod: PaymentMethodOption
      requestId?: string | null
    },
  ) {
    const now = this.sync()
    const account = this.account(userId)
    return this.locks.withLock(`wallet:${userId}`, () =>
      purchaseBidPackageFlow(this.ctx, account, packageId, options, now),
    )
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Cart & checkout                                                                            */
  /* ---------------------------------------------------------------------------------------- */

  cart(userId: string): CartView {
    this.sync()
    const account = this.account(userId)
    const lines = account.cart
      .map((item) => {
        const product = this.state.products.get(item.productId)
        if (!product) return null
        const card = productCard(this.ctx, product, account)
        return {
          id: item.id,
          product: card,
          quantity: item.quantity,
          unitPriceMinor: product.buyNowPriceMinor,
          lineTotalMinor: product.buyNowPriceMinor * item.quantity,
          available: card.available,
        }
      })
      .filter((line): line is NonNullable<typeof line> => line !== null)
    return {
      lines,
      itemCount: lines.reduce((total, line) => total + line.quantity, 0),
      subtotalMinor: lines.reduce((total, line) => total + line.lineTotalMinor, 0),
    }
  }

  addToCart(userId: string, productId: string, quantity: number): CartView {
    this.sync()
    const account = this.account(userId)
    const product = this.state.products.get(productId)
    if (!product || product.status !== 'ACTIVE')
      throw new DomainError('ITEM_UNAVAILABLE', 'This item is not available.')
    const existing = account.cart.find((item) => item.productId === productId)
    const nextQuantity = (existing?.quantity ?? 0) + quantity
    if (nextQuantity > 10)
      throw new DomainError('VALIDATION_FAILED', 'You can add up to 10 of an item.')
    const available =
      product.shippingClass === 'DIGITAL' ? 999 : availableStock(this.state, productId)
    if (available < nextQuantity)
      throw new DomainError(
        'OUT_OF_STOCK',
        available > 0 ? `Only ${available} available.` : 'This item is out of stock.',
      )
    if (existing) existing.quantity = nextQuantity
    else account.cart.push({ id: newId(), productId, quantity, addedAt: this.now() })
    return this.cart(userId)
  }

  updateCartItem(userId: string, itemId: string, quantity: number): CartView {
    this.sync()
    const account = this.account(userId)
    const item = account.cart.find((candidate) => candidate.id === itemId)
    if (!item) throw new DomainError('NOT_FOUND', 'Item not in your basket.')
    if (quantity <= 0) account.cart = account.cart.filter((candidate) => candidate.id !== itemId)
    else {
      const product = this.state.products.get(item.productId)!
      const available =
        product.shippingClass === 'DIGITAL' ? 999 : availableStock(this.state, product.id)
      if (quantity > Math.min(10, available))
        throw new DomainError('OUT_OF_STOCK', `Only ${Math.min(10, available)} available.`)
      item.quantity = quantity
    }
    return this.cart(userId)
  }

  removeCartItem(userId: string, itemId: string): CartView {
    return this.updateCartItem(userId, itemId, 0)
  }

  previewCheckout(
    userId: string,
    mode: CheckoutMode,
    options: { promoCode?: string | null; shippingMethodId?: string },
  ): CheckoutPreview {
    const now = this.sync()
    return previewCheckoutFlow(this.ctx, this.account(userId), mode, options, now)
  }

  async placeOrder(
    userId: string,
    mode: CheckoutMode,
    options: {
      promoCode?: string | null
      shippingMethodId?: string
      addressId?: string | null
      paymentMethod: PaymentMethodOption
      requestId?: string | null
    },
  ): Promise<OrderView> {
    const account = this.account(userId)
    return this.locks.withLock(`checkout:${userId}`, async () => {
      const now = this.sync()
      const order = await placeOrderFlow(this.ctx, account, mode, options, now)
      return orderView(this.ctx, order)
    })
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Orders, rewards, watchlist, notifications                                                 */
  /* ---------------------------------------------------------------------------------------- */

  orders(userId: string): OrderView[] {
    this.sync()
    const account = this.account(userId)
    return account.orderIds
      .map((id) => this.state.orders.get(id))
      .filter((order): order is NonNullable<typeof order> => !!order)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((order) => orderView(this.ctx, order))
  }

  order(userId: string, orderId: string): OrderView | null {
    this.sync()
    const account = this.account(userId)
    const order = this.state.orders.get(orderId)
    if (!order || order.userId !== account.id) return null
    return orderView(this.ctx, order)
  }

  rewards(userId: string): RewardsView {
    const now = this.sync()
    const account = this.account(userId)
    const balance = rewardBalance(account.rewards)
    const qualifying = qualifyingPoints(account.rewards, now)
    return {
      balance,
      progress: tierProgress(qualifying),
      tiers: TIER_DEFINITIONS.map((definition) => ({ ...definition })),
      entries: [...account.rewards].sort((a, b) => b.at - a.at),
      achievements: evaluateAchievements(achievementStats(this.state, account)),
      redemptions: REDEMPTION_OPTIONS.map((option) => ({
        ...option,
        affordable: balance >= option.points,
      })),
      weeklyStreak: account.weeklyStreak,
      referral: {
        code: `ESB-${account.handle.replace(/[^A-Z0-9]/gi, '')}${account.id.slice(0, 4).toUpperCase()}`,
        enabled: this.state.runtimeFlags.referrals ?? false,
      },
    }
  }

  redeem(userId: string, optionId: string) {
    const now = this.sync()
    return redeemReward(this.ctx, this.account(userId), optionId, now)
  }

  watchlist(userId: string): WatchlistView {
    const now = this.sync()
    const account = this.account(userId)
    const auctions: AuctionCard[] = []
    const products: WatchlistView['products'] = []
    const drops: DropView[] = []
    for (const item of account.watchlist) {
      if (item.type === 'AUCTION') {
        const record = this.state.auctions.get(item.targetId)
        if (record) auctions.push(auctionCard(this.ctx, record, account))
      } else if (item.type === 'PRODUCT') {
        const product = this.state.products.get(item.targetId)
        if (product) {
          const card = productCard(this.ctx, product, account)
          products.push({
            ...card,
            priceAtAddMinor: item.priceAtAddMinor,
            priceChangeMinor:
              item.priceAtAddMinor === null ? 0 : card.buyNowPriceMinor - item.priceAtAddMinor,
          })
        }
      } else {
        const instance = [...this.state.drops.values()].find(
          (drop) => drop.seriesKey === item.targetId || drop.drop.id === item.targetId,
        )
        if (instance) drops.push(dropView(this.ctx, instance, account, now))
      }
    }
    return {
      auctions,
      products,
      drops,
      startingSoon: auctions.filter(
        (auction) => auction.status === 'SCHEDULED' && auction.startsAt - now < 2 * HOUR,
      ),
      endingSoon: auctions.filter(
        (auction) => auction.status === 'LIVE' && auction.closeAt - now < 30 * 60_000,
      ),
      priceDrops: products.filter((product) => product.priceChangeMinor < 0),
    }
  }

  notifications(userId: string): NotificationsView {
    this.sync()
    const account = this.account(userId)
    return {
      items: account.notifications,
      unread: account.notifications.filter((item) => item.readAt === null).length,
    }
  }

  markNotificationsRead(userId: string, ids: string[] | 'all') {
    const now = this.sync()
    const account = this.account(userId)
    for (const item of account.notifications) {
      if (item.readAt === null && (ids === 'all' || ids.includes(item.id))) item.readAt = now
    }
    return this.notifications(userId)
  }

  updateNotificationPreferences(userId: string, prefs: NotificationPreferences) {
    this.sync()
    const account = this.account(userId)
    const types = { ...prefs.types }
    for (const mandatory of MANDATORY_NOTIFICATION_TYPES) types[mandatory] = true
    account.preferences.notifications = {
      channels: { ...DEFAULT_NOTIFICATION_PREFERENCES.channels, ...prefs.channels, IN_APP: true },
      types,
    }
    return account.preferences.notifications
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Account & responsible use                                                                  */
  /* ---------------------------------------------------------------------------------------- */

  limits(userId: string): LimitsView {
    const now = this.sync()
    const account = this.account(userId)
    const effective = applyMaturedChanges(account.limits, now)
    account.limits = effective
    return {
      limits: effective,
      pending: effective.pendingChanges,
      usage: walletView(this.ctx, account, now).usage,
    }
  }

  updateLimits(
    userId: string,
    request: LimitChangeRequest,
    requestId: string | null,
  ): LimitsView & { appliedNow: string[]; scheduled: string[] } {
    const now = this.sync()
    const account = this.account(userId)
    const result = requestLimitChange(account.limits, request, now)
    account.limits = result.limits
    audit(this.ctx, {
      actor: memberActor(account),
      action: 'limits.updated',
      entityType: 'USER_LIMITS',
      entityId: account.id,
      severity: result.scheduled.length > 0 ? 'NOTICE' : 'INFO',
      summary: `Responsible-use limits updated (immediate: ${result.appliedNow.join(', ') || 'none'}; after 24h: ${result.scheduled.map((item) => item.field).join(', ') || 'none'})`,
      metadata: { appliedNow: result.appliedNow, scheduled: result.scheduled },
      requestId,
      at: now,
    })
    return {
      ...this.limits(userId),
      appliedNow: result.appliedNow,
      scheduled: result.scheduled.map((item) => item.field),
    }
  }

  accountOverview(userId: string): AccountOverview {
    const now = this.sync()
    const account = this.account(userId)
    const qualifying = qualifyingPoints(account.rewards, now)
    const activity: AccountOverview['biddingActivity'] = []
    for (const record of this.state.auctions.values()) {
      const participant = record.participants.get(account.id)
      if (!participant) continue
      const result = record.state.result
      const outcome: AccountOverview['biddingActivity'][number]['outcome'] =
        record.state.status === 'COMPLETED'
          ? result?.bidsRefunded
            ? 'REFUNDED'
            : result?.winnerId === account.id
              ? 'WON'
              : 'LOST'
          : record.state.status === 'CANCELLED'
            ? 'REFUNDED'
            : record.state.leaderId === account.id
              ? 'LEADING'
              : 'OUTBID'
      activity.push({
        auctionId: record.state.id,
        title: record.state.title,
        status: record.state.status,
        bids: participant.bids,
        creditsSpent: participant.purchasedCreditsSpent + participant.promotionalCreditsSpent,
        lastBidAt: participant.lastBidAt,
        outcome,
        archived: false,
      })
    }
    for (const entry of account.archivedBidding) {
      activity.push({ ...entry, creditsSpent: entry.bids, archived: true })
    }
    activity.sort((a, b) => b.lastBidAt - a.lastBidAt)
    const orders = this.orders(userId)
    return {
      profile: {
        displayName: account.displayName,
        firstName: account.profile.firstName,
        lastName: account.profile.lastName,
        email: account.profile.email,
        phone: account.profile.phone,
        handle: account.handle,
        memberSince: account.createdAt,
        marketingOptIn: account.profile.marketingOptIn,
      },
      addresses: account.addresses,
      preferences: {
        theme: account.preferences.theme,
        interests: account.preferences.interests,
        currency: account.preferences.currency,
        region: account.preferences.region,
      },
      notificationPreferences: account.preferences.notifications,
      limits: this.limits(userId),
      wallet: summarizeWallet(account.ledger, now),
      rewards: {
        balance: rewardBalance(account.rewards),
        tier: tierForPoints(qualifying),
        progress: tierProgress(qualifying),
      },
      biddingActivity: activity.slice(0, 20),
      recentOrders: orders.slice(0, 5),
      stats: {
        orders: orders.length,
        wins: account.previousWins,
        bidsPlaced: new Set(
          account.ledger
            .filter((entry) => entry.type === 'AUCTION_BID')
            .map((entry) => entry.reference?.id),
        ).size,
        watchlist: account.watchlist.length,
      },
    }
  }

  updateProfile(
    userId: string,
    input: { firstName: string; lastName: string; phone: string; marketingOptIn: boolean },
  ) {
    this.sync()
    const account = this.account(userId)
    account.profile = {
      ...account.profile,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      marketingOptIn: input.marketingOptIn,
    }
    account.displayName = `${input.firstName} ${input.lastName}`.trim()
    return this.accountOverview(userId).profile
  }

  /** Terms acceptance for the member's market (compliance hook, see src/domain/compliance.ts). */
  termsStatus(userId: string) {
    const account = this.account(userId)
    const current = getMarket(account.market).compliance.termsVersion
    return {
      currentVersion: current,
      acceptedVersion: account.compliance.termsAcceptedVersion,
      acceptedAt: account.compliance.termsAcceptedAt,
      upToDate: account.compliance.termsAcceptedVersion === current,
    }
  }

  acceptTerms(userId: string, version: string, requestId: string | null) {
    const now = this.sync()
    const account = this.account(userId)
    const current = getMarket(account.market).compliance.termsVersion
    if (version !== current) {
      throw new DomainError(
        'CONFLICT',
        'These terms have been updated. Please reload and review the latest version.',
        {
          currentVersion: current,
        },
      )
    }
    if (account.compliance.termsAcceptedVersion !== current) {
      account.compliance = {
        ...account.compliance,
        termsAcceptedVersion: current,
        termsAcceptedAt: now,
      }
      audit(this.ctx, {
        actor: memberActor(account),
        action: 'account.terms_accepted',
        entityType: 'USER',
        entityId: account.id,
        summary: `Accepted member terms version ${current}`,
        metadata: { version: current },
        requestId,
        at: now,
      })
    }
    return this.termsStatus(userId)
  }

  updatePreferences(
    userId: string,
    input: { theme?: 'system' | 'light' | 'dark'; interests?: string[] },
  ) {
    this.sync()
    const account = this.account(userId)
    if (input.theme) account.preferences.theme = input.theme
    if (input.interests)
      account.preferences.interests = input.interests.filter((slug) =>
        this.state.categories.some((category) => category.slug === slug),
      )
    return account.preferences
  }

  addAddress(
    userId: string,
    input: {
      label: string
      fullName: string
      line1: string
      line2?: string | null
      city: string
      postcode: string
      phone?: string | null
      makeDefault?: boolean
    },
  ) {
    this.sync()
    const account = this.account(userId)
    if (account.addresses.length >= 6)
      throw new DomainError('VALIDATION_FAILED', 'You can save up to six addresses.')
    const address = {
      id: newId(),
      label: input.label,
      fullName: input.fullName,
      line1: input.line1,
      line2: input.line2 ?? null,
      city: input.city,
      postcode: input.postcode.toUpperCase(),
      country: 'United Kingdom',
      phone: input.phone ?? null,
      isDefault: !!input.makeDefault,
    }
    if (address.isDefault) for (const existing of account.addresses) existing.isDefault = false
    account.addresses.push(address)
    return account.addresses
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Support                                                                                    */
  /* ---------------------------------------------------------------------------------------- */

  faqs() {
    return FAQS
  }

  tickets(userId: string) {
    this.sync()
    const account = this.account(userId)
    return this.state.tickets
      .filter((ticket) => ticket.userId === account.id)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  createTicket(
    userId: string,
    input: {
      category: TicketCategory
      subject: string
      message: string
      relatedReference?: string | null
    },
    requestId: string | null,
  ) {
    const now = this.sync()
    const account = this.account(userId)
    if (!TICKET_CATEGORIES.includes(input.category))
      throw new DomainError('VALIDATION_FAILED', 'Choose a category.')
    this.state.sequence.ticket += 1
    const ticket = {
      id: newId(),
      reference: `ESB-T-${this.state.sequence.ticket}`,
      userId: account.id,
      customerName: account.displayName,
      category: input.category,
      subject: input.subject,
      status: 'OPEN' as TicketStatus,
      priority: defaultPriority(input.category),
      assignee: null,
      relatedReference: input.relatedReference ?? null,
      messages: [
        {
          id: newId(),
          author: 'CUSTOMER' as const,
          authorName: account.displayName,
          body: input.message,
          at: now,
        },
        {
          id: newId(),
          author: 'SYSTEM' as const,
          authorName: 'Esocity Support',
          body: 'Thanks — your request has been received. A member of the team will reply within 24 hours. (Demo: replies are simulated.)',
          at: now + 1_000,
        },
      ],
      createdAt: now,
      updatedAt: now + 1_000,
      simulated: false,
    }
    this.state.tickets.unshift(ticket)
    account.ticketIds.unshift(ticket.id)
    audit(this.ctx, {
      actor: memberActor(account),
      action: 'support.ticket_created',
      entityType: 'SUPPORT_TICKET',
      entityId: ticket.id,
      summary: `${ticket.reference}: ${input.subject}`,
      metadata: { category: input.category },
      requestId,
      at: now,
    })
    return ticket
  }

  /* ---------------------------------------------------------------------------------------- */
  /* Admin                                                                                      */
  /* ---------------------------------------------------------------------------------------- */

  readonly admin = {
    dashboard: () => admin.dashboard(this.ctx, this.sync()),
    customerAnalytics: () => admin.customerAnalytics(this.ctx, this.sync()),
    economics: () => {
      this.sync()
      return admin.economicsTable(this.ctx)
    },
    auctions: (filter: { status?: AuctionStatus | 'ALL'; q?: string }) => {
      this.sync()
      return admin.listAuctions(this.ctx, filter)
    },
    auctionDetail: (id: string) => {
      this.sync()
      return admin.auctionDetail(this.ctx, id)
    },
    createAuction: (input: admin.CreateAuctionInput, actor: admin.AdminActorInput) =>
      admin.createAuction(this.ctx, input, actor, this.sync()),
    updateAuction: (
      id: string,
      patch: AuctionRulesPatch,
      meta: { featured?: boolean; title?: string; description?: string | null },
      actor: admin.AdminActorInput,
    ) =>
      this.locks.withLock(`auction:${id}`, async () =>
        admin.updateAuctionRules(this.ctx, id, patch, meta, actor, this.sync()),
      ),
    transitionAuction: (
      id: string,
      to: AuctionStatus,
      reason: string | undefined,
      actor: admin.AdminActorInput,
    ) =>
      this.locks.withLock(`auction:${id}`, async () =>
        admin.transitionAuction(this.ctx, id, to, reason, actor, this.sync()),
      ),
    setKillSwitch: (active: boolean, reason: string, actor: admin.AdminActorInput) =>
      admin.setAutoBidKillSwitch(this.ctx, active, reason, actor, this.sync()),
    products: (q?: string, category?: string) => {
      this.sync()
      return admin.productRows(this.ctx, q, category)
    },
    product: (id: string) => this.state.products.get(id) ?? null,
    saveProduct: (id: string | null, input: admin.ProductInput, actor: admin.AdminActorInput) =>
      admin.saveProduct(this.ctx, id, input, actor, this.sync()),
    inventory: () => {
      this.sync()
      return admin.inventoryOverview(this.ctx)
    },
    adjustInventory: (
      productId: string,
      quantity: number,
      reason: string,
      actor: admin.AdminActorInput,
    ) => admin.adjustInventory(this.ctx, productId, quantity, reason, actor, this.sync()),
    suppliers: () => {
      this.sync()
      return admin.suppliersOverview(this.ctx)
    },
    orders: (filter: Parameters<typeof admin.listOrders>[1]) => {
      this.sync()
      return admin.listOrders(this.ctx, filter)
    },
    order: (id: string) => {
      this.sync()
      const order = this.state.orders.get(id)
      return order ? orderView(this.ctx, order) : null
    },
    fulfilment: () => admin.fulfilmentBoard(this.ctx, this.sync()),
    updateOrderStatus: (
      id: string,
      to: OrderStatus,
      note: string | null,
      actor: admin.AdminActorInput,
    ) => admin.updateOrderStatus(this.ctx, id, to, note, actor, this.sync()),
    refundOrder: (
      id: string,
      amountMinor: number | undefined,
      reason: string,
      actor: admin.AdminActorInput,
    ) =>
      this.locks.withLock(`refund:${id}`, async () =>
        admin.refundOrder(this.ctx, id, amountMinor, reason, actor, this.sync()),
      ),
    payments: () => admin.paymentsOverview(this.ctx, this.sync()),
    /** The captured (refundable) payment for an order, if any. */
    orderPayment: (orderId: string) =>
      this.state.payments.find(
        (payment) =>
          payment.orderId === orderId &&
          (payment.status === 'SUCCEEDED' || payment.status === 'PARTIALLY_REFUNDED'),
      ) ?? null,
    promotions: () => admin.promotionsOverview(this.ctx, this.sync()),
    createPromotion: (input: admin.PromotionInput, actor: admin.AdminActorInput) =>
      admin.createPromotion(this.ctx, input, actor, this.sync()),
    setPromotionStatus: (id: string, status: Promotion['status'], actor: admin.AdminActorInput) =>
      admin.setPromotionStatus(this.ctx, id, status, actor, this.sync()),
    customers: (q?: string) => {
      this.sync()
      return admin.customersOverview(this.ctx, q)
    },
    tickets: (status?: TicketStatus | 'ALL') => {
      this.sync()
      return this.state.tickets
        .filter((ticket) => !status || status === 'ALL' || ticket.status === status)
        .sort((a, b) => b.updatedAt - a.updatedAt)
    },
    updateTicket: (
      id: string,
      input: { status?: TicketStatus; assignee?: string | null; reply?: string },
      actor: admin.AdminActorInput,
    ) => admin.updateTicket(this.ctx, id, input, actor, this.sync()),
    fraudCases: () => {
      this.sync()
      return [...this.state.fraudCases].sort((a, b) => b.assessment.score - a.assessment.score)
    },
    decideFraud: (
      id: string,
      action: RiskAction | 'CLEAR',
      note: string,
      actor: admin.AdminActorInput,
    ) => admin.decideFraudCase(this.ctx, id, action, note, actor, this.sync()),
    audit: (query: AuditQuery) => admin.queryAudit(this.ctx, query),
    adjustWallet: (userId: string, credits: number, reason: string, actor: admin.AdminActorInput) =>
      admin.adjustWallet(this.ctx, userId, credits, reason, actor, this.sync()),
    suppliersList: () => this.state.suppliers,
    killSwitchActive: () => this.state.autobidKillSwitch,
    categories: () => this.state.categories,
    brands: () => this.state.brands,
    productsForSelect: () =>
      this.activeProducts()
        .filter((product) => product.auctionEligible)
        .map((product) => ({
          id: product.id,
          name: product.name,
          referencePriceMinor: product.referencePriceMinor,
          available: availableStock(this.state, product.id),
        })),
  }

  health() {
    this.sync()
    const statuses: Record<string, number> = {}
    for (const record of this.state.auctions.values())
      statuses[record.state.status] = (statuses[record.state.status] ?? 0) + 1
    return {
      auctions: statuses,
      products: this.state.products.size,
      sessionAccounts: this.state.accounts.size,
      orders: this.state.orders.size,
      auditEvents: this.state.audit.size,
      lastSyncAt: this.state.lastSyncAt,
      bootAt: this.state.bootAt,
    }
  }
}

export { bidView }
