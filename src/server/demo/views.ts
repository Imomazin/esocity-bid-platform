import { remainingAllocation, type AutoBidRule } from '@/domain/auction/autobid'
import { quoteRecovery } from '@/domain/auction/recovery'
import { checkEligibility } from '@/domain/auction/rules'
import type { BidEvent } from '@/domain/auction/types'
import type { Product } from '@/domain/catalog'
import { checkDropPurchase, dropStatus } from '@/domain/drops'
import { projectInventory, stockLevel } from '@/domain/inventory'
import type { Order } from '@/domain/orders'
import { applyMaturedChanges, checkBidAllowance } from '@/domain/responsible-use'
import {
  bestValuePackId,
  effectivePricePerCredit,
  LEDGER_TYPE_LABELS,
  summarizeWallet,
  type LedgerEntry,
} from '@/domain/wallet'
import { resolveFlags } from '@/lib/config/flags'
import { getMarket } from '@/lib/config/market'
import { money, savingsBasisPoints } from '@/lib/money'
import type {
  AuctionCard,
  AuctionSnapshot,
  AutoBidView,
  BidView,
  DropView,
  OrderView,
  ProductCard,
  ViewerAuctionState,
  WalletEntryView,
  WalletView,
} from '@/server/views'

import { accountTier, inventoryEvents, usageSnapshot, type Ctx } from './context'
import { CREDIT_VALUE_MINOR } from './data/commerce'
import type { AuctionRecord, DemoAccount, DropInstance } from './state'
import { simulatedDropSales } from './world'

export function flags(ctx: Ctx) {
  return resolveFlags('UK', {}, ctx.state.runtimeFlags)
}

export function categoryName(ctx: Ctx, slug: string): string {
  return ctx.state.categories.find((category) => category.slug === slug)?.name ?? slug
}

export function availableFor(ctx: Ctx, product: Product): number {
  if (product.shippingClass === 'DIGITAL') return 999
  return Math.max(0, projectInventory(inventoryEvents(ctx.state, product.id)).available)
}

export function liveAuctionFor(ctx: Ctx, productId: string): AuctionRecord | null {
  let best: AuctionRecord | null = null
  for (const record of ctx.state.auctions.values()) {
    if (record.state.productId !== productId) continue
    if (
      record.state.status !== 'LIVE' &&
      record.state.status !== 'SCHEDULED' &&
      record.state.status !== 'PAUSED'
    )
      continue
    if (!best || record.state.closeAt < best.state.closeAt) best = record
  }
  return best
}

function isWatched(
  viewer: DemoAccount | null | undefined,
  type: 'AUCTION' | 'PRODUCT' | 'DROP',
  id: string,
): boolean {
  return !!viewer?.watchlist.some((item) => item.type === type && item.targetId === id)
}

export function productCard(ctx: Ctx, product: Product, viewer?: DemoAccount | null): ProductCard {
  const available = availableFor(ctx, product)
  const live = liveAuctionFor(ctx, product.id)
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brandName: product.brandName,
    brandSlug: product.brandSlug,
    categorySlug: product.categorySlug,
    categoryName: categoryName(ctx, product.categorySlug),
    subcategory: product.subcategory,
    referencePriceMinor: product.referencePriceMinor,
    buyNowPriceMinor: product.buyNowPriceMinor,
    savingsBps: savingsBasisPoints(
      money(product.referencePriceMinor),
      money(product.buyNowPriceMinor),
    ),
    art: product.images[0]?.art ?? 'phone',
    palette: product.palette,
    colourway: product.colourway,
    stockLevel: product.shippingClass === 'DIGITAL' ? 'IN_STOCK' : stockLevel(available),
    available,
    rating: product.rating,
    reviewCount: product.reviewCount,
    condition: product.condition,
    shippingClass: product.shippingClass,
    tags: product.tags,
    popularity: product.popularity,
    createdAt: product.createdAt,
    liveAuction: live
      ? {
          id: live.state.id,
          status: live.state.status,
          priceMinor: live.state.priceMinor,
          closeAt: live.state.closeAt,
          startsAt: live.state.startsAt,
        }
      : null,
    watched: isWatched(viewer, 'PRODUCT', product.id),
  }
}

export function auctionSnapshot(record: AuctionRecord, viewerId?: string | null): AuctionSnapshot {
  const state = record.state
  const result = state.result
  return {
    id: state.id,
    status: state.status,
    priceMinor: state.priceMinor,
    startsAt: state.startsAt,
    closeAt: state.closeAt,
    hardCloseAt: state.hardCloseAt,
    remainingAtPauseMs: state.remainingAtPauseMs,
    bidCount: state.bidCount,
    uniqueBidders: state.uniqueBidders,
    leader: state.leaderId
      ? {
          name: state.leaderId === viewerId ? 'You' : (state.leaderName ?? 'Member'),
          isViewer: state.leaderId === viewerId,
          simulated: state.leaderSimulated,
        }
      : null,
    lastBidAt: state.lastBidAt,
    version: state.version,
    result: result
      ? {
          outcome: result.outcome,
          winnerName: result.winnerId && result.winnerId === viewerId ? 'You' : result.winnerName,
          winnerIsViewer: !!viewerId && result.winnerId === viewerId,
          winnerSimulated: result.winnerSimulated,
          finalPriceMinor: result.finalPriceMinor,
          closedAt: result.closedAt,
          winnerBidCount: result.winnerBidCount,
          bidCount: result.bidCount,
          uniqueBidders: result.uniqueBidders,
          bidsRefunded: result.bidsRefunded,
        }
      : null,
  }
}

export function buyNowPrice(ctx: Ctx, record: AuctionRecord): number {
  const product = ctx.state.products.get(record.state.productId)
  return record.state.rules.buyNowPriceMinor ?? product?.buyNowPriceMinor ?? 0
}

export function auctionCard(
  ctx: Ctx,
  record: AuctionRecord,
  viewer?: DemoAccount | null,
): AuctionCard {
  const product = ctx.state.products.get(record.state.productId)!
  const rules = record.state.rules
  return {
    ...auctionSnapshot(record, viewer?.id),
    title: record.state.title,
    label: record.label,
    featured: record.state.featured,
    product: productCard(ctx, product, viewer),
    rules: {
      bidIncrementMinor: rules.bidIncrementMinor,
      bidCreditCost: rules.bidCreditCost,
      timerExtensionSeconds: rules.timerExtensionSeconds,
      buyNowEnabled: rules.buyNowEnabled,
      buyNowPriceMinor: buyNowPrice(ctx, record),
      recoveryEnabled: rules.bidCreditRecoveryEnabled && flags(ctx).buyNowRecovery,
      recoveryMode: rules.recoveryMode,
      recoveryWindowHours: rules.recoveryWindowHours,
      hardStop: rules.hardStopAfterSeconds !== null,
      minimumTier: rules.eligibility.minimumTier,
      maxPreviousWins: rules.eligibility.maxPreviousWins,
      reserve: rules.reservePriceMinor !== null,
      minimumParticipants: rules.minimumParticipants,
      autoBidEnabled: rules.autoBidEnabled && flags(ctx).autobid && !ctx.state.autobidKillSwitch,
      perUserBidLimit: rules.perUserBidLimit,
    },
    watchingCount:
      record.watchingBase + record.watchers.size + Math.floor(record.participants.size / 3),
    watched: isWatched(viewer, 'AUCTION', record.state.id),
    viewerParticipating: !!viewer && record.participants.has(viewer.id),
  }
}

export function bidView(event: BidEvent, viewerId?: string | null): BidView {
  return {
    id: event.id,
    sequence: event.sequence,
    bidderName: event.bidderId === viewerId ? 'You' : event.bidderName,
    isViewer: event.bidderId === viewerId,
    simulated: event.simulated,
    kind: event.kind,
    priceAfterMinor: event.priceAfterMinor,
    placedAt: event.placedAt,
  }
}

export function recentBidViews(
  record: AuctionRecord,
  viewerId?: string | null,
  limit = 12,
): BidView[] {
  return record.recentBids
    .slice(-limit)
    .reverse()
    .map((event) => bidView(event, viewerId))
}

export function autoBidView(ctx: Ctx, rule: AutoBidRule): AutoBidView {
  return {
    id: rule.id,
    auctionId: rule.auctionId,
    auctionTitle: ctx.state.auctions.get(rule.auctionId)?.state.title ?? 'Auction',
    maxBids: rule.maxBids,
    maxPriceMinor: rule.maxPriceMinor,
    bidsPlaced: rule.bidsPlaced,
    remaining: remainingAllocation(rule),
    status: rule.status,
    stopReason: rule.stopReason,
    createdAt: rule.createdAt,
  }
}

export function viewerAutoBid(ctx: Ctx, auctionId: string, userId: string): AutoBidRule | null {
  let latest: AutoBidRule | null = null
  for (const rule of ctx.state.autobids.values()) {
    if (rule.auctionId !== auctionId || rule.userId !== userId) continue
    if (!latest || rule.createdAt > latest.createdAt) latest = rule
  }
  return latest
}

export function viewerAuctionState(
  ctx: Ctx,
  record: AuctionRecord,
  account: DemoAccount,
  now: number,
): ViewerAuctionState {
  const participant = record.participants.get(account.id)
  const wallet = summarizeWallet(account.ledger, now)
  const eligibility = checkEligibility(
    record.state.rules.eligibility,
    {
      tier: accountTier(account, now),
      previousWins: account.previousWins,
      accountCreatedAt: account.createdAt,
      market: account.market,
      ageVerifiedAtLeast: account.profile.ageVerified ? 18 : 0,
    },
    now,
  )
  const limits = checkBidAllowance(
    account.limits,
    usageSnapshot(account, now),
    record.state.rules.bidCreditCost,
    now,
  )
  const rule = viewerAutoBid(ctx, record.state.id, account.id)
  const market = getMarket('UK')
  const recovery =
    participant && record.state.rules.buyNowEnabled
      ? quoteRecovery({
          rules: record.state.rules,
          auction: record.state,
          userId: account.id,
          purchasedCreditsSpent: participant.purchasedCreditsSpent,
          promotionalCreditsSpent: participant.promotionalCreditsSpent,
          creditValueMinor: CREDIT_VALUE_MINOR,
          buyNowPriceMinor: buyNowPrice(ctx, record),
          now,
          alreadyRecovered: account.recoveredAuctions.has(record.state.id),
          marketAllowsRecovery: market.buyNowRecoveryEnabled,
          featureEnabled: flags(ctx).buyNowRecovery,
        })
      : null
  const winOrder =
    record.state.result?.winnerId === account.id
      ? account.orderIds
          .map((id) => ctx.state.orders.get(id))
          .find((order) => order?.auctionId === record.state.id)
      : undefined
  return {
    walletAvailable: wallet.available,
    bidsPlaced: participant?.bids ?? 0,
    purchasedCreditsSpent: participant?.purchasedCreditsSpent ?? 0,
    promotionalCreditsSpent: participant?.promotionalCreditsSpent ?? 0,
    isLeader: record.state.leaderId === account.id,
    eligibility: eligibility.eligible
      ? { eligible: true, reasons: [] }
      : { eligible: false, reasons: eligibility.reasons },
    limits,
    autobid: rule ? autoBidView(ctx, rule) : null,
    recovery,
    winOrderId: winOrder?.id ?? null,
    autoBidAvailable:
      record.state.rules.autoBidEnabled && flags(ctx).autobid && !ctx.state.autobidKillSwitch,
  }
}

export function dropView(
  ctx: Ctx,
  instance: DropInstance,
  viewer: DemoAccount | null | undefined,
  now: number,
): DropView {
  const { drop } = instance
  const product = ctx.state.products.get(drop.productId)!
  const sold = Math.min(drop.stockTotal, simulatedDropSales(instance, now) + instance.realSold)
  const status = dropStatus(drop, sold, now)
  const userPurchased = viewer ? (instance.byUser.get(viewer.id) ?? 0) : 0
  let eligibility: DropView['eligibility'] = { eligible: true, reason: null }
  if (viewer) {
    const check = checkDropPurchase(drop, {
      sold,
      userPurchased,
      quantity: 1,
      tier: accountTier(viewer, now),
      isMember: true,
      now,
    })
    if (!check.ok && check.code === 'NOT_ELIGIBLE')
      eligibility = { eligible: false, reason: check.message }
    if (!check.ok && check.code === 'PURCHASE_LIMIT_REACHED')
      eligibility = { eligible: false, reason: check.message }
  } else if (drop.eligibility.membersOnly || drop.eligibility.minimumTier) {
    eligibility = { eligible: false, reason: 'Enter the demo platform to check your eligibility.' }
  }
  return {
    id: drop.id,
    slug: drop.slug,
    title: drop.title,
    subtitle: drop.subtitle,
    product: productCard(ctx, product, viewer),
    dropPriceMinor: drop.dropPriceMinor,
    referencePriceMinor: drop.referencePriceMinor,
    savingsBps: savingsBasisPoints(money(drop.referencePriceMinor), money(drop.dropPriceMinor)),
    stockTotal: drop.stockTotal,
    stockRemaining: Math.max(0, drop.stockTotal - sold),
    sold,
    perCustomerLimit: drop.perCustomerLimit,
    startsAt: drop.startsAt,
    endsAt: drop.endsAt,
    status,
    eligibility,
    minimumTier: drop.eligibility.minimumTier,
    membersOnly: drop.eligibility.membersOnly,
    viewerPurchased: userPurchased,
    watched: isWatched(viewer, 'DROP', drop.slug),
  }
}

function groupLedger(entries: readonly LedgerEntry[]): WalletEntryView[] {
  const chronological = [...entries].sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  )
  const rows: WalletEntryView[] = []
  let balance = 0
  for (const entry of chronological) {
    balance += entry.credits
    const last = rows[rows.length - 1]
    if (
      last &&
      entry.type === 'AUCTION_BID' &&
      last.type === 'AUCTION_BID' &&
      last.description === entry.description &&
      entry.createdAt - last.createdAt < 2 * 60 * 60 * 1000
    ) {
      last.credits += entry.credits
      last.count += 1
      last.createdAt = entry.createdAt
      last.balanceAfter = balance
      continue
    }
    rows.push({
      id: entry.id,
      type: entry.type,
      bucket: entry.bucket,
      label: LEDGER_TYPE_LABELS[entry.type],
      description: entry.description,
      credits: entry.credits,
      count: 1,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      balanceAfter: balance,
    })
  }
  return rows.reverse()
}

export function packageViews(ctx: Ctx): WalletView['packages'] {
  const bestId = bestValuePackId(ctx.state.packages)
  return ctx.state.packages
    .filter((pack) => pack.active)
    .map((pack) => ({
      ...pack,
      totalCredits: pack.credits + pack.bonusCredits,
      pricePerCreditMinor: effectivePricePerCredit(pack),
      bestValue: pack.id === bestId,
    }))
}

export function walletView(ctx: Ctx, account: DemoAccount, now: number): WalletView {
  return {
    summary: summarizeWallet(account.ledger, now),
    entries: groupLedger(account.ledger),
    packages: packageViews(ctx),
    usage: usageSnapshot(account, now),
    limits: applyMaturedChanges(account.limits, now),
    autobids: [...ctx.state.autobids.values()]
      .filter((rule) => rule.userId === account.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((rule) => autoBidView(ctx, rule)),
  }
}

export function orderView(ctx: Ctx, order: Order): OrderView {
  const lineArt: OrderView['lineArt'] = {}
  for (const line of order.lines) {
    const product = ctx.state.products.get(line.productId)
    if (product)
      lineArt[line.productId] = { art: product.images[0]?.art ?? 'phone', palette: product.palette }
  }
  return { ...order, lineArt }
}
