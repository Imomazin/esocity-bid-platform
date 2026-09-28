import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/domain/notifications'
import type { Address, Order, OrderLine, OrderStatus } from '@/domain/orders'
import type { ResponsibleUseLimits } from '@/domain/responsible-use'
import type { SupportTicket } from '@/domain/support'
import type { RewardEntry } from '@/domain/rewards'
import {
  collectExpiries,
  planDebit,
  PROMOTIONAL_CREDIT_VALIDITY_MS,
  type CreditBucket,
  type LedgerEntry,
} from '@/domain/wallet'
import { TERMS_VERSION } from '@/lib/config/market'
import { newId, shortReference } from '@/lib/ids'
import { DAY, HOUR, MINUTE } from '@/lib/time'
import { demoTrackingNumber } from '@/server/providers/shipping'

import { audit, type Ctx } from './context'
import { BONUS_CREDIT_VALIDITY_DAYS } from './data/commerce'
import { memberHandle } from './data/people'
import { AUCTION_SERIES } from './data/series'
import { buildOrder, recordPayment, storeOrder } from './orders'
import { MAX_SESSION_ACCOUNTS, type DemoAccount, type WatchItem } from './state'
import { seriesCycleAt } from './world'

export const DEMO_TOP_UP_CREDITS = 50

class LedgerBuilder {
  readonly entries: LedgerEntry[] = []
  constructor(private readonly userId: string) {}

  private expire(at: number) {
    this.entries.push(...collectExpiries(this.entries, this.userId, at, newId))
  }

  grant(
    type: LedgerEntry['type'],
    bucket: CreditBucket,
    credits: number,
    at: number,
    description: string,
    expiresInMs: number | null = null,
    reference: LedgerEntry['reference'] = null,
  ) {
    this.expire(at)
    const id = newId()
    this.entries.push({
      id,
      userId: this.userId,
      type,
      bucket,
      credits,
      createdAt: at,
      expiresAt:
        bucket === 'PROMOTIONAL' ? at + (expiresInMs ?? PROMOTIONAL_CREDIT_VALIDITY_MS) : null,
      lotId: bucket === 'PROMOTIONAL' ? id : null,
      description,
      reference,
      idempotencyKey: null,
    })
  }

  /** Spends `bids` single-credit bids one by one; returns credits spent per bucket. */
  spend(bids: number, start: number, spacingMs: number, description: string, auctionId: string) {
    const spent = { PURCHASED: 0, PROMOTIONAL: 0 }
    for (let i = 0; i < bids; i += 1) {
      const at = start + i * spacingMs
      this.expire(at)
      const bidId = newId()
      for (const allocation of planDebit(this.entries, 1, at)) {
        this.entries.push({
          id: newId(),
          userId: this.userId,
          type: 'AUCTION_BID',
          bucket: allocation.bucket,
          credits: -allocation.credits,
          createdAt: at,
          expiresAt: null,
          lotId: allocation.lotId,
          description,
          reference: { type: 'BID', id: bidId },
          idempotencyKey: null,
        })
        spent[allocation.bucket] += allocation.credits
      }
    }
    void auctionId
    return spent
  }

  finish(now: number) {
    this.expire(now)
    return this.entries.sort((a, b) => a.createdAt - b.createdAt)
  }
}

function line(ctx: Ctx, slug: string, unitPriceMinor: number, quantity = 1): OrderLine {
  const product = ctx.state.productsBySlug.get(slug)!
  return {
    productId: product.id,
    productSlug: product.slug,
    name: product.name,
    brandName: product.brandName,
    quantity,
    unitPriceMinor,
    lineTotalMinor: unitPriceMinor * quantity,
    shippingClass: product.shippingClass,
  }
}

function withTimeline(order: Order, statuses: [OrderStatus, number, string | null][]): Order {
  const events = [...order.events]
  for (const [status, at, note] of statuses)
    events.push({ status, at, note, actor: 'Fulfilment (demo)' })
  const last = statuses[statuses.length - 1]
  return {
    ...order,
    events,
    status: last ? last[0] : order.status,
    updatedAt: last ? last[1] : order.updatedAt,
  }
}

function vat(totalMinor: number): number {
  return Math.round((totalMinor * 2_000) / 12_000)
}

export function createSessionAccount(ctx: Ctx, sessionId: string, now: number): DemoAccount {
  const { state } = ctx
  const id = sessionId
  const handle = memberHandle(id)
  const home: Address = {
    id: newId(),
    label: 'Home',
    fullName: 'Demo Member',
    line1: '12 Harbour Street',
    line2: 'Flat 3',
    city: 'Manchester',
    postcode: 'M1 2AB',
    country: 'United Kingdom',
    phone: '+44 7700 900123',
    isDefault: true,
  }
  const work: Address = {
    id: newId(),
    label: 'Work',
    fullName: 'Demo Member',
    line1: '1 Canal Walk',
    line2: null,
    city: 'Manchester',
    postcode: 'M4 4HQ',
    country: 'United Kingdom',
    phone: null,
    isDefault: false,
  }
  const limits: ResponsibleUseLimits = {
    dailyBidLimit: 250,
    weeklyBidLimit: 900,
    monthlyBidPurchaseBudgetMinor: 15_000,
    coolOffUntil: null,
    spendingNotifications: true,
    bidUseNotifications: true,
    pendingChanges: [],
    updatedAt: now - 25 * DAY,
  }

  const account: DemoAccount = {
    id,
    kind: 'SESSION',
    createdAt: now - 42 * DAY,
    lastSeenAt: now,
    displayName: 'Demo Member',
    handle,
    profile: {
      firstName: 'Demo',
      lastName: 'Member',
      email: 'demo.member@example.com',
      phone: '+44 7700 900123',
      marketingOptIn: false,
      ageVerified: true,
    },
    market: 'UK',
    addresses: [home, work],
    preferences: {
      theme: 'system',
      notifications: structuredClone(DEFAULT_NOTIFICATION_PREFERENCES),
      interests: ['electronics', 'kitchen', 'watches'],
      currency: 'GBP',
      region: 'UK',
    },
    limits,
    ledger: [],
    rewards: [],
    watchlist: [],
    cart: [],
    notifications: [],
    orderIds: [],
    viewedCategories: new Set(['electronics', 'gaming', 'kitchen', 'watches', 'fashion', 'home']),
    viewedProducts: [],
    bidTimestamps: [],
    recoveredAuctions: new Set(),
    previousWins: 2,
    bidPackSpend: [
      { at: now - 35 * DAY, amountMinor: 3_300 },
      { at: now - 5 * DAY, amountMinor: 8_000 },
    ],
    promoRedemptions: new Map(),
    ticketIds: [],
    weeklyStreak: 4,
    restricted: null,
    // Entering the demo platform accepts the (demo) member terms.
    compliance: {
      termsAcceptedVersion: TERMS_VERSION,
      termsAcceptedAt: now,
      kycStatus: 'NOT_STARTED',
    },
    notificationKeys: new Set(),
    archivedBidding: [],
  }

  // --- Bid Wallet history (built through the real ledger functions) ---
  const archived = (key: string) => `archived-${key}-${id.slice(0, 8)}`
  const ledger = new LedgerBuilder(id)
  const bonusValidity = BONUS_CREDIT_VALIDITY_DAYS * DAY
  ledger.grant('PROMOTIONAL_CREDIT', 'PROMOTIONAL', 50, now - 40 * DAY, 'Welcome bonus', 30 * DAY)
  ledger.spend(18, now - 38 * DAY, 45_000, 'Bid · Norland Audio Pods Pro', archived('pods'))
  ledger.grant(
    'BID_PACK_PURCHASE',
    'PURCHASED',
    150,
    now - 35 * DAY,
    'Popular pack (150 bids)',
    null,
    { type: 'BID_PACKAGE_ORDER', id: archived('pack-popular') },
  )
  ledger.grant(
    'PROMOTIONAL_CREDIT',
    'PROMOTIONAL',
    10,
    now - 35 * DAY + MINUTE,
    'Popular pack bonus bids',
    bonusValidity,
  )
  ledger.spend(24, now - 30 * DAY, 38_000, 'Bid · Vireo Lumina 65" 4K OLED TV', archived('tv'))
  ledger.spend(
    23,
    now - 12 * DAY - 2 * HOUR,
    52_000,
    'Bid · Tempo Fit 3 Fitness Tracker',
    archived('tracker'),
  )
  ledger.spend(11, now - 7 * DAY, 60_000, 'Bid · Halden Air 14', archived('laptop'))
  ledger.grant(
    'BID_REFUND',
    'PURCHASED',
    11,
    now - 6 * DAY,
    'Refund · Halden Air 14 (auction cancelled: supplier stock issue)',
    null,
    { type: 'AUCTION', id: archived('laptop') },
  )
  ledger.grant(
    'BID_PACK_PURCHASE',
    'PURCHASED',
    400,
    now - 5 * DAY,
    'Power pack (400 bids)',
    null,
    { type: 'BID_PACKAGE_ORDER', id: archived('pack-power') },
  )
  ledger.grant(
    'PROMOTIONAL_CREDIT',
    'PROMOTIONAL',
    50,
    now - 5 * DAY + MINUTE,
    'Power pack bonus bids',
    bonusValidity,
  )
  ledger.grant(
    'ADMIN_ADJUSTMENT',
    'PROMOTIONAL',
    5,
    now - 4 * DAY,
    'Goodwill credit · support ticket ESB-T-1042',
    30 * DAY,
    { type: 'SUPPORT_TICKET', id: archived('ticket') },
  )
  const headphones = ledger.spend(
    38,
    now - 3 * DAY,
    41_000,
    'Bid · Norland Audio QuietSphere 700',
    archived('headphones'),
  )
  for (const bucket of ['PURCHASED', 'PROMOTIONAL'] as const) {
    if (headphones[bucket] > 0) {
      ledger.grant(
        'BUY_NOW_RECOVERY',
        bucket,
        headphones[bucket],
        now - 2 * DAY,
        'Buy Now recovery · Norland Audio QuietSphere 700',
        30 * DAY,
        { type: 'AUCTION', id: archived('headphones') },
      )
    }
  }
  ledger.grant(
    'PROMOTIONAL_CREDIT',
    'PROMOTIONAL',
    10,
    now - 1 * DAY,
    'Rewards redemption (500 points)',
    30 * DAY,
    { type: 'REWARD_REDEMPTION', id: archived('redeem') },
  )
  ledger.spend(
    9,
    now - 26 * HOUR - 6 * MINUTE,
    35_000,
    'Bid · Crema & Co. Precision Pour-Over Kettle',
    archived('kettle'),
  )
  ledger.grant(
    'PROMOTIONAL_CREDIT',
    'PROMOTIONAL',
    DEMO_TOP_UP_CREDITS,
    now,
    'Demo wallet top-up',
    30 * DAY,
  )
  account.ledger = ledger.finish(now)
  account.recoveredAuctions.add(archived('headphones'))
  account.archivedBidding = [
    {
      auctionId: archived('kettle'),
      title: 'Crema & Co. Precision Pour-Over Kettle',
      bids: 9,
      lastBidAt: now - 26 * HOUR - 6 * MINUTE,
      outcome: 'WON',
      status: 'COMPLETED',
    },
    {
      auctionId: archived('headphones'),
      title: 'Norland Audio QuietSphere 700',
      bids: 38,
      lastBidAt: now - 3 * DAY,
      outcome: 'LOST',
      status: 'COMPLETED',
    },
    {
      auctionId: archived('laptop'),
      title: 'Halden Air 14',
      bids: 11,
      lastBidAt: now - 7 * DAY,
      outcome: 'REFUNDED',
      status: 'CANCELLED',
    },
    {
      auctionId: archived('tracker'),
      title: 'Tempo Fit 3 Fitness Tracker',
      bids: 23,
      lastBidAt: now - 12 * DAY - 2 * HOUR,
      outcome: 'WON',
      status: 'COMPLETED',
    },
    {
      auctionId: archived('tv'),
      title: 'Vireo Lumina 65" 4K OLED TV',
      bids: 24,
      lastBidAt: now - 30 * DAY,
      outcome: 'LOST',
      status: 'COMPLETED',
    },
    {
      auctionId: archived('pods'),
      title: 'Norland Audio Pods Pro',
      bids: 18,
      lastBidAt: now - 38 * DAY,
      outcome: 'LOST',
      status: 'COMPLETED',
    },
  ]

  // --- Orders ---
  const card = 'Demo card (simulated)'
  const paid = (at: number) => ({
    provider: 'demo',
    status: 'SUCCEEDED' as const,
    reference: `demo_pi_${newId()}`,
    methodLabel: card,
    paidAt: at,
  })
  const orders: Order[] = []

  const marketplaceAt = now - 20 * DAY
  const candle = line(ctx, 'hearth-hollow-soy-candle-trio', 5_800)
  const powerBank = line(ctx, 'terrace-20000mah-power-bank', 7_900)
  let order = buildOrder({
    userId: id,
    customerName: account.displayName,
    source: 'MARKETPLACE',
    lines: [candle, powerBank],
    totals: {
      subtotalMinor: 13_700,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: vat(13_700),
      totalMinor: 13_700,
    },
    promotionCode: null,
    recovery: null,
    address: home,
    shippingMethod: 'STANDARD',
    auctionId: null,
    dropId: null,
    status: 'PAID',
    createdAt: marketplaceAt,
    paymentDueAt: null,
    payment: paid(marketplaceAt),
    simulated: false,
    actor: 'Demo Member',
  })
  order = withTimeline(order, [
    ['PROCESSING', marketplaceAt + 2 * HOUR, null],
    ['PACKED', marketplaceAt + 20 * HOUR, null],
    ['SHIPPED', marketplaceAt + 26 * HOUR, 'Collected by carrier'],
    ['DELIVERED', marketplaceAt + 3 * DAY, 'Left with neighbour at No. 14'],
  ])
  orders.push({
    ...order,
    trackingNumber: demoTrackingNumber(order.id),
    carrier: 'Esocity Express (demo)',
  })

  const trackerAt = now - 12 * DAY
  order = buildOrder({
    userId: id,
    customerName: account.displayName,
    source: 'AUCTION_WIN',
    lines: [line(ctx, 'tempo-fit-3-tracker', 642)],
    totals: {
      subtotalMinor: 642,
      discountMinor: 0,
      shippingMinor: 399,
      taxMinor: vat(1_041),
      totalMinor: 1_041,
    },
    promotionCode: null,
    recovery: null,
    address: home,
    shippingMethod: 'STANDARD',
    auctionId: archived('tracker'),
    dropId: null,
    status: 'PAID',
    createdAt: trackerAt,
    paymentDueAt: trackerAt + 72 * HOUR,
    payment: paid(trackerAt + 3 * HOUR),
    simulated: false,
    actor: 'Demo Member',
  })
  order = withTimeline(order, [
    ['PROCESSING', trackerAt + 5 * HOUR, null],
    ['PACKED', trackerAt + 22 * HOUR, null],
    ['SHIPPED', trackerAt + 30 * HOUR, 'Collected by carrier'],
    ['DELIVERED', trackerAt + 3 * DAY, null],
  ])
  orders.push({
    ...order,
    trackingNumber: demoTrackingNumber(order.id),
    carrier: 'Esocity Express (demo)',
  })

  const controllerAt = now - 16 * DAY
  order = buildOrder({
    userId: id,
    customerName: account.displayName,
    source: 'MARKETPLACE',
    lines: [line(ctx, 'vanta-pro-wireless-controller', 6_499)],
    totals: {
      subtotalMinor: 6_499,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: vat(6_499),
      totalMinor: 6_499,
    },
    promotionCode: null,
    recovery: null,
    address: home,
    shippingMethod: 'STANDARD',
    auctionId: null,
    dropId: null,
    status: 'PAID',
    createdAt: controllerAt,
    paymentDueAt: null,
    payment: paid(controllerAt),
    simulated: false,
    actor: 'Demo Member',
  })
  order = withTimeline(order, [
    ['PROCESSING', controllerAt + 1 * HOUR, null],
    ['PACKED', controllerAt + 18 * HOUR, null],
    ['SHIPPED', controllerAt + 24 * HOUR, null],
    ['DELIVERED', controllerAt + 2 * DAY, null],
    ['REFUNDED', controllerAt + 8 * DAY, 'Returned within 30 days — refund issued'],
  ])
  orders.push({
    ...order,
    trackingNumber: demoTrackingNumber(order.id),
    carrier: 'Esocity Express (demo)',
    payment: { ...order.payment, status: 'REFUNDED' },
  })

  const buyNowAt = now - 2 * DAY
  order = buildOrder({
    userId: id,
    customerName: account.displayName,
    source: 'AUCTION_BUY_NOW',
    lines: [line(ctx, 'norland-quietsphere-700', 31_900)],
    totals: {
      subtotalMinor: 31_900,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: vat(31_900),
      totalMinor: 31_900,
    },
    promotionCode: null,
    recovery: {
      mode: 'RETURN_BIDS',
      credits: headphones.PURCHASED + headphones.PROMOTIONAL,
      valueMinor: (headphones.PURCHASED + headphones.PROMOTIONAL) * 20,
    },
    address: home,
    shippingMethod: 'EXPRESS',
    auctionId: archived('headphones'),
    dropId: null,
    status: 'PAID',
    createdAt: buyNowAt,
    paymentDueAt: null,
    payment: paid(buyNowAt),
    simulated: false,
    actor: 'Demo Member',
  })
  order = withTimeline(order, [
    ['PROCESSING', buyNowAt + 1 * HOUR, null],
    ['PACKED', buyNowAt + 6 * HOUR, null],
    ['SHIPPED', buyNowAt + 20 * HOUR, 'Collected by carrier'],
  ])
  orders.push({
    ...order,
    trackingNumber: demoTrackingNumber(order.id),
    carrier: 'Esocity Priority (demo)',
  })

  const dropAt = now - 3 * HOUR
  order = buildOrder({
    userId: id,
    customerName: account.displayName,
    source: 'FLASH_DROP',
    lines: [line(ctx, 'maison-elan-nuit-absolue-edp-100ml', 9_900)],
    totals: {
      subtotalMinor: 9_900,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: vat(9_900),
      totalMinor: 9_900,
    },
    promotionCode: null,
    recovery: null,
    address: home,
    shippingMethod: 'STANDARD',
    auctionId: null,
    dropId: 'nuit-absolue',
    status: 'PAID',
    createdAt: dropAt,
    paymentDueAt: null,
    payment: paid(dropAt),
    simulated: false,
    actor: 'Demo Member',
  })
  orders.push(
    withTimeline(order, [['PROCESSING', dropAt + 40 * MINUTE, 'Allocated from drop stock']]),
  )

  const kettleAt = now - 26 * HOUR
  order = buildOrder({
    userId: id,
    customerName: account.displayName,
    source: 'AUCTION_WIN',
    lines: [line(ctx, 'crema-pour-over-kettle', 387)],
    totals: {
      subtotalMinor: 387,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: 0,
      totalMinor: 387,
    },
    promotionCode: null,
    recovery: null,
    address: home,
    shippingMethod: 'STANDARD',
    auctionId: archived('kettle'),
    dropId: null,
    status: 'PENDING_PAYMENT',
    createdAt: kettleAt,
    paymentDueAt: kettleAt + 72 * HOUR,
    payment: {
      provider: 'demo',
      status: 'PENDING',
      reference: null,
      methodLabel: null,
      paidAt: null,
    },
    simulated: false,
    actor: 'Auction engine',
  })
  orders.push(order)

  for (const item of orders) {
    storeOrder(state, item, account)
    if (item.status === 'PENDING_PAYMENT') state.progressingOrders.add(item.id)
    if (item.payment.status !== 'PENDING') {
      const payment = recordPayment(state, {
        providerReference: item.payment.reference ?? `demo_pi_${newId()}`,
        userId: id,
        customerName: account.displayName,
        kind: 'ORDER',
        orderId: item.id,
        bidPackOrderId: null,
        amountMinor: item.totalMinor,
        currency: 'GBP',
        status: item.payment.status === 'REFUNDED' ? 'REFUNDED' : 'SUCCEEDED',
        provider: 'demo',
        methodLabel: card,
        createdAt: item.payment.paidAt ?? item.createdAt,
        simulated: true,
      })
      if (item.status === 'REFUNDED') {
        payment.refundedMinor = item.totalMinor
        state.refunds.unshift({
          id: newId(),
          paymentId: payment.id,
          orderId: item.id,
          amountMinor: item.totalMinor,
          reason: 'Customer return within 30 days',
          status: 'SUCCEEDED',
          providerReference: `demo_re_${newId()}`,
          createdAt: controllerAt + 8 * DAY,
          actor: 'Returns desk',
        })
      }
    }
  }
  const [marketplace, tracker, controller, buyNow, drop, kettle] = orders as [
    Order,
    Order,
    Order,
    Order,
    Order,
    Order,
  ]

  // --- Rewards ---
  const rewards: RewardEntry[] = [
    {
      id: newId(),
      type: 'EARN_REFERRAL',
      points: 500,
      at: now - 50 * DAY,
      description: 'Referral bonus — a friend joined',
      reference: { type: 'REFERRAL', id: archived('referral') },
    },
    {
      id: newId(),
      type: 'EARN_ACHIEVEMENT',
      points: 250,
      at: now - 45 * DAY,
      description: 'Birthday bonus',
      reference: { type: 'ACHIEVEMENT', id: 'birthday' },
    },
    {
      id: newId(),
      type: 'EARN_ACHIEVEMENT',
      points: 50,
      at: now - 38 * DAY,
      description: 'Achievement unlocked: First Bid',
      reference: { type: 'ACHIEVEMENT', id: 'first-bid' },
    },
    {
      id: newId(),
      type: 'EARN_ACHIEVEMENT',
      points: 150,
      at: now - 25 * DAY,
      description: 'Achievement unlocked: In Control',
      reference: { type: 'ACHIEVEMENT', id: 'in-control' },
    },
    {
      id: newId(),
      type: 'EARN_PURCHASE',
      points: 137,
      at: marketplace.createdAt,
      description: `Order ${marketplace.reference}`,
      reference: { type: 'ORDER', id: marketplace.id },
    },
    {
      id: newId(),
      type: 'EARN_ACHIEVEMENT',
      points: 75,
      at: now - 18 * DAY,
      description: 'Achievement unlocked: Explorer',
      reference: { type: 'ACHIEVEMENT', id: 'explorer' },
    },
    {
      id: newId(),
      type: 'EARN_PURCHASE',
      points: 71,
      at: controller.createdAt,
      description: `Order ${controller.reference}`,
      reference: { type: 'ORDER', id: controller.id },
    },
    {
      id: newId(),
      type: 'EARN_ACHIEVEMENT',
      points: 200,
      at: tracker.createdAt,
      description: 'Achievement unlocked: Winner’s Circle',
      reference: { type: 'ACHIEVEMENT', id: 'first-win' },
    },
    {
      id: newId(),
      type: 'EARN_PURCHASE',
      points: 6,
      at: tracker.createdAt + 3 * HOUR,
      description: `Order ${tracker.reference}`,
      reference: { type: 'ORDER', id: tracker.id },
    },
    {
      id: newId(),
      type: 'ADJUST',
      points: -71,
      at: controller.createdAt + 8 * DAY,
      description: `Points reversed — ${controller.reference} refunded`,
      reference: { type: 'ORDER', id: controller.id },
    },
    {
      id: newId(),
      type: 'EARN_ACHIEVEMENT',
      points: 100,
      at: now - 8 * DAY,
      description: 'Achievement unlocked: Regular',
      reference: { type: 'ACHIEVEMENT', id: 'regular' },
    },
    {
      id: newId(),
      type: 'EARN_PURCHASE',
      points: 350,
      at: buyNow.createdAt,
      description: `Order ${buyNow.reference}`,
      reference: { type: 'ORDER', id: buyNow.id },
    },
    {
      id: newId(),
      type: 'EARN_ACHIEVEMENT',
      points: 100,
      at: buyNow.createdAt,
      description: 'Achievement unlocked: Smart Saver',
      reference: { type: 'ACHIEVEMENT', id: 'smart-saver' },
    },
    {
      id: newId(),
      type: 'REDEEM',
      points: -500,
      at: now - 1 * DAY,
      description: 'Redeemed: 10 promotional bids',
      reference: { type: 'REDEMPTION', id: archived('redeem') },
    },
    {
      id: newId(),
      type: 'EARN_PURCHASE',
      points: 108,
      at: drop.createdAt,
      description: `Order ${drop.reference}`,
      reference: { type: 'ORDER', id: drop.id },
    },
  ]
  account.rewards = rewards

  // --- Watchlist ---
  const watch: WatchItem[] = []
  for (const key of ['oled-tv', 'luxury-watch', 'flagship-phone']) {
    const series = AUCTION_SERIES.find((item) => item.key === key)!
    const cycle = seriesCycleAt(series, now)
    const record = [...state.auctions.values()].find(
      (item) => item.seriesKey === key && item.cycle === cycle,
    )
    if (record) {
      watch.push({
        type: 'AUCTION',
        targetId: record.state.id,
        addedAt: now - 2 * HOUR,
        priceAtAddMinor: null,
        notify: true,
      })
      record.watchers.add(id)
    }
  }
  for (const [slug, premium] of [
    ['skylark-mini-4-drone', 3_000],
    ['halden-air-14', 0],
  ] as const) {
    const product = state.productsBySlug.get(slug)
    if (product)
      watch.push({
        type: 'PRODUCT',
        targetId: product.id,
        addedAt: now - 6 * DAY,
        priceAtAddMinor: product.buyNowPriceMinor + premium,
        notify: true,
      })
  }
  watch.push({
    type: 'DROP',
    targetId: 'console-silver',
    addedAt: now - 1 * DAY,
    priceAtAddMinor: null,
    notify: true,
  })
  account.watchlist = watch

  // --- Notifications ---
  const read = (at: number) => at + 10 * MINUTE
  account.notifications = [
    {
      id: newId(),
      userId: id,
      type: 'SYSTEM',
      title: 'Welcome to the Esocity Bid demo',
      body: `We added ${DEMO_TOP_UP_CREDITS} demo bid credits to your wallet. Bidders, payments and deliveries here are simulated — no real money is used.`,
      href: '/how-it-works',
      createdAt: now,
      readAt: null,
    },
    {
      id: newId(),
      userId: id,
      type: 'ORDER_PAID',
      title: `Payment confirmed for ${drop.reference}`,
      body: 'Maison Élan Nuit Absolue EDP — Flash Drop order is being prepared.',
      href: `/orders/${drop.id}`,
      createdAt: drop.createdAt,
      readAt: null,
    },
    {
      id: newId(),
      userId: id,
      type: 'AUCTION_WON',
      title: 'You won Crema & Co. Precision Pour-Over Kettle!',
      body: 'Final price £3.87. Complete payment within 72 hours to secure it.',
      href: `/checkout?order=${kettle.id}`,
      createdAt: kettle.createdAt,
      readAt: null,
    },
    {
      id: newId(),
      userId: id,
      type: 'ORDER_SHIPPED',
      title: `Order ${buyNow.reference} is on its way`,
      body: `Tracking ${demoTrackingNumber(buyNow.id)} with Esocity Priority (demo).`,
      href: `/orders/${buyNow.id}`,
      createdAt: buyNow.createdAt + 20 * HOUR,
      readAt: read(buyNow.createdAt + 20 * HOUR),
    },
    {
      id: newId(),
      userId: id,
      type: 'REWARD_EARNED',
      title: 'Achievement unlocked: Smart Saver',
      body: '+100 Esocity Rewards points for using Bid Credit Recovery.',
      href: '/rewards',
      createdAt: buyNow.createdAt,
      readAt: read(buyNow.createdAt),
    },
    {
      id: newId(),
      userId: id,
      type: 'SYSTEM',
      title: '11 bid credits refunded',
      body: 'Halden Air 14 auction was cancelled (supplier stock issue). Your bids were returned.',
      href: '/wallet',
      createdAt: now - 6 * DAY,
      readAt: read(now - 6 * DAY),
    },
  ]

  // --- Support tickets ---
  const ticketBase = {
    userId: id,
    customerName: account.displayName,
    simulated: false,
    assignee: 'Aisha (Support)',
  }
  const t1: SupportTicket = {
    ...ticketBase,
    id: newId(),
    reference: 'ESB-T-1042',
    category: 'delivery',
    subject: 'Delivery delayed for my tracker order',
    status: 'RESOLVED',
    priority: 'NORMAL',
    relatedReference: tracker.reference,
    createdAt: now - 5 * DAY,
    updatedAt: now - 4 * DAY,
    messages: [
      {
        id: newId(),
        author: 'CUSTOMER',
        authorName: 'Demo Member',
        body: 'My order was due yesterday but tracking has not updated.',
        at: now - 5 * DAY,
      },
      {
        id: newId(),
        author: 'AGENT',
        authorName: 'Aisha (Support)',
        body: 'Sorry about the delay — the carrier had a depot issue. It is now out for delivery, and we have added 5 goodwill bids to your wallet.',
        at: now - 4 * DAY,
      },
    ],
  }
  const t2: SupportTicket = {
    ...ticketBase,
    id: newId(),
    reference: 'ESB-T-1088',
    category: 'auction',
    subject: 'Question about bid recovery',
    status: 'WAITING_CUSTOMER',
    priority: 'NORMAL',
    relatedReference: buyNow.reference,
    createdAt: now - 1 * DAY,
    updatedAt: now - 20 * HOUR,
    messages: [
      {
        id: newId(),
        author: 'CUSTOMER',
        authorName: 'Demo Member',
        body: 'Were my bonus bids included when I bought the headphones with Buy Now?',
        at: now - 1 * DAY,
      },
      {
        id: newId(),
        author: 'AGENT',
        authorName: 'Aisha (Support)',
        body: 'Good question! This auction returned both purchased and promotional bids. Could you confirm which auction you mean so I can double-check the ledger entries?',
        at: now - 20 * HOUR,
      },
    ],
  }
  state.tickets.unshift(t2, t1)
  account.ticketIds = [t2.id, t1.id]

  state.accounts.set(id, account)
  enforceAccountCap(ctx)
  audit(ctx, {
    actor: { type: 'CUSTOMER', id, name: `Demo Member (${handle})` },
    action: 'session.demo_started',
    entityType: 'SESSION',
    entityId: id,
    summary: 'Demo member session started with seeded history',
    metadata: { topUpCredits: DEMO_TOP_UP_CREDITS },
    at: now,
  })
  void shortReference
  return account
}

function enforceAccountCap(ctx: Ctx): void {
  const { accounts } = ctx.state
  if (accounts.size <= MAX_SESSION_ACCOUNTS) return
  const oldest = [...accounts.values()]
    .sort((a, b) => a.lastSeenAt - b.lastSeenAt)
    .slice(0, accounts.size - MAX_SESSION_ACCOUNTS)
  for (const account of oldest) {
    accounts.delete(account.id)
    for (const orderId of account.orderIds) ctx.state.orders.delete(orderId)
  }
}

/** Removes a demo account and everything that belongs only to it ("Reset demo"). */
export function removeSessionAccount(ctx: Ctx, accountId: string): void {
  const account = ctx.state.accounts.get(accountId)
  if (!account) return
  for (const orderId of account.orderIds) ctx.state.orders.delete(orderId)
  ctx.state.tickets = ctx.state.tickets.filter((ticket) => ticket.userId !== accountId)
  for (const [ruleId, rule] of ctx.state.autobids)
    if (rule.userId === accountId && rule.status === 'ACTIVE') ctx.state.autobids.delete(ruleId)
  for (const record of ctx.state.auctions.values()) record.watchers.delete(accountId)
  ctx.state.accounts.delete(accountId)
}
