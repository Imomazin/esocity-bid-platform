import { z } from 'zod'

import { computeAuctionEconomics } from '@/domain/auction/economics'
import {
  auctionRulesSchema,
  DEFAULT_AUCTION_RULES,
  lockedFieldsFor,
  lockedRuleViolations,
  mergeRules,
  type AuctionRulesPatch,
} from '@/domain/auction/rules'
import { allowedTransitions, transition } from '@/domain/auction/state-machine'
import type { AuctionRules, AuctionState, AuctionStatus } from '@/domain/auction/types'
import type { Product } from '@/domain/catalog'
import { refundableAmount } from '@/domain/checkout'
import { DomainError } from '@/domain/errors'
import type { FraudCase, RiskAction } from '@/domain/fraud'
import {
  planRelease,
  planReservation,
  projectInventory,
  stockLevel,
  type InventoryEvent,
} from '@/domain/inventory'
import { canTransitionOrder, isOpenOrder, transitionOrder, type OrderStatus } from '@/domain/orders'
import { promotionState, type Promotion } from '@/domain/promotions'
import { transitionTicket, type TicketStatus } from '@/domain/support'
import { newId } from '@/lib/ids'
import { formatMinor } from '@/lib/money'
import { DAY, HOUR, MINUTE } from '@/lib/time'
import { assertPermission, type Role } from '@/server/auth/roles'
import type { AuditActor, AuditQuery } from '@/server/infra/audit'

import { appendInventory, audit, inventoryEvents, notify, type Ctx } from './context'
import { CREDIT_VALUE_MINOR } from './data/commerce'
import { AUCTION_SERIES } from './data/series'
import type { AuctionRecord, DailyMetric } from './state'
import { auctionCard, recentBidViews } from './views'
import { buildSimParams, emptyRecord, ensureStock, refundMemberBids } from './world'

export interface AdminActorInput {
  id: string
  name: string
  role: Role
  roles: Role[]
}

function actorOf(admin: AdminActorInput): AuditActor {
  return { type: 'ADMIN', id: admin.id, name: admin.name, role: admin.role }
}

function sumBy<T>(items: readonly T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0)
}

function windowMetrics(daily: DailyMetric[], from: number, to: number) {
  const rows = daily.filter((row) => row.day >= from && row.day < to)
  return {
    rows,
    gmv: sumBy(rows, (row) => row.gmvMinor),
    auctionRevenue: sumBy(rows, (row) => row.auctionRevenueMinor),
    buyNowRevenue: sumBy(rows, (row) => row.buyNowRevenueMinor),
    marketplaceRevenue: sumBy(rows, (row) => row.marketplaceRevenueMinor),
    dropRevenue: sumBy(rows, (row) => row.dropRevenueMinor),
    bidPackRevenue: sumBy(rows, (row) => row.bidPackRevenueMinor),
    refunds: sumBy(rows, (row) => row.refundsMinor),
    orders: sumBy(rows, (row) => row.orders),
    sessions: sumBy(rows, (row) => row.sessions),
    activeUsers: rows.length ? Math.round(sumBy(rows, (row) => row.activeUsers) / rows.length) : 0,
    newUsers: sumBy(rows, (row) => row.newUsers),
    auctionsCompleted: sumBy(rows, (row) => row.auctionsCompleted),
    bidsPlaced: sumBy(rows, (row) => row.bidsPlaced),
    checkoutStarts: sumBy(rows, (row) => row.checkoutStarts),
    checkoutCompletions: sumBy(rows, (row) => row.checkoutCompletions),
  }
}

function change(current: number, previous: number): number | null {
  if (previous === 0) return null
  return (current - previous) / previous
}

export function dashboard(ctx: Ctx, now: number) {
  const { state } = ctx
  const dayStart = Math.floor(now / DAY) * DAY
  const current = windowMetrics(state.daily, dayStart - 29 * DAY, dayStart + DAY)
  const previous = windowMetrics(state.daily, dayStart - 59 * DAY, dayStart - 29 * DAY)
  const liveAuctions = [...state.auctions.values()].filter(
    (record) => record.state.status === 'LIVE',
  )
  // Series auctions older than a few cycles are no longer materialised, so their 24-hour count
  // comes from the schedule; operator-created auctions are always retained and counted directly.
  const seriesCompleted24h = Math.round(
    AUCTION_SERIES.reduce((total, series) => total + DAY / (series.cycleMinutes * MINUTE), 0),
  )
  const operatorCompleted24h = [...state.auctions.values()].filter(
    (record) =>
      record.source === 'ADMIN' &&
      record.state.status === 'COMPLETED' &&
      (record.state.result?.closedAt ?? 0) > now - DAY,
  ).length
  const positions = [...state.products.values()].map((product) => ({
    product,
    position: projectInventory(inventoryEvents(state, product.id)),
  }))
  const lowStock = positions.filter(
    ({ product, position }) =>
      product.shippingClass !== 'DIGITAL' && stockLevel(position.available) !== 'IN_STOCK',
  )
  const orders = [...state.orders.values()]
  const awaiting = orders.filter(
    (order) =>
      order.status === 'PAID' || order.status === 'PROCESSING' || order.status === 'PACKED',
  )
  const exceptions = orders.filter((order) => order.exception && isOpenOrder(order.status))
  const openFraud = state.fraudCases.filter(
    (item) => item.status === 'OPEN' || item.status === 'UNDER_REVIEW',
  )
  const openTickets = state.tickets.filter(
    (ticket) => ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED',
  )
  const categoryMix = new Map<string, number>()
  for (const order of orders) {
    if (order.createdAt < now - 30 * DAY || order.status === 'CANCELLED') continue
    for (const line of order.lines) {
      const product = state.products.get(line.productId)
      if (!product) continue
      categoryMix.set(
        product.categorySlug,
        (categoryMix.get(product.categorySlug) ?? 0) + line.lineTotalMinor,
      )
    }
  }
  const series = state.daily
    .filter((row) => row.day >= dayStart - 29 * DAY)
    .map((row) => ({
      day: row.day,
      auctions: row.auctionRevenueMinor,
      buyNow: row.buyNowRevenueMinor,
      marketplace: row.marketplaceRevenueMinor,
      drops: row.dropRevenueMinor,
      bidPacks: row.bidPackRevenueMinor,
      activeUsers: row.activeUsers,
      newUsers: row.newUsers,
      auctionsCompleted: row.auctionsCompleted,
      bidsPlaced: row.bidsPlaced,
    }))
  return {
    kpis: {
      gmv: { value: current.gmv, change: change(current.gmv, previous.gmv) },
      grossRevenue: {
        value: current.gmv + current.bidPackRevenue,
        change: change(
          current.gmv + current.bidPackRevenue,
          previous.gmv + previous.bidPackRevenue,
        ),
      },
      auctionRevenue: {
        value: current.auctionRevenue,
        change: change(current.auctionRevenue, previous.auctionRevenue),
      },
      buyNowRevenue: {
        value: current.buyNowRevenue,
        change: change(current.buyNowRevenue, previous.buyNowRevenue),
      },
      bidPackRevenue: {
        value: current.bidPackRevenue,
        change: change(current.bidPackRevenue, previous.bidPackRevenue),
      },
      marketplaceRevenue: {
        value: current.marketplaceRevenue + current.dropRevenue,
        change: change(
          current.marketplaceRevenue + current.dropRevenue,
          previous.marketplaceRevenue + previous.dropRevenue,
        ),
      },
      activeUsers: {
        value: current.activeUsers,
        change: change(current.activeUsers, previous.activeUsers),
      },
      conversion: {
        value: current.sessions ? current.checkoutCompletions / current.sessions : 0,
        change: change(
          current.sessions ? current.checkoutCompletions / current.sessions : 0,
          previous.sessions ? previous.checkoutCompletions / previous.sessions : 0,
        ),
      },
      refunds: { value: current.refunds, change: change(current.refunds, previous.refunds) },
    },
    operations: {
      activeAuctions: liveAuctions.length,
      scheduledAuctions: [...state.auctions.values()].filter(
        (record) => record.state.status === 'SCHEDULED',
      ).length,
      completedAuctions24h: seriesCompleted24h + operatorCompleted24h,
      completedAuctions30d: current.auctionsCompleted,
      bidsLast30d: current.bidsPlaced,
      inventoryUnits: sumBy(
        positions.filter(({ product }) => product.shippingClass !== 'DIGITAL'),
        ({ position }) => position.available,
      ),
      lowStock: lowStock.length,
      awaitingFulfilment: awaiting.length,
      fulfilmentExceptions: exceptions.length,
      fraudAlerts: openFraud.length,
      criticalFraud: openFraud.filter((item) => item.assessment.riskClass === 'CRITICAL').length,
      supportOpen: openTickets.length,
      supportUrgent: openTickets.filter(
        (ticket) => ticket.priority === 'HIGH' || ticket.priority === 'URGENT',
      ).length,
      autobidKillSwitch: state.autobidKillSwitch,
    },
    series,
    categoryMix: [...categoryMix.entries()]
      .map(([slug, value]) => ({
        slug,
        name: state.categories.find((category) => category.slug === slug)?.name ?? slug,
        value,
      }))
      .sort((a, b) => b.value - a.value),
    funnel: [
      { stage: 'Sessions', value: current.sessions },
      { stage: 'Checkout started', value: current.checkoutStarts },
      { stage: 'Orders completed', value: current.checkoutCompletions },
    ],
    liveAuctions: liveAuctions
      .sort((a, b) => b.state.bidCount - a.state.bidCount)
      .slice(0, 6)
      .map((record) => ({
        id: record.state.id,
        title: record.state.title,
        priceMinor: record.state.priceMinor,
        bids: record.state.bidCount,
        bidders: record.state.uniqueBidders,
        closeAt: record.state.closeAt,
      })),
    recentOrders: orders.sort((a, b) => b.createdAt - a.createdAt).slice(0, 6),
    openFraud: openFraud.slice(0, 5),
  }
}

export function customerAnalytics(ctx: Ctx, now: number) {
  const { state } = ctx
  const dayStart = Math.floor(now / DAY) * DAY
  const current = windowMetrics(state.daily, dayStart - 29 * DAY, dayStart + DAY)
  const rows = current.rows
  const bidPackViews = sumBy(rows, (row) => row.bidPackViews)
  const bidPackPurchases = sumBy(rows, (row) => row.bidPackPurchases)
  const buyNowViews = sumBy(rows, (row) => row.buyNowViews)
  const buyNowPurchases = sumBy(rows, (row) => row.buyNowPurchases)
  const dropViews = sumBy(rows, (row) => row.dropViews)
  const dropPurchases = sumBy(rows, (row) => row.dropPurchases)
  const watchAdds = sumBy(rows, (row) => row.watchlistAdds)
  const watchToBid = sumBy(rows, (row) => row.watchlistToBid)
  const uniqueBidders = rows.length
    ? Math.round(sumBy(rows, (row) => row.uniqueBidders) / rows.length)
    : 0
  const repeatCustomers = state.customers.filter((customer) => customer.orders > 1).length
  const today = new Date(dayStart)
  const cohorts = [0, 1, 2, 3, 4, 5].map((index) => {
    const base = 0.42 - index * 0.015
    // Calendar months (not 30-day steps), so labels are unique and aligned to month starts.
    const monthStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (index + 1), 1)
    return {
      cohort: new Date(monthStart).toLocaleDateString('en-GB', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }),
      size: 1_150 + index * 90,
      retention: [1, base, base * 0.78, base * 0.66, base * 0.58, base * 0.53].slice(0, 6 - index),
    }
  })
  return {
    newUsers: current.newUsers,
    returningUsers: rows.length
      ? Math.round(sumBy(rows, (row) => row.returningUsers) / rows.length)
      : 0,
    activeUsers: current.activeUsers,
    conversion: current.sessions ? current.checkoutCompletions / current.sessions : 0,
    auctionParticipation: current.activeUsers ? uniqueBidders / current.activeUsers : 0,
    bidPackConversion: bidPackViews ? bidPackPurchases / bidPackViews : 0,
    buyNowConversion: buyNowViews ? buyNowPurchases / buyNowViews : 0,
    repeatPurchaseRate: state.customers.length ? repeatCustomers / state.customers.length : 0,
    averageOrderValue: current.orders
      ? Math.round(
          (current.gmv - current.auctionRevenue + sumBy(rows, () => 0)) /
            Math.max(1, current.orders),
        )
      : 0,
    watchlistToParticipation: watchAdds ? watchToBid / watchAdds : 0,
    dropConversion: dropViews ? dropPurchases / dropViews : 0,
    series: rows.map((row) => ({
      day: row.day,
      newUsers: row.newUsers,
      returningUsers: row.returningUsers,
      activeUsers: row.activeUsers,
      conversion: row.sessions ? row.checkoutCompletions / row.sessions : 0,
    })),
    cohorts,
  }
}

export function auctionEconomics(ctx: Ctx, record: AuctionRecord) {
  const product = ctx.state.products.get(record.state.productId)!
  const result = record.state.result
  return computeAuctionEconomics({
    referencePriceMinor: product.referencePriceMinor,
    finalPriceMinor: record.state.priceMinor,
    winnerPaid: result?.outcome === 'WON',
    bidCount: record.state.bidCount,
    uniqueBidders: record.participants.size,
    purchasedCreditsUsed: record.purchasedCreditsUsed,
    promotionalCreditsUsed: record.promotionalCreditsUsed,
    revenuePerPurchasedCreditMinor: CREDIT_VALUE_MINOR,
    buyNowConversions: record.buyNowConversions,
    buyNowRevenueMinor: record.buyNowRevenueMinor,
    recoveredCreditValueMinor: record.recoveredValueMinor,
    unitCostMinor: product.costPriceMinor,
    startedAt: record.state.startsAt,
    closedAt: result?.closedAt ?? Math.max(record.state.updatedAt, record.state.startsAt),
    winnerBidCount: result?.winnerBidCount ?? 0,
    bidCreditCost: record.state.rules.bidCreditCost,
  })
}

export function economicsTable(ctx: Ctx) {
  return [...ctx.state.auctions.values()]
    .filter((record) => record.state.status === 'COMPLETED')
    .sort((a, b) => (b.state.result?.closedAt ?? 0) - (a.state.result?.closedAt ?? 0))
    .slice(0, 30)
    .map((record) => {
      const product = ctx.state.products.get(record.state.productId)!
      return {
        id: record.state.id,
        title: record.state.title,
        outcome: record.state.result?.outcome ?? 'NO_BIDS',
        referencePriceMinor: product.referencePriceMinor,
        finalPriceMinor: record.state.priceMinor,
        bidCount: record.state.bidCount,
        uniqueBidders: record.participants.size,
        closedAt: record.state.result?.closedAt ?? record.state.updatedAt,
        economics: auctionEconomics(ctx, record),
      }
    })
}

export function listAuctions(ctx: Ctx, filter: { status?: AuctionStatus | 'ALL'; q?: string }) {
  const counts: Record<string, number> = {}
  for (const record of ctx.state.auctions.values())
    counts[record.state.status] = (counts[record.state.status] ?? 0) + 1
  const q = filter.q?.toLowerCase().trim()
  const rows = [...ctx.state.auctions.values()]
    .filter(
      (record) =>
        !filter.status || filter.status === 'ALL' || record.state.status === filter.status,
    )
    .filter(
      (record) =>
        !q || record.state.title.toLowerCase().includes(q) || record.state.id.startsWith(q),
    )
    .sort((a, b) => {
      const rank = (status: AuctionStatus) =>
        ['LIVE', 'PAUSED', 'SCHEDULED', 'DRAFT', 'FINALIZING', 'COMPLETED', 'CANCELLED'].indexOf(
          status,
        )
      return rank(a.state.status) - rank(b.state.status) || a.state.closeAt - b.state.closeAt
    })
    .map((record) => ({
      id: record.state.id,
      title: record.state.title,
      status: record.state.status,
      source: record.source,
      label: record.label,
      priceMinor: record.state.priceMinor,
      bids: record.state.bidCount,
      bidders: record.state.uniqueBidders,
      startsAt: record.state.startsAt,
      closeAt: record.state.closeAt,
      featured: record.state.featured,
      outcome: record.state.result?.outcome ?? null,
      memberBids: record.memberBids.length,
    }))
  return { rows, counts }
}

export async function auctionDetail(ctx: Ctx, id: string) {
  const record = ctx.state.auctions.get(id)
  if (!record) return null
  const product = ctx.state.products.get(record.state.productId)!
  const history = await ctx.state.audit.query({ entityId: id, limit: 100 })
  const participants = [...record.participants.values()]
    .sort((a, b) => b.bids - a.bids)
    .slice(0, 15)
  return {
    card: auctionCard(ctx, record, null),
    state: record.state,
    source: record.source,
    simulated: !!record.sim,
    product: {
      id: product.id,
      name: product.name,
      slug: product.slug,
      costPriceMinor: product.costPriceMinor,
      referencePriceMinor: product.referencePriceMinor,
    },
    participants,
    recentBids: recentBidViews(record, null, 20),
    economics: auctionEconomics(ctx, record),
    audit: history.items,
    allowedTransitions: allowedTransitions(record.state.status, 'ADMIN'),
    lockedFields: lockedFieldsFor(record.state.status),
    autobids: [...ctx.state.autobids.values()].filter((rule) => rule.auctionId === id),
    buyNowConversions: record.buyNowConversions,
    description: record.description,
  }
}

export const createAuctionSchema = z.object({
  productId: z.string().min(1),
  title: z.string().trim().min(3).max(120).optional(),
  startsAt: z.number().int(),
  schedule: z.boolean().default(false),
  featured: z.boolean().default(false),
  description: z.string().trim().max(500).optional(),
  rules: auctionRulesSchema,
})

export type CreateAuctionInput = z.infer<typeof createAuctionSchema>

export function createAuction(
  ctx: Ctx,
  input: CreateAuctionInput,
  admin: AdminActorInput,
  now: number,
): AuctionRecord {
  assertPermission(admin.roles, 'auctions.manage')
  const product = ctx.state.products.get(input.productId)
  if (!product || product.status !== 'ACTIVE')
    throw new DomainError('VALIDATION_FAILED', 'Choose an active product.')
  if (!product.auctionEligible)
    throw new DomainError('VALIDATION_FAILED', 'This product is not eligible for auctions.')
  const id = newId()
  const rules = mergeRules(DEFAULT_AUCTION_RULES, input.rules)
  const state: AuctionState = {
    id,
    productId: product.id,
    title: input.title ?? product.name,
    status: 'DRAFT',
    rules,
    startsAt: input.startsAt,
    closeAt: input.startsAt + rules.timerSeconds * 1000,
    hardCloseAt: rules.hardStopAfterSeconds
      ? input.startsAt + rules.hardStopAfterSeconds * 1000
      : null,
    pausedAt: null,
    remainingAtPauseMs: null,
    priceMinor: rules.startingPriceMinor,
    bidCount: 0,
    lastBidAt: null,
    leaderId: null,
    leaderName: null,
    leaderSimulated: false,
    uniqueBidders: 0,
    version: 1,
    result: null,
    cancelReason: null,
    featured: input.featured,
    createdAt: now,
    updatedAt: now,
  }
  const heat = Math.min(0.9, 0.35 + product.popularity / 200)
  const record = emptyRecord(state, {
    source: 'ADMIN',
    label: 'Operator auction',
    sim: buildSimParams(
      id,
      heat,
      rules.timerSeconds * 1000,
      rules.timerExtensionSeconds,
      25,
      input.startsAt + rules.timerSeconds * 1000 + 90 * 60_000,
    ),
    watchingBase: 20 + Math.round(product.popularity),
    createdBy: admin.name,
    description: input.description ?? null,
  })
  ctx.state.auctions.set(id, record)
  audit(ctx, {
    actor: actorOf(admin),
    action: 'auction.created',
    entityType: 'AUCTION',
    entityId: id,
    summary: `Created draft auction for ${product.name}`,
    metadata: {
      startsAt: input.startsAt,
      rules: {
        incrementMinor: rules.bidIncrementMinor,
        bidCreditCost: rules.bidCreditCost,
        extension: rules.timerExtensionSeconds,
      },
    },
    at: now,
  })
  if (input.schedule) transitionAuction(ctx, id, 'SCHEDULED', 'Scheduled on creation', admin, now)
  return record
}

export function updateAuctionRules(
  ctx: Ctx,
  id: string,
  input: AuctionRulesPatch,
  meta: { featured?: boolean; title?: string; description?: string | null },
  admin: AdminActorInput,
  now: number,
) {
  assertPermission(admin.roles, 'auctions.manage')
  const record = ctx.state.auctions.get(id)
  if (!record) throw new DomainError('AUCTION_NOT_FOUND', 'Auction not found.')
  // A partial eligibility patch is completed from the current rules so unchanged values compare equal.
  const patch: Partial<AuctionRules> = {
    ...input,
    eligibility: input.eligibility
      ? { ...record.state.rules.eligibility, ...input.eligibility }
      : undefined,
  }
  if (patch.eligibility === undefined) delete patch.eligibility
  const violations = lockedRuleViolations(record.state.status, record.state.rules, patch)
  if (violations.length > 0) {
    throw new DomainError(
      'FIELD_LOCKED',
      `These settings cannot be changed while the auction is ${record.state.status.toLowerCase()}: ${violations.join(', ')}.`,
      { fields: violations },
    )
  }
  const terminal =
    record.state.status === 'COMPLETED' ||
    record.state.status === 'CANCELLED' ||
    record.state.status === 'FINALIZING'
  if (terminal && (meta.title !== undefined || meta.featured !== undefined))
    throw new DomainError('FIELD_LOCKED', 'Completed auctions cannot be edited.')
  const merged = auctionRulesSchema.parse(mergeRules(record.state.rules, patch))
  const changed = (Object.keys(patch) as (keyof AuctionRules)[]).filter(
    (key) => JSON.stringify(patch[key]) !== JSON.stringify(record.state.rules[key]),
  )
  const timingChanged = changed.includes('timerSeconds') || changed.includes('hardStopAfterSeconds')
  record.state = {
    ...record.state,
    rules: merged,
    title: meta.title ?? record.state.title,
    featured: meta.featured ?? record.state.featured,
    closeAt: timingChanged
      ? record.state.startsAt + merged.timerSeconds * 1000
      : record.state.closeAt,
    hardCloseAt: timingChanged
      ? merged.hardStopAfterSeconds
        ? record.state.startsAt + merged.hardStopAfterSeconds * 1000
        : null
      : record.state.hardCloseAt,
    priceMinor: record.state.bidCount === 0 ? merged.startingPriceMinor : record.state.priceMinor,
    version: record.state.version + 1,
    updatedAt: now,
  }
  if (meta.description !== undefined) record.description = meta.description
  if (patch.autoBidEnabled === false) {
    for (const rule of ctx.state.autobids.values()) {
      if (rule.auctionId === id && rule.status === 'ACTIVE') {
        rule.status = 'STOPPED'
        rule.stopReason = 'AutoBid was switched off for this auction by Esocity operations.'
        rule.updatedAt = now
      }
    }
  }
  audit(ctx, {
    actor: actorOf(admin),
    action: 'auction.updated',
    entityType: 'AUCTION',
    entityId: id,
    severity: record.state.status === 'LIVE' ? 'NOTICE' : 'INFO',
    summary: `Updated ${record.state.title}: ${[...changed, ...(meta.title ? ['title'] : []), ...(meta.featured !== undefined ? ['featured'] : [])].join(', ') || 'no changes'}`,
    metadata: { changed, status: record.state.status },
    at: now,
  })
  return record
}

export function transitionAuction(
  ctx: Ctx,
  id: string,
  to: AuctionStatus,
  reason: string | undefined,
  admin: AdminActorInput,
  now: number,
) {
  assertPermission(admin.roles, to === 'CANCELLED' ? 'auctions.cancel' : 'auctions.manage')
  const record = ctx.state.auctions.get(id)
  if (!record) throw new DomainError('AUCTION_NOT_FOUND', 'Auction not found.')
  const from = record.state.status
  if (from === 'DRAFT' && to === 'SCHEDULED') {
    const product = ctx.state.products.get(record.state.productId)!
    ensureStock(ctx, product, now)
    appendInventory(
      ctx.state,
      product.id,
      planReservation(
        inventoryEvents(ctx.state, product.id),
        1,
        { type: 'AUCTION', id },
        admin.name,
      ),
      now,
    )
  }
  record.state = transition(record.state, to, { actor: 'ADMIN', now, reason })
  if ((from === 'SCHEDULED' && to === 'DRAFT') || to === 'CANCELLED') {
    const draft = planRelease(
      inventoryEvents(ctx.state, record.state.productId),
      { type: 'AUCTION', id },
      admin.name,
      reason ?? null,
    )
    if (draft) appendInventory(ctx.state, record.state.productId, draft, now)
  }
  if (to === 'CANCELLED') {
    refundMemberBids(ctx, record, now, `auction cancelled: ${reason ?? 'operational reasons'}`)
    for (const rule of ctx.state.autobids.values()) {
      if (rule.auctionId === id && rule.status === 'ACTIVE') {
        rule.status = 'CANCELLED'
        rule.stopReason = 'The auction was cancelled. Any bids placed were refunded.'
        rule.updatedAt = now
      }
    }
  }
  if (to === 'PAUSED' || (from === 'PAUSED' && to === 'LIVE')) {
    for (const participant of record.participants.values()) {
      const account = participant.simulated ? null : ctx.state.accounts.get(participant.bidderId)
      if (account) {
        notify(
          ctx,
          account,
          'SYSTEM',
          to === 'PAUSED' ? `${record.state.title} is paused` : `${record.state.title} has resumed`,
          to === 'PAUSED'
            ? 'Bidding is temporarily paused. The remaining time is frozen and will be restored.'
            : 'Bidding has resumed with the remaining time restored.',
          `/auction/${id}`,
          now,
        )
      }
    }
  }
  audit(ctx, {
    actor: actorOf(admin),
    action: 'auction.transition',
    entityType: 'AUCTION',
    entityId: id,
    severity: to === 'CANCELLED' ? 'WARNING' : to === 'PAUSED' ? 'NOTICE' : 'INFO',
    summary: `${record.state.title}: ${from} → ${to}${reason ? ` (${reason})` : ''}`,
    metadata: { from, to, reason: reason ?? null },
    at: now,
  })
  return record
}

export function setAutoBidKillSwitch(
  ctx: Ctx,
  active: boolean,
  reason: string,
  admin: AdminActorInput,
  now: number,
) {
  assertPermission(admin.roles, 'autobid.killswitch')
  ctx.state.autobidKillSwitch = active
  let stopped = 0
  if (active) {
    for (const rule of ctx.state.autobids.values()) {
      if (rule.status !== 'ACTIVE') continue
      rule.status = 'STOPPED'
      rule.stopReason = 'AutoBid was switched off by Esocity operations.'
      rule.updatedAt = now
      stopped += 1
      const account = ctx.state.accounts.get(rule.userId)
      if (account)
        notify(
          ctx,
          account,
          'SYSTEM',
          'AutoBid paused',
          'AutoBid has been temporarily switched off platform-wide. You can still bid manually.',
          `/auction/${rule.auctionId}`,
          now,
        )
    }
  }
  audit(ctx, {
    actor: actorOf(admin),
    action: 'autobid.kill_switch',
    entityType: 'FEATURE_FLAG',
    entityId: 'autobid',
    severity: active ? 'CRITICAL' : 'NOTICE',
    summary: active
      ? `AutoBid kill switch ACTIVATED — ${stopped} agents stopped (${reason})`
      : `AutoBid kill switch released (${reason})`,
    metadata: { active, stopped, reason },
    at: now,
  })
  return { active, stopped }
}

export function productRows(ctx: Ctx, q?: string, category?: string) {
  const query = q?.toLowerCase().trim()
  return [...ctx.state.products.values()]
    .filter(
      (product) =>
        !query ||
        `${product.name} ${product.brandName} ${product.sku}`.toLowerCase().includes(query),
    )
    .filter((product) => !category || product.categorySlug === category)
    .sort((a, b) => a.categorySlug.localeCompare(b.categorySlug) || a.name.localeCompare(b.name))
    .map((product) => {
      const position = projectInventory(inventoryEvents(ctx.state, product.id))
      const supplier = ctx.state.suppliers.find((item) => item.id === product.supplierId)
      return {
        product,
        position,
        supplierName: supplier?.name ?? '—',
        marginBps:
          product.buyNowPriceMinor > 0
            ? Math.round(
                ((product.buyNowPriceMinor - product.costPriceMinor) * 10_000) /
                  product.buyNowPriceMinor,
              )
            : 0,
        liveAuctions: [...ctx.state.auctions.values()].filter(
          (record) =>
            record.state.productId === product.id &&
            (record.state.status === 'LIVE' || record.state.status === 'SCHEDULED'),
        ).length,
      }
    })
}

export const productInputSchema = z.object({
  name: z.string().trim().min(3).max(120),
  brandSlug: z.string().min(1),
  categorySlug: z.string().min(1),
  subcategory: z.string().trim().min(2).max(60),
  description: z.string().trim().min(20).max(2_000),
  referencePriceMinor: z.number().int().min(0).max(10_000_000),
  buyNowPriceMinor: z.number().int().min(0).max(10_000_000),
  costPriceMinor: z.number().int().min(0).max(10_000_000),
  supplierId: z.string().min(1),
  condition: z.enum(['NEW', 'REFURBISHED', 'OPEN_BOX']),
  shippingClass: z.enum(['DIGITAL', 'SMALL', 'STANDARD', 'LARGE']),
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']),
  auctionEligible: z.boolean(),
  initialStock: z.number().int().min(0).max(100_000).optional(),
})

export type ProductInput = z.infer<typeof productInputSchema>

export function saveProduct(
  ctx: Ctx,
  id: string | null,
  input: ProductInput,
  admin: AdminActorInput,
  now: number,
): Product {
  assertPermission(admin.roles, 'products.manage')
  const brand = ctx.state.brands.find((item) => item.slug === input.brandSlug)
  if (!brand) throw new DomainError('VALIDATION_FAILED', 'Unknown brand.')
  if (!ctx.state.categories.some((item) => item.slug === input.categorySlug))
    throw new DomainError('VALIDATION_FAILED', 'Unknown category.')
  if (!ctx.state.suppliers.some((item) => item.id === input.supplierId))
    throw new DomainError('VALIDATION_FAILED', 'Unknown supplier.')
  if (input.buyNowPriceMinor > input.referencePriceMinor)
    throw new DomainError('VALIDATION_FAILED', 'Buy Now price cannot exceed the reference price.')
  if (id) {
    const existing = ctx.state.products.get(id)
    if (!existing) throw new DomainError('NOT_FOUND', 'Product not found.')
    const changed = (Object.keys(input) as (keyof ProductInput)[]).filter(
      (key) =>
        key !== 'initialStock' &&
        JSON.stringify(input[key]) !==
          JSON.stringify((existing as unknown as Record<string, unknown>)[key]),
    )
    const updated: Product = { ...existing, ...input, brandName: brand.name, updatedAt: now }
    delete (updated as Partial<ProductInput>).initialStock
    ctx.state.products.set(id, updated)
    ctx.state.productsBySlug.set(updated.slug, updated)
    audit(ctx, {
      actor: actorOf(admin),
      action: 'product.updated',
      entityType: 'PRODUCT',
      entityId: id,
      severity: changed.some((key) => key.endsWith('PriceMinor')) ? 'NOTICE' : 'INFO',
      summary: `Updated ${updated.name}: ${changed.join(', ') || 'no changes'}`,
      metadata: { changed },
      at: now,
    })
    return updated
  }
  const productId = newId()
  const slugBase = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const slug = ctx.state.productsBySlug.has(slugBase)
    ? `${slugBase}-${productId.slice(0, 4)}`
    : slugBase
  const category = ctx.state.categories.find((item) => item.slug === input.categorySlug)!
  const product: Product = {
    id: productId,
    slug,
    sku: `ESB-NEW-${String(ctx.state.products.size + 1).padStart(4, '0')}`,
    name: input.name,
    brandSlug: brand.slug,
    brandName: brand.name,
    description: input.description,
    highlights: [],
    categorySlug: input.categorySlug,
    subcategory: input.subcategory,
    images: [0, 1, 2].map((variant) => ({
      alt: `${input.name}`,
      art: 'giftcard' as const,
      variant,
    })),
    palette: { body: '#5B6CFF', shade: '#2F3CD6', accent: '#FFFFFF', backdrop: category.tone },
    colourway: 'Standard',
    currency: 'GBP',
    referencePriceMinor: input.referencePriceMinor,
    buyNowPriceMinor: input.buyNowPriceMinor,
    costPriceMinor: input.costPriceMinor,
    supplierId: input.supplierId,
    condition: input.condition,
    shippingClass: input.shippingClass,
    attributes: {},
    status: input.status,
    auctionEligible: input.auctionEligible,
    tags: [],
    popularity: 40,
    rating: 0,
    reviewCount: 0,
    createdAt: now,
    updatedAt: now,
  }
  ctx.state.products.set(productId, product)
  ctx.state.productsBySlug.set(slug, product)
  if (input.initialStock) {
    appendInventory(
      ctx.state,
      productId,
      {
        type: 'RECEIVED',
        quantity: input.initialStock,
        reference: null,
        note: 'Initial stock',
        actor: admin.name,
      },
      now,
    )
  }
  audit(ctx, {
    actor: actorOf(admin),
    action: 'product.created',
    entityType: 'PRODUCT',
    entityId: productId,
    summary: `Created product ${product.name}`,
    metadata: { initialStock: input.initialStock ?? 0 },
    at: now,
  })
  return product
}

export function inventoryOverview(ctx: Ctx) {
  const positions = [...ctx.state.products.values()]
    .map((product) => {
      const events = inventoryEvents(ctx.state, product.id)
      const position = projectInventory(events)
      return {
        product,
        position,
        level:
          product.shippingClass === 'DIGITAL'
            ? ('IN_STOCK' as const)
            : stockLevel(position.available),
        lastEventAt: events[events.length - 1]?.at ?? 0,
      }
    })
    .sort((a, b) => a.position.available - b.position.available)
  const events: (InventoryEvent & { productName: string })[] = []
  for (const product of ctx.state.products.values()) {
    for (const event of inventoryEvents(ctx.state, product.id))
      events.push({ ...event, productName: product.name })
  }
  events.sort((a, b) => b.at - a.at)
  const totals = positions.reduce(
    (acc, { product, position }) => {
      if (product.shippingClass === 'DIGITAL') return acc
      acc.onHand += position.onHand
      acc.reserved += position.reserved
      acc.available += position.available
      acc.sold += position.sold
      acc.damaged += position.damaged
      acc.returned += position.returned
      acc.stockValueMinor += position.onHand * product.costPriceMinor
      return acc
    },
    { onHand: 0, reserved: 0, available: 0, sold: 0, damaged: 0, returned: 0, stockValueMinor: 0 },
  )
  return { positions, events: events.slice(0, 60), totals }
}

export function adjustInventory(
  ctx: Ctx,
  productId: string,
  quantity: number,
  reason: string,
  admin: AdminActorInput,
  now: number,
) {
  assertPermission(admin.roles, 'inventory.manage')
  const product = ctx.state.products.get(productId)
  if (!product) throw new DomainError('NOT_FOUND', 'Product not found.')
  if (!Number.isSafeInteger(quantity) || quantity === 0)
    throw new DomainError('VALIDATION_FAILED', 'Adjustment must be a non-zero whole number.')
  const position = projectInventory(inventoryEvents(ctx.state, productId))
  if (position.available + quantity < 0)
    throw new DomainError('VALIDATION_FAILED', 'Adjustment would make available stock negative.')
  appendInventory(
    ctx.state,
    productId,
    {
      type: 'ADJUSTED',
      quantity,
      reference: { type: 'MANUAL', id: newId() },
      note: reason,
      actor: admin.name,
    },
    now,
  )
  audit(ctx, {
    actor: actorOf(admin),
    action: 'inventory.adjusted',
    entityType: 'INVENTORY',
    entityId: productId,
    severity: 'NOTICE',
    summary: `Stock adjustment ${quantity > 0 ? '+' : ''}${quantity} for ${product.name} (${reason})`,
    metadata: { quantity, reason },
    at: now,
  })
}

export function suppliersOverview(ctx: Ctx) {
  return ctx.state.suppliers.map((supplier) => {
    const products = [...ctx.state.products.values()].filter(
      (product) => product.supplierId === supplier.id,
    )
    const available = products.reduce(
      (total, product) =>
        total + Math.max(0, projectInventory(inventoryEvents(ctx.state, product.id)).available),
      0,
    )
    const purchaseOrders = ctx.state.purchaseOrders.filter((po) => po.supplierId === supplier.id)
    const onOrder = purchaseOrders
      .filter(
        (po) =>
          po.status === 'SENT' || po.status === 'CONFIRMED' || po.status === 'PARTIALLY_RECEIVED',
      )
      .reduce((total, po) => total + po.lines.reduce((sum, line) => sum + line.quantity, 0), 0)
    return {
      supplier,
      productCount: products.length,
      available,
      onOrder,
      purchaseOrders: purchaseOrders.slice(0, 5),
    }
  })
}

export function listOrders(
  ctx: Ctx,
  filter: {
    status?: OrderStatus | 'ALL'
    source?: string
    q?: string
    page?: number
    pageSize?: number
  },
) {
  const q = filter.q?.toLowerCase().trim()
  const all = [...ctx.state.orders.values()]
    .filter((order) => !filter.status || filter.status === 'ALL' || order.status === filter.status)
    .filter((order) => !filter.source || filter.source === 'ALL' || order.source === filter.source)
    .filter(
      (order) =>
        !q ||
        `${order.reference} ${order.customerName} ${order.lines.map((line) => line.name).join(' ')}`
          .toLowerCase()
          .includes(q),
    )
    .sort((a, b) => b.createdAt - a.createdAt)
  const pageSize = filter.pageSize ?? 25
  const page = Math.max(1, filter.page ?? 1)
  const counts: Record<string, number> = {}
  for (const order of ctx.state.orders.values())
    counts[order.status] = (counts[order.status] ?? 0) + 1
  return {
    rows: all.slice((page - 1) * pageSize, page * pageSize),
    total: all.length,
    page,
    pageSize,
    counts,
  }
}

export function fulfilmentBoard(ctx: Ctx, now: number) {
  const orders = [...ctx.state.orders.values()].filter((order) => order.createdAt > now - 14 * DAY)
  const column = (status: OrderStatus) =>
    orders
      .filter((order) => order.status === status && !order.exception)
      .sort((a, b) => a.createdAt - b.createdAt)
  return {
    awaiting: column('PAID'),
    processing: column('PROCESSING'),
    packed: column('PACKED'),
    shipped: column('SHIPPED').slice(0, 30),
    delivered: orders
      .filter((order) => order.status === 'DELIVERED')
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 12),
    exceptions: orders.filter((order) => order.exception && isOpenOrder(order.status)),
    slaBreaches: orders.filter(
      (order) => order.status === 'PAID' && now - order.createdAt > 24 * HOUR,
    ).length,
  }
}

export async function updateOrderStatus(
  ctx: Ctx,
  orderId: string,
  to: OrderStatus,
  note: string | null,
  admin: AdminActorInput,
  now: number,
) {
  assertPermission(admin.roles, 'orders.manage')
  const order = ctx.state.orders.get(orderId)
  if (!order) throw new DomainError('ORDER_NOT_FOUND', 'Order not found.')
  if (to === 'REFUNDED')
    throw new DomainError('VALIDATION_FAILED', 'Use the refund action to refund an order.')
  if (!canTransitionOrder(order.status, to)) {
    throw new DomainError(
      'INVALID_TRANSITION',
      `Cannot move an order from ${order.status} to ${to}.`,
    )
  }
  let updated = transitionOrder(order, to, now, admin.name, note)
  if (to === 'SHIPPED' && !updated.trackingNumber) {
    const shipment = await ctx.deps.shipping.createShipment({
      orderId: order.id,
      orderReference: order.reference,
      postcode: order.shippingAddress?.postcode ?? '',
      service: order.shippingMethod,
    })
    updated = { ...updated, trackingNumber: shipment.trackingNumber, carrier: shipment.carrier }
  }
  if (order.exception && (to === 'PROCESSING' || to === 'PACKED' || to === 'SHIPPED'))
    updated = { ...updated, exception: null }
  ctx.state.orders.set(orderId, updated)
  const account = ctx.state.accounts.get(order.userId)
  if (account && to === 'SHIPPED')
    notify(
      ctx,
      account,
      'ORDER_SHIPPED',
      `Order ${order.reference} is on its way`,
      `Tracking ${updated.trackingNumber}.`,
      `/orders/${order.id}`,
      now,
    )
  audit(ctx, {
    actor: actorOf(admin),
    action: 'order.status_changed',
    entityType: 'ORDER',
    entityId: orderId,
    summary: `${order.reference}: ${order.status} → ${to}${note ? ` (${note})` : ''}`,
    metadata: { from: order.status, to },
    at: now,
  })
  return updated
}

export async function refundOrder(
  ctx: Ctx,
  orderId: string,
  amountMinor: number | undefined,
  reason: string,
  admin: AdminActorInput,
  now: number,
) {
  assertPermission(admin.roles, 'refunds.issue')
  const order = ctx.state.orders.get(orderId)
  if (!order) throw new DomainError('ORDER_NOT_FOUND', 'Order not found.')
  const payment = ctx.state.payments.find(
    (item) =>
      item.orderId === orderId &&
      (item.status === 'SUCCEEDED' || item.status === 'PARTIALLY_REFUNDED'),
  )
  if (!payment) throw new DomainError('CONFLICT', 'There is no refundable payment for this order.')
  const amount = refundableAmount(payment.amountMinor, payment.refundedMinor, amountMinor)
  if (amount <= 0)
    throw new DomainError('CONFLICT', 'This payment has already been refunded in full.')
  const result = await ctx.deps.payments.refund({
    paymentReference: payment.providerReference,
    amountMinor: amount,
    reason,
  })
  if (result.status !== 'SUCCEEDED')
    throw new DomainError('PAYMENT_FAILED', 'The refund could not be processed.')
  payment.refundedMinor += amount
  payment.status = payment.refundedMinor >= payment.amountMinor ? 'REFUNDED' : 'PARTIALLY_REFUNDED'
  payment.events.push({ status: payment.status, at: now, note: reason })
  ctx.state.refunds.unshift({
    id: newId(),
    paymentId: payment.id,
    orderId,
    amountMinor: amount,
    reason,
    status: 'SUCCEEDED',
    providerReference: result.providerReference,
    createdAt: now,
    actor: admin.name,
  })
  let updated = order
  if (payment.status === 'REFUNDED') {
    if (canTransitionOrder(order.status, 'REFUNDED'))
      updated = transitionOrder(order, 'REFUNDED', now, admin.name, reason)
    else if (order.status === 'SHIPPED')
      updated = transitionOrder(
        transitionOrder(order, 'DELIVERED', now, admin.name, null),
        'REFUNDED',
        now,
        admin.name,
        reason,
      )
    updated = { ...updated, payment: { ...updated.payment, status: 'REFUNDED' } }
  } else {
    updated = { ...updated, payment: { ...updated.payment, status: 'PARTIALLY_REFUNDED' } }
  }
  ctx.state.orders.set(orderId, updated)
  const account = ctx.state.accounts.get(order.userId)
  if (account)
    notify(
      ctx,
      account,
      'SYSTEM',
      `Refund issued for ${order.reference}`,
      `${formatMinor(amount)} has been refunded (simulated).`,
      `/orders/${order.id}`,
      now,
    )
  audit(ctx, {
    actor: actorOf(admin),
    action: 'refund.issued',
    entityType: 'REFUND',
    entityId: orderId,
    severity: 'NOTICE',
    summary: `Refund of ${formatMinor(amount)} for ${order.reference} (${reason})`,
    metadata: { amountMinor: amount, reason, simulated: result.simulated },
    at: now,
  })
  return updated
}

export function paymentsOverview(ctx: Ctx, now: number) {
  const recent = ctx.state.payments.filter((payment) => payment.createdAt > now - 30 * DAY)
  const succeeded = recent.filter(
    (payment) => payment.status !== 'FAILED' && payment.status !== 'PENDING',
  )
  return {
    payments: ctx.state.payments.slice(0, 80),
    refunds: ctx.state.refunds.slice(0, 40),
    bidPackOrders: ctx.state.bidPackOrders.slice(0, 40),
    totals: {
      capturedMinor: sumBy(succeeded, (payment) => payment.amountMinor),
      refundedMinor: sumBy(recent, (payment) => payment.refundedMinor),
      failed: recent.filter((payment) => payment.status === 'FAILED').length,
      bidPackMinor: sumBy(
        succeeded.filter((payment) => payment.kind === 'BID_PACK'),
        (payment) => payment.amountMinor,
      ),
      count: recent.length,
    },
  }
}

export function promotionsOverview(ctx: Ctx, now: number) {
  return [...ctx.state.promotions.values()]
    .map((promotion) => ({ promotion, state: promotionState(promotion, now) }))
    .sort((a, b) => b.promotion.createdAt - a.promotion.createdAt)
}

export const promotionInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(4)
      .max(24)
      .regex(/^[A-Za-z0-9]+$/, 'Letters and numbers only'),
    name: z.string().trim().min(3).max(80),
    description: z.string().trim().max(200).default(''),
    type: z.enum([
      'PERCENT_DISCOUNT',
      'FIXED_DISCOUNT',
      'FREE_SHIPPING',
      'BONUS_BID_CREDITS',
      'BID_PACK_DISCOUNT',
      'CATEGORY_OFFER',
      'NEW_CUSTOMER',
    ]),
    value: z.number().int().min(0).max(10_000_000),
    startsAt: z.number().int(),
    endsAt: z.number().int(),
    usageLimit: z.number().int().min(1).nullable(),
    perUserLimit: z.number().int().min(1).nullable(),
    minimumSpendMinor: z.number().int().min(0).nullable(),
    categories: z.array(z.string()).nullable().default(null),
    newCustomersOnly: z.boolean().default(false),
    minimumTier: z.enum(['MEMBER', 'SILVER', 'GOLD', 'PLATINUM']).nullable().default(null),
  })
  .superRefine((input, context) => {
    if (input.endsAt <= input.startsAt)
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'End date must be after the start date',
      })
    const percent = [
      'PERCENT_DISCOUNT',
      'BID_PACK_DISCOUNT',
      'CATEGORY_OFFER',
      'NEW_CUSTOMER',
    ].includes(input.type)
    if (percent && (input.value < 1 || input.value > 9_000))
      context.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Percentage must be between 0.01% and 90%',
      })
    if (input.type === 'CATEGORY_OFFER' && (!input.categories || input.categories.length === 0))
      context.addIssue({
        code: 'custom',
        path: ['categories'],
        message: 'Choose at least one category',
      })
  })

export type PromotionInput = z.infer<typeof promotionInputSchema>

export function createPromotion(
  ctx: Ctx,
  input: PromotionInput,
  admin: AdminActorInput,
  now: number,
): Promotion {
  assertPermission(admin.roles, 'promotions.manage')
  const code = input.code.toUpperCase()
  if ([...ctx.state.promotions.values()].some((promotion) => promotion.code === code))
    throw new DomainError('CONFLICT', 'A promotion with this code already exists.')
  const percent = [
    'PERCENT_DISCOUNT',
    'BID_PACK_DISCOUNT',
    'CATEGORY_OFFER',
    'NEW_CUSTOMER',
  ].includes(input.type)
  const promotion: Promotion = {
    id: newId(),
    code,
    name: input.name,
    description: input.description,
    type: input.type,
    value: input.value,
    valueKind:
      input.type === 'BONUS_BID_CREDITS'
        ? 'CREDITS'
        : input.type === 'FREE_SHIPPING'
          ? 'NONE'
          : percent
            ? 'PERCENT'
            : 'FIXED',
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    usageLimit: input.usageLimit,
    usageCount: 0,
    perUserLimit: input.perUserLimit,
    minimumSpendMinor: input.minimumSpendMinor,
    maximumDiscountMinor: null,
    eligibility: {
      newCustomersOnly: input.newCustomersOnly || input.type === 'NEW_CUSTOMER',
      minimumTier: input.minimumTier,
      categories: input.categories,
      bidPackIds: null,
    },
    status: 'ACTIVE',
    createdAt: now,
  }
  ctx.state.promotions.set(promotion.id, promotion)
  audit(ctx, {
    actor: actorOf(admin),
    action: 'promotion.created',
    entityType: 'PROMOTION',
    entityId: promotion.id,
    summary: `Created promotion ${code} (${input.type})`,
    metadata: { code, type: input.type, value: input.value },
    at: now,
  })
  return promotion
}

export function setPromotionStatus(
  ctx: Ctx,
  id: string,
  status: Promotion['status'],
  admin: AdminActorInput,
  now: number,
) {
  assertPermission(admin.roles, 'promotions.manage')
  const promotion = ctx.state.promotions.get(id)
  if (!promotion) throw new DomainError('NOT_FOUND', 'Promotion not found.')
  const previous = promotion.status
  promotion.status = status
  audit(ctx, {
    actor: actorOf(admin),
    action: 'promotion.status_changed',
    entityType: 'PROMOTION',
    entityId: id,
    summary: `${promotion.code}: ${previous} → ${status}`,
    metadata: { previous, status },
    at: now,
  })
  return promotion
}

export function customersOverview(ctx: Ctx, q?: string) {
  const query = q?.toLowerCase().trim()
  const sessions = [...ctx.state.accounts.values()].map((account) => ({
    id: account.id,
    name: `${account.displayName} (${account.handle})`,
    email: account.profile.email,
    city: account.addresses[0]?.city ?? '—',
    joinedAt: account.createdAt,
    lastActiveAt: account.lastSeenAt,
    tier: 'SILVER' as const,
    lifetimeSpendMinor: account.orderIds.reduce(
      (total, id) => total + (ctx.state.orders.get(id)?.totalMinor ?? 0),
      0,
    ),
    orders: account.orderIds.length,
    bidsUsed: -account.ledger
      .filter((entry) => entry.type === 'AUCTION_BID')
      .reduce((total, entry) => total + entry.credits, 0),
    bidPackSpendMinor: account.bidPackSpend.reduce((total, item) => total + item.amountMinor, 0),
    wins: account.previousWins,
    status: account.restricted ? ('RESTRICTED' as const) : ('ACTIVE' as const),
    riskClass: 'LOW' as const,
    simulated: false,
  }))
  const all = [...sessions, ...ctx.state.customers]
  return all.filter(
    (customer) =>
      !query || `${customer.name} ${customer.email} ${customer.city}`.toLowerCase().includes(query),
  )
}

export function updateTicket(
  ctx: Ctx,
  id: string,
  input: { status?: TicketStatus; assignee?: string | null; reply?: string },
  admin: AdminActorInput,
  now: number,
) {
  assertPermission(admin.roles, 'support.manage')
  const index = ctx.state.tickets.findIndex((ticket) => ticket.id === id)
  if (index === -1) throw new DomainError('NOT_FOUND', 'Ticket not found.')
  let ticket = ctx.state.tickets[index]!
  if (input.status && input.status !== ticket.status)
    ticket = transitionTicket(ticket, input.status, now)
  if (input.assignee !== undefined) ticket = { ...ticket, assignee: input.assignee, updatedAt: now }
  if (input.reply && input.reply.trim()) {
    ticket = {
      ...ticket,
      messages: [
        ...ticket.messages,
        { id: newId(), author: 'AGENT', authorName: admin.name, body: input.reply.trim(), at: now },
      ],
      updatedAt: now,
    }
    const account = ctx.state.accounts.get(ticket.userId)
    if (account)
      notify(
        ctx,
        account,
        'SYSTEM',
        `New reply on ${ticket.reference}`,
        input.reply.trim().slice(0, 140),
        '/support',
        now,
      )
  }
  ctx.state.tickets[index] = ticket
  audit(ctx, {
    actor: actorOf(admin),
    action: 'support.ticket_updated',
    entityType: 'SUPPORT_TICKET',
    entityId: id,
    summary: `${ticket.reference} updated${input.status ? ` → ${input.status}` : ''}`,
    metadata: { status: input.status ?? null, replied: !!input.reply },
    at: now,
  })
  return ticket
}

export function decideFraudCase(
  ctx: Ctx,
  id: string,
  action: RiskAction | 'CLEAR',
  note: string,
  admin: AdminActorInput,
  now: number,
): FraudCase {
  assertPermission(admin.roles, action === 'BLOCK' ? 'fraud.block' : 'fraud.decide')
  const item = ctx.state.fraudCases.find((candidate) => candidate.id === id)
  if (!item) throw new DomainError('NOT_FOUND', 'Case not found.')
  if (!note || note.trim().length < 5)
    throw new DomainError('VALIDATION_FAILED', 'Add a short note explaining the decision.')
  const statusFor: Record<RiskAction | 'CLEAR', FraudCase['status']> = {
    CLEAR: 'CLEARED',
    ALLOW: 'CLEARED',
    REVIEW: 'UNDER_REVIEW',
    THROTTLE: 'THROTTLED',
    BLOCK: 'BLOCKED',
  }
  item.status = statusFor[action]
  item.decision = { action, by: admin.name, at: now, note: note.trim() }
  const account = ctx.state.accounts.get(item.userId)
  if (account) {
    account.restricted = action === 'BLOCK' ? { reason: note.trim() } : null
  }
  const customer = ctx.state.customers.find((candidate) => candidate.id === item.userId)
  if (customer)
    customer.status =
      action === 'BLOCK'
        ? 'RESTRICTED'
        : action === 'CLEAR' || action === 'ALLOW'
          ? 'ACTIVE'
          : 'UNDER_REVIEW'
  audit(ctx, {
    actor: actorOf(admin),
    action: 'fraud.decision',
    entityType: 'FRAUD_CASE',
    entityId: id,
    severity: action === 'BLOCK' ? 'CRITICAL' : action === 'THROTTLE' ? 'WARNING' : 'NOTICE',
    summary: `Decision ${action} on risk case for ${item.customerName}: ${note.trim()}`,
    metadata: { action, score: item.assessment.score, riskClass: item.assessment.riskClass },
    at: now,
  })
  return item
}

export async function queryAudit(ctx: Ctx, query: AuditQuery) {
  return ctx.state.audit.query(query)
}

export function adjustWallet(
  ctx: Ctx,
  userId: string,
  credits: number,
  reason: string,
  admin: AdminActorInput,
  now: number,
) {
  assertPermission(admin.roles, 'wallet.adjust')
  const account = ctx.state.accounts.get(userId)
  if (!account) throw new DomainError('NOT_FOUND', 'Only live demo member wallets can be adjusted.')
  if (!Number.isSafeInteger(credits) || credits <= 0 || credits > 500)
    throw new DomainError('VALIDATION_FAILED', 'Goodwill credits must be between 1 and 500.')
  const lotId = newId()
  account.ledger.push({
    id: lotId,
    userId,
    type: 'ADMIN_ADJUSTMENT',
    bucket: 'PROMOTIONAL',
    credits,
    createdAt: now,
    expiresAt: now + 30 * DAY,
    lotId,
    description: `Goodwill credit · ${reason}`,
    reference: null,
    idempotencyKey: null,
  })
  notify(ctx, account, 'SYSTEM', `${credits} goodwill bids added`, reason, '/wallet', now)
  audit(ctx, {
    actor: actorOf(admin),
    action: 'wallet.adjustment',
    entityType: 'WALLET',
    entityId: userId,
    severity: 'NOTICE',
    summary: `Goodwill credit of ${credits} promotional bids (${reason})`,
    metadata: { credits, reason },
    at: now,
  })
}
