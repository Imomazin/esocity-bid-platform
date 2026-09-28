import type { Product } from '@/domain/catalog'
import type { FraudCase, FraudSignal, FraudSignalCode } from '@/domain/fraud'
import { assessRisk } from '@/domain/fraud'
import type { Order, OrderLine, OrderSource, OrderStatus } from '@/domain/orders'
import type { RewardTier } from '@/domain/rewards'
import type { SupportTicket, TicketCategory, TicketStatus } from '@/domain/support'
import { newId, shortReference } from '@/lib/ids'
import {
  chance,
  deterministicUuid,
  pick,
  pickWeighted,
  randomInt,
  rngFor,
  type Rng,
} from '@/lib/rng'
import { DAY, HOUR, MINUTE } from '@/lib/time'
import { demoTrackingNumber } from '@/server/providers/shipping'

import { appendInventory } from './context'
import { BID_PACKAGES } from './data/commerce'
import { FIRST_NAMES, LAST_NAMES, UK_CITIES } from './data/people'
import { AUCTION_SERIES } from './data/series'
import type { BidPackOrder, CustomerSummary, DailyMetric, DemoState, PaymentRecord } from './state'

const STAFF = [
  'Priya (Operations)',
  'Marcus (Merchandising)',
  'Elena (Finance)',
  'Aisha (Support)',
  'Tom (Administrator)',
]
const HISTORY_DAYS = 90
const BID_PACK_RECORD_DAYS = 7
const ORDER_RECORD_DAYS = 14
const AUCTION_WIN_RECORD_DAYS = 2
const REVENUE_PER_PURCHASED_CREDIT = 19

function tierFor(rng: Rng): RewardTier {
  return pickWeighted(rng, ['MEMBER', 'SILVER', 'GOLD', 'PLATINUM'] as const, [55, 28, 13, 4])
}

export function generateCustomers(anchorDay: number, now: number): CustomerSummary[] {
  const customers: CustomerSummary[] = []
  for (let i = 0; i < 600; i += 1) {
    const rng = rngFor('customer', i)
    const first = pick(rng, FIRST_NAMES)
    const last = pick(rng, LAST_NAMES)
    const tier = tierFor(rng)
    const scale = { MEMBER: 1, SILVER: 3.2, GOLD: 8, PLATINUM: 20 }[tier]
    const joinedAt = anchorDay - randomInt(rng, 3, 420) * DAY - randomInt(rng, 0, 23) * HOUR
    const status = chance(rng, 0.012)
      ? 'RESTRICTED'
      : chance(rng, 0.025)
        ? 'UNDER_REVIEW'
        : 'ACTIVE'
    customers.push({
      id: deterministicUuid('customer', i),
      name: `${first} ${last}`,
      email: `${first}.${last}${i}@example.com`.toLowerCase(),
      city: pick(rng, UK_CITIES),
      joinedAt,
      lastActiveAt: Math.min(now, now - Math.floor(rng() ** 3 * 40 * DAY)),
      tier,
      lifetimeSpendMinor: Math.round((4_000 + rng() * 26_000) * scale),
      orders: Math.max(1, Math.round((1 + rng() * 5) * Math.sqrt(scale))),
      bidsUsed: Math.round(rng() * 900 * Math.sqrt(scale)),
      bidPackSpendMinor: Math.round(rng() * 12_000 * Math.sqrt(scale)),
      wins: Math.round(rng() * 3 * Math.sqrt(scale)),
      status,
      riskClass: status === 'RESTRICTED' ? 'HIGH' : status === 'UNDER_REVIEW' ? 'MODERATE' : 'LOW',
      simulated: true,
    })
  }
  return customers
}

function statusForAge(rng: Rng, ageMs: number): OrderStatus {
  if (chance(rng, 0.02)) return 'CANCELLED'
  if (ageMs > 6 * DAY && chance(rng, 0.03)) return 'REFUNDED'
  if (ageMs < 4 * HOUR) return pick(rng, ['PAID', 'PROCESSING'] as const)
  if (ageMs < DAY) return pick(rng, ['PROCESSING', 'PACKED'] as const)
  if (ageMs < 2 * DAY) return pick(rng, ['PACKED', 'SHIPPED'] as const)
  if (ageMs < 5 * DAY) return pick(rng, ['SHIPPED', 'DELIVERED'] as const)
  return 'DELIVERED'
}

const FLOW: OrderStatus[] = ['PAID', 'PROCESSING', 'PACKED', 'SHIPPED', 'DELIVERED']

function timelineFor(status: OrderStatus, createdAt: number, rng: Rng): Order['events'] {
  const events: Order['events'] = [
    { status: 'PENDING_PAYMENT', at: createdAt, note: null, actor: 'Customer' },
  ]
  if (status === 'CANCELLED') {
    events.push({
      status: 'CANCELLED',
      at: createdAt + 20 * MINUTE,
      note: 'Payment not completed',
      actor: 'Payments',
    })
    return events
  }
  const target = status === 'REFUNDED' ? 'DELIVERED' : status
  let at = createdAt + randomInt(rng, 1, 4) * MINUTE
  for (const step of FLOW) {
    events.push({
      status: step,
      at,
      note: null,
      actor: step === 'PAID' ? 'Payments' : 'Fulfilment',
    })
    if (step === target) break
    at += randomInt(rng, 3, 20) * HOUR
  }
  if (status === 'REFUNDED')
    events.push({
      status: 'REFUNDED',
      at: at + randomInt(rng, 2, 5) * DAY,
      note: 'Return received',
      actor: 'Returns desk',
    })
  return events
}

interface GeneratedHistory {
  orders: Order[]
  payments: PaymentRecord[]
  refunds: DemoState['refunds']
  bidPackOrders: BidPackOrder[]
  daily: DailyMetric[]
}

interface HistoryContext {
  state: DemoState
  products: Product[]
  weights: number[]
  now: number
}

interface HistoricOrder {
  order: Order
  payment: PaymentRecord | null
  refund: DemoState['refunds'][number] | null
}

/**
 * Builds one simulated historic order. `unitOverride` fixes the price (used for auction wins,
 * whose final price comes from the auction estimate rather than the catalogue).
 */
function historicOrder(
  ctx: HistoryContext,
  orng: Rng,
  id: string,
  source: OrderSource,
  createdAt: number,
  dayIndex: number,
  unitOverride?: number,
): HistoricOrder {
  const customer = ctx.state.customers[Math.floor(orng() * ctx.state.customers.length)]!
  const lines: OrderLine[] = []
  const lineCount = source === 'MARKETPLACE' && chance(orng, 0.3) ? 2 : 1
  for (let l = 0; l < lineCount; l += 1) {
    const product = pickWeighted(orng, ctx.products, ctx.weights)
    let unit = product.buyNowPriceMinor
    if (unitOverride !== undefined) unit = unitOverride
    else if (source === 'FLASH_DROP')
      unit = Math.round(product.buyNowPriceMinor * (0.62 + orng() * 0.12))
    const quantity = source === 'MARKETPLACE' && chance(orng, 0.12) ? 2 : 1
    lines.push({
      productId: product.id,
      productSlug: product.slug,
      name: product.name,
      brandName: product.brandName,
      quantity,
      unitPriceMinor: unit,
      lineTotalMinor: unit * quantity,
      shippingClass: product.shippingClass,
    })
  }
  const subtotal = lines.reduce((total, item) => total + item.lineTotalMinor, 0)
  const promo =
    source === 'MARKETPLACE' && chance(orng, 0.12)
      ? pick(orng, ['SAVE5', 'FREESHIP', 'WELCOME10'] as const)
      : null
  const discount =
    promo === 'SAVE5' && subtotal >= 4_000
      ? 500
      : promo === 'WELCOME10'
        ? Math.min(3_000, Math.round(subtotal * 0.1))
        : 0
  const digital = lines.every((item) => item.shippingClass === 'DIGITAL')
  const shipping =
    digital || promo === 'FREESHIP' || subtotal - discount >= 5_000
      ? 0
      : pick(orng, [399, 399, 699, 999])
  const total = subtotal - discount + shipping
  const status = statusForAge(orng, ctx.now - createdAt)
  const events = timelineFor(status, createdAt, orng)
  const shipped = events.some((event) => event.status === 'SHIPPED')
  const exception =
    dayIndex <= 2 && status !== 'CANCELLED' && chance(orng, 0.02)
      ? pick(orng, [
          {
            code: 'ADDRESS_VERIFICATION',
            message: 'Postcode does not match street — awaiting customer confirmation',
          },
          { code: 'CARRIER_DELAY', message: 'Carrier reported depot delay (+1 day)' },
          {
            code: 'STOCK_DISCREPANCY',
            message: 'Pick failed: bin count mismatch — recount requested',
          },
        ])
      : null
  const order: Order = {
    id,
    reference: shortReference('ESB', id),
    userId: customer.id,
    customerName: customer.name,
    source,
    status,
    lines,
    currency: 'GBP',
    subtotalMinor: subtotal,
    discountMinor: discount,
    shippingMinor: shipping,
    taxMinor: Math.round((total * 2_000) / 12_000),
    totalMinor: total,
    promotionCode: promo,
    recovery:
      source === 'AUCTION_BUY_NOW' && chance(orng, 0.7)
        ? { mode: 'RETURN_BIDS', credits: randomInt(orng, 8, 90), valueMinor: 0 }
        : null,
    shippingAddress: {
      id: newId(),
      label: 'Home',
      fullName: customer.name,
      line1: `${randomInt(orng, 1, 220)} ${pick(orng, ['High Street', 'Station Road', 'Church Lane', 'Victoria Road', 'Park Avenue', 'Mill Lane'])}`,
      line2: null,
      city: customer.city,
      postcode: `${pick(orng, ['M', 'B', 'LS', 'G', 'BS', 'L', 'EH', 'CF', 'NE', 'SW', 'E', 'N'])}${randomInt(orng, 1, 20)} ${randomInt(orng, 1, 9)}${pick(orng, ['AB', 'DE', 'HJ', 'LN', 'PQ', 'RS', 'TU', 'WX'])}`,
      country: 'United Kingdom',
      phone: null,
      isDefault: true,
    },
    shippingMethod: shipping === 999 ? 'NEXT_DAY' : shipping === 699 ? 'EXPRESS' : 'STANDARD',
    payment: {
      provider: 'demo',
      status: status === 'CANCELLED' ? 'FAILED' : status === 'REFUNDED' ? 'REFUNDED' : 'SUCCEEDED',
      reference: `demo_pi_${id.slice(0, 18)}`,
      methodLabel: pick(orng, ['Demo card (simulated)', 'Demo digital wallet (simulated)']),
      paidAt: status === 'CANCELLED' ? null : createdAt + MINUTE,
    },
    auctionId: null,
    dropId: null,
    events,
    trackingNumber: shipped ? demoTrackingNumber(id) : null,
    carrier: shipped ? 'Esocity Express (demo)' : null,
    paymentDueAt: null,
    exception,
    createdAt,
    updatedAt: events[events.length - 1]!.at,
    simulated: true,
  }
  if (status === 'CANCELLED') return { order, payment: null, refund: null }
  const payment: PaymentRecord = {
    id: deterministicUuid('history-payment', id),
    providerReference: order.payment.reference!,
    userId: customer.id,
    customerName: customer.name,
    kind: 'ORDER',
    orderId: id,
    bidPackOrderId: null,
    amountMinor: total,
    currency: 'GBP',
    status: status === 'REFUNDED' ? 'REFUNDED' : 'SUCCEEDED',
    provider: 'demo',
    methodLabel: order.payment.methodLabel ?? 'Demo',
    refundedMinor: status === 'REFUNDED' ? total : 0,
    createdAt: createdAt + MINUTE,
    events: [{ status: 'SUCCEEDED', at: createdAt + MINUTE, note: null }],
    simulated: true,
  }
  let refund: HistoricOrder['refund'] = null
  if (status === 'REFUNDED') {
    const refundAt = events[events.length - 1]!.at
    payment.events.push({ status: 'REFUNDED', at: refundAt, note: 'Customer return' })
    refund = {
      id: deterministicUuid('history-refund', id),
      paymentId: payment.id,
      orderId: id,
      amountMinor: total,
      reason: pick(orng, [
        'Customer return within 30 days',
        'Item damaged in transit',
        'Changed mind (cooling-off period)',
      ]),
      status: 'SUCCEEDED',
      providerReference: `demo_re_${id.slice(0, 18)}`,
      createdAt: refundAt,
      actor: pick(orng, STAFF),
    }
  }
  return { order, payment, refund }
}

/**
 * Deterministic 90-day commerce history anchored to the current day.
 *
 * Daily metrics cover the whole window. Individual order records are materialised only for
 * recent days (commerce orders for ORDER_RECORD_DAYS, auction-win orders for
 * AUCTION_WIN_RECORD_DAYS) to keep the in-memory demo world small; older days are aggregates.
 */
export function generateHistory(state: DemoState, now: number): GeneratedHistory {
  const products = [...state.products.values()].filter((product) => product.status === 'ACTIVE')
  // Everyday purchases skew towards lower-priced items; auction wins follow auction popularity.
  const ctx: HistoryContext = {
    state,
    products,
    weights: products.map(
      (product) => product.popularity ** 2 / (product.buyNowPriceMinor / 100) ** 1.2,
    ),
    now,
  }
  const auctionProducts = products.filter((product) => product.auctionEligible)
  const auctionCtx: HistoryContext = {
    ...ctx,
    products: auctionProducts,
    weights: auctionProducts.map((product) => product.popularity ** 2),
  }
  const orders: Order[] = []
  const payments: PaymentRecord[] = []
  const refunds: DemoState['refunds'] = []
  const bidPackOrders: BidPackOrder[] = []
  const daily: DailyMetric[] = []

  const seriesPerDay = AUCTION_SERIES.map((series) => ({
    series,
    perDay: (24 * 60) / series.cycleMinutes,
  }))
  const expectedBidsPerInstance = (heat: number, closing: number, open: number) =>
    Math.round((open * 60) / (8 + 24 * (1 - heat)) + (closing * 60) / 5)

  for (let dayIndex = HISTORY_DAYS; dayIndex >= 0; dayIndex -= 1) {
    const day = state.anchorDay - dayIndex * DAY
    const rng = rngFor('history-day', day)
    const weekday = new Date(day).getUTCDay()
    const weekend = weekday === 0 || weekday === 6
    const growth = 1 + (HISTORY_DAYS - dayIndex) * 0.004
    const dayEnd = dayIndex === 0 ? now : day + DAY
    const fraction = Math.max(0, Math.min(1, (dayEnd - day) / DAY))
    const commerceOrders = Math.round((95 + rng() * 45) * (weekend ? 1.2 : 1) * growth * fraction)
    const recordCommerce = dayIndex < ORDER_RECORD_DAYS

    const metric: DailyMetric = {
      day,
      gmvMinor: 0,
      auctionRevenueMinor: 0,
      buyNowRevenueMinor: 0,
      marketplaceRevenueMinor: 0,
      dropRevenueMinor: 0,
      bidPackRevenueMinor: 0,
      refundsMinor: 0,
      orders: 0,
      newUsers: Math.round((42 + rng() * 45) * growth * fraction),
      activeUsers: 0,
      returningUsers: 0,
      auctionsCompleted: 0,
      bidsPlaced: 0,
      uniqueBidders: 0,
      sessions: 0,
      checkoutStarts: 0,
      checkoutCompletions: 0,
      bidPackViews: 0,
      bidPackPurchases: 0,
      dropViews: 0,
      dropPurchases: 0,
      buyNowViews: 0,
      buyNowPurchases: 0,
      watchlistAdds: 0,
      watchlistToBid: 0,
      supportTickets: Math.round((8 + rng() * 12) * fraction),
    }

    const include = (result: HistoricOrder, record: boolean) => {
      if (record) orders.push(result.order)
      if (!result.payment) return
      if (record) payments.push(result.payment)
      if (result.refund) {
        if (record) refunds.push(result.refund)
        metric.refundsMinor += result.refund.amountMinor
      }
      const { source, totalMinor } = result.order
      metric.orders += 1
      metric.gmvMinor += totalMinor
      if (source === 'AUCTION_WIN') metric.auctionRevenueMinor += totalMinor
      if (source === 'AUCTION_BUY_NOW') metric.buyNowRevenueMinor += totalMinor
      if (source === 'MARKETPLACE') metric.marketplaceRevenueMinor += totalMinor
      if (source === 'FLASH_DROP') metric.dropRevenueMinor += totalMinor
      if (source === 'FLASH_DROP') metric.dropPurchases += 1
      if (source === 'AUCTION_BUY_NOW') metric.buyNowPurchases += 1
    }

    for (let i = 0; i < commerceOrders; i += 1) {
      const orng = rngFor('history-order', day, i)
      const createdAt = day + Math.floor(orng() * (dayEnd - day))
      const source = pickWeighted(
        orng,
        ['MARKETPLACE', 'FLASH_DROP', 'AUCTION_BUY_NOW'] as OrderSource[],
        [58, 22, 20],
      )
      include(
        historicOrder(
          ctx,
          orng,
          deterministicUuid('history-order', day, i),
          source,
          createdAt,
          dayIndex,
        ),
        recordCommerce,
      )
    }

    // Auction activity estimated from the live schedule so economics line up with the world.
    let auctions = 0
    let bids = 0
    let winnerPayments = 0
    for (const { series, perDay } of seriesPerDay) {
      const instances = perDay * fraction * (0.92 + rng() * 0.16)
      const perInstance = expectedBidsPerInstance(
        series.heat,
        series.closingMinutes,
        series.openMinutes,
      )
      auctions += instances
      bids += instances * perInstance
      winnerPayments += instances * perInstance * series.incrementMinor
    }
    metric.auctionsCompleted = Math.round(auctions)
    metric.bidsPlaced = Math.round(bids * growth)
    metric.uniqueBidders = Math.round(metric.bidsPlaced / (70 + rng() * 25))
    // Every completed auction with a winner becomes an order at its final price. GMV counts
    // merchandise only (orders); bid pack revenue is reported separately.
    const wins = Math.round(metric.auctionsCompleted * 0.95)
    const averageWinnerPayment = wins > 0 ? (winnerPayments * growth) / wins : 0
    const recordWins = dayIndex < AUCTION_WIN_RECORD_DAYS
    for (let i = 0; i < wins; i += 1) {
      const orng = rngFor('history-auction-win', day, i)
      const createdAt = day + Math.floor(orng() * (dayEnd - day))
      const unit = Math.max(50, Math.round(averageWinnerPayment * (0.35 + orng() * 1.3)))
      if (recordWins) {
        include(
          historicOrder(
            auctionCtx,
            orng,
            deterministicUuid('history-auction-win', day, i),
            'AUCTION_WIN',
            createdAt,
            dayIndex,
            unit,
          ),
          true,
        )
      } else {
        // Older days: aggregate only (no record), with the same small cancellation rate.
        if (chance(orng, 0.02)) continue
        metric.orders += 1
        metric.gmvMinor += unit
        metric.auctionRevenueMinor += unit
      }
    }
    metric.bidPackRevenueMinor = Math.round(metric.bidsPlaced * 0.85 * REVENUE_PER_PURCHASED_CREDIT)
    metric.bidPackPurchases = Math.round(metric.bidPackRevenueMinor / 4_600)
    metric.activeUsers = Math.round(
      (metric.uniqueBidders + metric.orders * 4 + 1_100 * fraction) * (weekend ? 1.15 : 1),
    )
    metric.returningUsers = Math.max(0, metric.activeUsers - metric.newUsers)
    metric.sessions = Math.round(metric.activeUsers * (2.4 + rng() * 0.6))
    metric.checkoutCompletions = metric.orders
    metric.checkoutStarts = Math.round(metric.orders / (0.58 + rng() * 0.1))
    metric.bidPackViews = Math.round(metric.bidPackPurchases / (0.16 + rng() * 0.05))
    metric.dropViews = Math.round((metric.dropPurchases + 1) / (0.09 + rng() * 0.04))
    metric.buyNowViews = Math.round((metric.buyNowPurchases + 1) / (0.07 + rng() * 0.03))
    metric.watchlistAdds = Math.round(metric.activeUsers * (0.22 + rng() * 0.08))
    metric.watchlistToBid = Math.round(metric.watchlistAdds * (0.27 + rng() * 0.08))
    daily.push(metric)

    // Individual bid-pack order records for the most recent days (admin payments view).
    if (dayIndex < BID_PACK_RECORD_DAYS) {
      const count = Math.round(metric.bidPackPurchases * 0.35)
      for (let i = 0; i < count; i += 1) {
        const prng = rngFor('bid-pack-order', day, i)
        const pack = pickWeighted(prng, BID_PACKAGES, [30, 42, 20, 8])
        const customer = state.customers[Math.floor(prng() * state.customers.length)]!
        const createdAt = day + Math.floor(prng() * (dayEnd - day))
        const id = deterministicUuid('bid-pack-order', day, i)
        const failed = chance(prng, 0.03)
        const paymentId = deterministicUuid('bid-pack-payment', id)
        bidPackOrders.push({
          id,
          reference: shortReference('ESB-BP', id),
          userId: customer.id,
          customerName: customer.name,
          packageId: pack.id,
          packageName: pack.name,
          credits: pack.credits,
          bonusCredits: pack.bonusCredits,
          promoBonusCredits: 0,
          priceMinor: pack.priceMinor,
          discountMinor: 0,
          totalMinor: pack.priceMinor,
          promotionCode: null,
          paymentId,
          status: failed ? 'FAILED' : 'PAID',
          createdAt,
          simulated: true,
        })
        payments.push({
          id: paymentId,
          providerReference: `demo_pi_${id.slice(0, 18)}`,
          userId: customer.id,
          customerName: customer.name,
          kind: 'BID_PACK',
          orderId: null,
          bidPackOrderId: id,
          amountMinor: pack.priceMinor,
          currency: 'GBP',
          status: failed ? 'FAILED' : 'SUCCEEDED',
          provider: 'demo',
          methodLabel: 'Demo card (simulated)',
          refundedMinor: 0,
          createdAt,
          events: [
            {
              status: failed ? 'FAILED' : 'SUCCEEDED',
              at: createdAt,
              note: failed ? 'Simulated decline' : null,
            },
          ],
          simulated: true,
        })
      }
    }
  }

  orders.sort((a, b) => b.createdAt - a.createdAt)
  payments.sort((a, b) => b.createdAt - a.createdAt)
  refunds.sort((a, b) => b.createdAt - a.createdAt)
  bidPackOrders.sort((a, b) => b.createdAt - a.createdAt)
  return { orders, payments, refunds, bidPackOrders, daily }
}

function signal(code: FraudSignalCode, weight: number, detail: string, at: number): FraudSignal {
  return { code, weight, detail, observedAt: at }
}

export function generateFraudCases(state: DemoState, now: number): FraudCase[] {
  const specs: {
    signals: [FraudSignalCode, number, string][]
    status: FraudCase['status']
    hoursAgo: number
    decision?: { action: 'CLEAR' | 'THROTTLE' | 'BLOCK' | 'REVIEW'; note: string }
  }[] = [
    {
      signals: [
        ['BID_VELOCITY', 38, '64 bids in the last 60 seconds'],
        ['IMPOSSIBLE_FREQUENCY', 50, '5 bids placed less than 150ms apart'],
      ],
      status: 'OPEN',
      hoursAgo: 1,
    },
    {
      signals: [
        ['SHARED_DEVICE', 30, 'Device fingerprint seen on 3 other accounts (placeholder signal)'],
        ['PROMO_ABUSE', 25, 'WELCOME10 redeemed by 3 related accounts'],
      ],
      status: 'UNDER_REVIEW',
      hoursAgo: 5,
    },
    {
      signals: [
        ['PAYMENT_RISK', 40, 'Issuer risk indicator elevated (placeholder signal)'],
        [
          'ACCOUNT_ANOMALY',
          28,
          'New device, new delivery address and high-value order within 1 hour',
        ],
      ],
      status: 'THROTTLED',
      hoursAgo: 9,
      decision: {
        action: 'THROTTLE',
        note: 'Throttled bid-pack purchases pending ID verification.',
      },
    },
    {
      signals: [['REFUND_ABUSE', 32, 'Refund rate 34% over 90 days (platform median 3%)']],
      status: 'CLEARED',
      hoursAgo: 20,
      decision: {
        action: 'CLEAR',
        note: 'Refunds relate to a known courier issue in the area. No action needed.',
      },
    },
    {
      signals: [
        ['AUTOMATION_PATTERN', 45, 'Interval variation 2.1% across 20 bids'],
        ['BID_VELOCITY', 40, '71 bids in the last 60 seconds'],
        ['IMPOSSIBLE_FREQUENCY', 55, '9 bids placed less than 150ms apart'],
      ],
      status: 'OPEN',
      hoursAgo: 0.4,
    },
    {
      signals: [
        ['PROMO_ABUSE', 45, 'BIDS20 redeemed on 6 accounts sharing a payment instrument'],
        ['SHARED_DEVICE', 25, 'Shared device fingerprint (placeholder signal)'],
      ],
      status: 'OPEN',
      hoursAgo: 3,
    },
    {
      signals: [
        [
          'ACCOUNT_ANOMALY',
          30,
          'Password reset, new email and bid pack purchase within 20 minutes',
        ],
      ],
      status: 'OPEN',
      hoursAgo: 7,
    },
    {
      signals: [['BID_VELOCITY', 32, '48 bids in the last 60 seconds']],
      status: 'CLEARED',
      hoursAgo: 30,
      decision: {
        action: 'CLEAR',
        note: 'Consistent with manual bidding in a closing auction. Cleared.',
      },
    },
    {
      signals: [
        [
          'SHARED_DEVICE',
          35,
          'Device linked to a previously restricted account (placeholder signal)',
        ],
        ['REFUND_ABUSE', 40, '4 refunds on high-value items in 30 days'],
      ],
      status: 'BLOCKED',
      hoursAgo: 52,
      decision: {
        action: 'BLOCK',
        note: 'Blocked after review with Finance. Customer notified via support.',
      },
    },
    {
      signals: [
        ['PAYMENT_RISK', 33, 'Multiple declined attempts before success (placeholder signal)'],
      ],
      status: 'OPEN',
      hoursAgo: 12,
    },
    {
      signals: [
        ['AUTOMATION_PATTERN', 45, 'Interval variation 4.8% across 16 bids'],
        ['BID_VELOCITY', 22, '35 bids in the last 60 seconds'],
      ],
      status: 'UNDER_REVIEW',
      hoursAgo: 15,
    },
    {
      signals: [
        ['PROMO_ABUSE', 30, 'New-customer code used on an account created 2 minutes earlier'],
      ],
      status: 'CLEARED',
      hoursAgo: 70,
      decision: { action: 'CLEAR', note: 'Genuine new customer. Cleared.' },
    },
  ]
  return specs.map((spec, index) => {
    const at = now - spec.hoursAgo * HOUR
    const customer = state.customers[(index * 37 + 11) % state.customers.length]!
    const assessment = assessRisk(
      spec.signals.map(([code, weight, detail]) => signal(code, weight, detail, at)),
      at,
    )
    return {
      id: deterministicUuid('fraud-case', index),
      userId: customer.id,
      customerName: customer.name,
      assessment,
      status: spec.status,
      decision: spec.decision
        ? {
            action: spec.decision.action,
            by: STAFF[index % STAFF.length]!,
            at: at + 2 * HOUR,
            note: spec.decision.note,
          }
        : null,
      createdAt: at,
      simulated: true,
    }
  })
}

export function generateTickets(state: DemoState, now: number): SupportTicket[] {
  const specs: [TicketCategory, string, TicketStatus, number, string][] = [
    [
      'payment',
      'Charged twice for a bid pack?',
      'OPEN',
      0.5,
      'I think I was charged twice for the Power pack this morning.',
    ],
    [
      'delivery',
      'Parcel shows delivered but not received',
      'IN_PROGRESS',
      2,
      'Tracking says delivered at 14:02 but nothing arrived.',
    ],
    [
      'auction',
      'Timer jumped back up while I was bidding',
      'RESOLVED',
      26,
      'The clock went from 3 seconds back to 15 — is that right?',
    ],
    [
      'wallet',
      'Promotional bids expired early',
      'WAITING_CUSTOMER',
      8,
      'My bonus bids disappeared before the date I expected.',
    ],
    [
      'refund',
      'Return label for air fryer',
      'IN_PROGRESS',
      5,
      'The basket coating is peeling — can I return it?',
    ],
    ['account', 'Change email address', 'RESOLVED', 40, 'I would like to update my email address.'],
    [
      'technical',
      'App freezes on auction page',
      'OPEN',
      1.5,
      'The auction page froze on my phone during the final seconds.',
    ],
    ['order', 'Add gift message to order', 'CLOSED', 96, 'Can I add a gift message to my order?'],
    [
      'auction',
      'How does the newcomer auction work?',
      'RESOLVED',
      30,
      'Am I eligible for the newcomer auctions?',
    ],
    [
      'payment',
      'Payment declined but money pending',
      'OPEN',
      3,
      'My payment failed but my bank shows a pending amount.',
    ],
    [
      'wallet',
      'Bid recovery not applied',
      'IN_PROGRESS',
      11,
      'I bought the item with Buy Now but did not get my bids back.',
    ],
    [
      'delivery',
      'Two-person delivery slot',
      'WAITING_CUSTOMER',
      20,
      'Can I choose a Saturday slot for the TV delivery?',
    ],
    [
      'account',
      'Set a self-exclusion break',
      'RESOLVED',
      60,
      'I want to take a 30-day break from bidding.',
    ],
    ['refund', 'Refund timeline', 'CLOSED', 120, 'How long do refunds take to appear?'],
    [
      'technical',
      'Notifications not arriving',
      'OPEN',
      6,
      'I stopped receiving outbid notifications.',
    ],
    ['order', 'Wrong colour received', 'IN_PROGRESS', 14, 'I ordered Sage but received Cream.'],
    [
      'auction',
      'Auction cancelled — where are my bids?',
      'RESOLVED',
      50,
      'An auction I bid in was cancelled.',
    ],
    [
      'payment',
      'VAT invoice request',
      'WAITING_CUSTOMER',
      33,
      'Please send a VAT invoice for my order.',
    ],
    ['delivery', 'Delivery to a parcel locker', 'CLOSED', 150, 'Can you deliver to a locker?'],
    [
      'wallet',
      'Daily limit reached — can I raise it?',
      'RESOLVED',
      9,
      'I hit my daily limit, can you increase it now?',
    ],
  ]
  return specs.map(([category, subject, status, hoursAgo, body], index) => {
    const createdAt = now - hoursAgo * HOUR
    const customer = state.customers[(index * 53 + 7) % state.customers.length]!
    const id = deterministicUuid('ticket', index)
    const agent = STAFF[3]!
    const messages: SupportTicket['messages'] = [
      { id: newId(), author: 'CUSTOMER', authorName: customer.name, body, at: createdAt },
    ]
    if (status !== 'OPEN') {
      messages.push({
        id: newId(),
        author: 'AGENT',
        authorName: agent,
        body:
          category === 'wallet' && subject.startsWith('Daily limit')
            ? 'Limit increases take effect after a 24-hour cooling period — this protects you and cannot be overridden by support. You can request the change in Account → Responsible use.'
            : 'Thanks for getting in touch. I have looked into this and updated your case.',
        at: createdAt + 3 * HOUR,
      })
    }
    return {
      id,
      reference: `ESB-T-${2000 + index}`,
      userId: customer.id,
      customerName: customer.name,
      category,
      subject,
      status,
      priority: category === 'payment' || category === 'wallet' ? 'HIGH' : 'NORMAL',
      assignee: status === 'OPEN' ? null : agent,
      relatedReference: null,
      messages,
      createdAt,
      updatedAt: messages[messages.length - 1]!.at,
      simulated: true,
    }
  })
}

export function seedAudit(state: DemoState, now: number): void {
  const products = [...state.products.values()]
  const staffActor = (index: number, role: string) => ({
    type: 'ADMIN' as const,
    id: `staff-${index}`,
    name: STAFF[index]!,
    role,
  })
  const entries: Parameters<DemoState['audit']['recordSync']>[0][] = [
    {
      actor: staffActor(1, 'MERCHANDISER'),
      action: 'product.updated',
      entityType: 'PRODUCT',
      entityId: products[4]!.id,
      severity: 'NOTICE',
      summary: `Buy Now price updated for ${products[4]!.name}`,
      metadata: { field: 'buyNowPriceMinor' },
      requestId: null,
      occurredAt: now - 5 * HOUR,
    },
    {
      actor: staffActor(1, 'MERCHANDISER'),
      action: 'promotion.created',
      entityType: 'PROMOTION',
      entityId: 'KITCHEN15',
      severity: 'INFO',
      summary: 'Created promotion KITCHEN15 (15% off kitchen)',
      metadata: {},
      requestId: null,
      occurredAt: now - 30 * HOUR,
    },
    {
      actor: staffActor(0, 'OPERATIONS'),
      action: 'auction.transition',
      entityType: 'AUCTION',
      entityId: deterministicUuid('auction', 'computing', 'legacy'),
      severity: 'WARNING',
      summary: 'Halden Air 14: LIVE → CANCELLED (supplier stock issue). All bids refunded.',
      metadata: { from: 'LIVE', to: 'CANCELLED' },
      requestId: null,
      occurredAt: now - 6 * DAY,
    },
    {
      actor: staffActor(2, 'FINANCE'),
      action: 'refund.issued',
      entityType: 'REFUND',
      entityId: 'refund-legacy-1',
      severity: 'NOTICE',
      summary: 'Refund £64.99 issued for returned controller',
      metadata: {},
      requestId: null,
      occurredAt: now - 8 * DAY,
    },
    {
      actor: staffActor(0, 'OPERATIONS'),
      action: 'fraud.decision',
      entityType: 'FRAUD_CASE',
      entityId: deterministicUuid('fraud-case', 2),
      severity: 'WARNING',
      summary: 'Throttled bid-pack purchases pending ID verification',
      metadata: { action: 'THROTTLE' },
      requestId: null,
      occurredAt: now - 7 * HOUR,
    },
    {
      actor: staffActor(4, 'SUPER_ADMIN'),
      action: 'fraud.decision',
      entityType: 'FRAUD_CASE',
      entityId: deterministicUuid('fraud-case', 8),
      severity: 'CRITICAL',
      summary: 'Account blocked after analyst review',
      metadata: { action: 'BLOCK' },
      requestId: null,
      occurredAt: now - 50 * HOUR,
    },
    {
      actor: staffActor(3, 'SUPPORT_AGENT'),
      action: 'wallet.adjustment',
      entityType: 'WALLET',
      entityId: 'goodwill-legacy',
      severity: 'NOTICE',
      summary: 'Goodwill credit of 5 promotional bids (ticket ESB-T-1042)',
      metadata: { credits: 5 },
      requestId: null,
      occurredAt: now - 4 * DAY,
    },
    {
      actor: staffActor(0, 'OPERATIONS'),
      action: 'order.status_changed',
      entityType: 'ORDER',
      entityId: 'order-legacy-1',
      severity: 'INFO',
      summary: 'Order marked as exception: address verification',
      metadata: {},
      requestId: null,
      occurredAt: now - 9 * HOUR,
    },
    {
      actor: staffActor(1, 'MERCHANDISER'),
      action: 'inventory.adjusted',
      entityType: 'INVENTORY',
      entityId: products[12]!.id,
      severity: 'NOTICE',
      summary: `Stock count adjustment −1 for ${products[12]!.name} (damaged in warehouse)`,
      metadata: {},
      requestId: null,
      occurredAt: now - 3 * DAY,
    },
    {
      actor: { type: 'CUSTOMER', id: 'customer-limits', name: 'Member (limits)' },
      action: 'limits.updated',
      entityType: 'USER_LIMITS',
      entityId: state.customers[5]!.id,
      severity: 'INFO',
      summary: 'Daily bid limit lowered 300 → 150 (effective immediately)',
      metadata: {},
      requestId: null,
      occurredAt: now - 14 * HOUR,
    },
    {
      actor: staffActor(4, 'SUPER_ADMIN'),
      action: 'feature_flag.changed',
      entityType: 'FEATURE_FLAG',
      entityId: 'referrals',
      severity: 'NOTICE',
      summary: 'Feature flag "referrals" kept off for UK pending legal review',
      metadata: {},
      requestId: null,
      occurredAt: now - 10 * DAY,
    },
  ]
  for (const entry of entries.sort((a, b) => (a.occurredAt ?? 0) - (b.occurredAt ?? 0)))
    state.audit.recordSync(entry)
}

export function seedPurchaseOrders(state: DemoState, now: number): void {
  const products = [...state.products.values()]
  const statuses = [
    'SENT',
    'CONFIRMED',
    'PARTIALLY_RECEIVED',
    'RECEIVED',
    'DRAFT',
    'CONFIRMED',
    'SENT',
    'RECEIVED',
    'CANCELLED',
    'CONFIRMED',
  ] as const
  statuses.forEach((status, index) => {
    const product = products[(index * 7 + 3) % products.length]!
    const supplier = state.suppliers.find((item) => item.id === product.supplierId)!
    const createdAt = now - (index + 2) * DAY
    state.purchaseOrders.push({
      id: deterministicUuid('purchase-order', index),
      reference: `PO-${4200 + index}`,
      supplierId: supplier.id,
      status,
      lines: [
        {
          productId: product.id,
          quantity: 10 + ((index * 13) % 40),
          unitCostMinor: product.costPriceMinor,
        },
      ],
      createdAt,
      expectedAt: createdAt + supplier.leadTimeDays * DAY,
      receivedAt: status === 'RECEIVED' ? createdAt + supplier.leadTimeDays * DAY : null,
    })
  })
}

export function seedInventory(state: DemoState, stockFor: (slug: string) => number): void {
  const openingAt = state.anchorDay - 30 * DAY
  for (const product of state.products.values()) {
    const rng = rngFor('inventory', product.slug)
    appendInventory(
      state,
      product.id,
      {
        type: 'RECEIVED',
        quantity: stockFor(product.slug),
        reference: null,
        note: 'Opening balance (stock count)',
        actor: 'Warehouse',
      },
      openingAt,
    )
    if (chance(rng, 0.2) && product.shippingClass !== 'DIGITAL') {
      appendInventory(
        state,
        product.id,
        {
          type: 'DAMAGED',
          quantity: 1,
          reference: null,
          note: 'Damaged in warehouse',
          actor: 'Warehouse',
        },
        openingAt + randomInt(rng, 2, 20) * DAY,
      )
    }
    if (chance(rng, 0.15) && product.shippingClass !== 'DIGITAL') {
      appendInventory(
        state,
        product.id,
        {
          type: 'RETURNED',
          quantity: 1,
          reference: null,
          note: 'Customer return awaiting inspection',
          actor: 'Returns desk',
        },
        openingAt + randomInt(rng, 5, 25) * DAY,
      )
    }
  }
}
