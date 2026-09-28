import type { PriceBreakdown } from '@/domain/checkout'
import type {
  Address,
  Order,
  OrderLine,
  OrderSource,
  OrderStatus,
  PaymentSummary,
} from '@/domain/orders'
import { hasAnyLimit } from '@/domain/responsible-use'
import { evaluateAchievements, pointsForPurchase, type AchievementStats } from '@/domain/rewards'
import { newId, shortReference } from '@/lib/ids'
import { formatMinor } from '@/lib/money'
import { HOUR } from '@/lib/time'

import { accountTier, audit, memberActor, notify, track, type Ctx } from './context'
import type { AuctionRecord, DemoAccount, DemoState, PaymentRecord } from './state'

export interface NewOrderInput {
  userId: string
  customerName: string
  source: OrderSource
  lines: OrderLine[]
  totals: Pick<
    PriceBreakdown,
    'subtotalMinor' | 'discountMinor' | 'shippingMinor' | 'taxMinor' | 'totalMinor'
  >
  promotionCode: string | null
  recovery: Order['recovery']
  address: Address | null
  shippingMethod: string
  auctionId: string | null
  dropId: string | null
  status: OrderStatus
  createdAt: number
  paymentDueAt: number | null
  payment: PaymentSummary
  simulated: boolean
  actor: string
}

export function buildOrder(input: NewOrderInput): Order {
  const id = newId()
  const events: Order['events'] = [
    { status: 'PENDING_PAYMENT', at: input.createdAt, note: null, actor: input.actor },
  ]
  if (input.status !== 'PENDING_PAYMENT') {
    events.push({
      status: 'PAID',
      at: input.payment.paidAt ?? input.createdAt,
      note: null,
      actor: input.actor,
    })
  }
  return {
    id,
    reference: shortReference('ESB', id),
    userId: input.userId,
    customerName: input.customerName,
    source: input.source,
    status: input.status === 'PENDING_PAYMENT' ? 'PENDING_PAYMENT' : 'PAID',
    lines: input.lines,
    currency: 'GBP',
    subtotalMinor: input.totals.subtotalMinor,
    discountMinor: input.totals.discountMinor,
    shippingMinor: input.totals.shippingMinor,
    taxMinor: input.totals.taxMinor,
    totalMinor: input.totals.totalMinor,
    promotionCode: input.promotionCode,
    recovery: input.recovery,
    shippingAddress: input.address,
    shippingMethod: input.shippingMethod,
    payment: input.payment,
    auctionId: input.auctionId,
    dropId: input.dropId,
    events,
    trackingNumber: null,
    carrier: null,
    paymentDueAt: input.paymentDueAt,
    exception: null,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    simulated: input.simulated,
  }
}

export function storeOrder(state: DemoState, order: Order, account?: DemoAccount): void {
  state.orders.set(order.id, order)
  if (account && !account.orderIds.includes(order.id)) account.orderIds.unshift(order.id)
}

export function recordPayment(
  state: DemoState,
  input: Omit<PaymentRecord, 'id' | 'events' | 'refundedMinor'> & { note?: string | null },
): PaymentRecord {
  const payment: PaymentRecord = {
    ...input,
    id: newId(),
    refundedMinor: 0,
    events: [{ status: input.status, at: input.createdAt, note: input.note ?? null }],
  }
  state.payments.unshift(payment)
  return payment
}

export function achievementStats(state: DemoState, account: DemoAccount): AchievementStats {
  const bidIds = new Set(
    account.ledger
      .filter((entry) => entry.type === 'AUCTION_BID')
      .map((entry) => entry.reference?.id),
  )
  const orders = account.orderIds
    .map((id) => state.orders.get(id))
    .filter(
      (order): order is Order =>
        !!order && order.status !== 'PENDING_PAYMENT' && order.status !== 'CANCELLED',
    )
  return {
    bidsPlaced: bidIds.size,
    auctionsWon: account.previousWins,
    ordersPlaced: orders.length,
    categoriesExplored: account.viewedCategories.size,
    watchlistItems: account.watchlist.length,
    recoveriesUsed: account.recoveredAuctions.size,
    limitsConfigured: hasAnyLimit(account.limits),
    weeklyStreak: account.weeklyStreak,
  }
}

/** Grants points for newly unlocked achievements (idempotent per achievement). */
export function awardAchievements(ctx: Ctx, account: DemoAccount, at: number): void {
  const unlocked = evaluateAchievements(achievementStats(ctx.state, account)).filter(
    (item) => item.unlocked,
  )
  for (const achievement of unlocked) {
    const already = account.rewards.some(
      (entry) => entry.reference?.type === 'ACHIEVEMENT' && entry.reference.id === achievement.id,
    )
    if (already) continue
    account.rewards.push({
      id: newId(),
      type: 'EARN_ACHIEVEMENT',
      points: achievement.points,
      at,
      description: `Achievement unlocked: ${achievement.title}`,
      reference: { type: 'ACHIEVEMENT', id: achievement.id },
    })
    notify(
      ctx,
      account,
      'REWARD_EARNED',
      `Achievement unlocked: ${achievement.title}`,
      `+${achievement.points} Esocity Rewards points.`,
      '/rewards',
      at,
    )
    track(
      ctx,
      'REWARD_EARNED',
      { achievement: achievement.id, points: achievement.points },
      account.id,
    )
  }
}

export function awardPurchasePoints(
  ctx: Ctx,
  account: DemoAccount,
  order: Order,
  at: number,
): void {
  const points = pointsForPurchase(order.totalMinor - order.shippingMinor, accountTier(account, at))
  if (points <= 0) return
  account.rewards.push({
    id: newId(),
    type: 'EARN_PURCHASE',
    points,
    at,
    description: `Order ${order.reference}`,
    reference: { type: 'ORDER', id: order.id },
  })
  notify(
    ctx,
    account,
    'REWARD_EARNED',
    `You earned ${points} points`,
    `Thanks for order ${order.reference}.`,
    '/rewards',
    at,
  )
  track(ctx, 'REWARD_EARNED', { orderId: order.id, points }, account.id)
}

/** Creates the PENDING_PAYMENT order for a member who won an auction. */
export function createAuctionWinOrder(
  ctx: Ctx,
  record: AuctionRecord,
  account: DemoAccount,
  closedAt: number,
): Order {
  const product = ctx.state.products.get(record.state.productId)!
  const price = record.state.priceMinor
  const order = buildOrder({
    userId: account.id,
    customerName: account.displayName,
    source: 'AUCTION_WIN',
    lines: [
      {
        productId: product.id,
        productSlug: product.slug,
        name: product.name,
        brandName: product.brandName,
        quantity: 1,
        unitPriceMinor: price,
        lineTotalMinor: price,
        shippingClass: product.shippingClass,
      },
    ],
    totals: {
      subtotalMinor: price,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: 0,
      totalMinor: price,
    },
    promotionCode: null,
    recovery: null,
    address: account.addresses.find((address) => address.isDefault) ?? null,
    shippingMethod: 'STANDARD',
    auctionId: record.state.id,
    dropId: null,
    status: 'PENDING_PAYMENT',
    createdAt: closedAt,
    paymentDueAt: closedAt + record.state.rules.winnerPaymentWindowHours * HOUR,
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
  storeOrder(ctx.state, order, account)
  ctx.state.progressingOrders.add(order.id)
  audit(ctx, {
    actor: { type: 'SYSTEM', id: 'auction-engine', name: 'Auction engine' },
    action: 'order.created',
    entityType: 'ORDER',
    entityId: order.id,
    summary: `Auction win order ${order.reference} for ${memberActor(account).name} at ${formatMinor(price)}`,
    metadata: { auctionId: record.state.id, totalMinor: price },
    at: closedAt,
  })
  return order
}
