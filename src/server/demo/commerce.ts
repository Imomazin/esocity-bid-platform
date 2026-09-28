import { quoteRecovery, type RecoveryQuote } from '@/domain/auction/recovery'
import type { Product } from '@/domain/catalog'
import { priceCheckout, type PriceBreakdown } from '@/domain/checkout'
import { checkDropPurchase } from '@/domain/drops'
import { DomainError } from '@/domain/errors'
import { planRelease, planReservation, planSale, reservedFor } from '@/domain/inventory'
import { transitionOrder, type Order, type OrderLine, type OrderSource } from '@/domain/orders'
import {
  evaluatePromotion,
  normalizeCode,
  type Promotion,
  type PromotionEffect,
} from '@/domain/promotions'
import { checkPurchaseAllowance, thresholdCrossed } from '@/domain/responsible-use'
import { compareTiers, REDEMPTION_OPTIONS, rewardBalance } from '@/domain/rewards'
import { PROMOTIONAL_CREDIT_VALIDITY_MS, summarizeWallet } from '@/domain/wallet'
import { getMarket } from '@/lib/config/market'
import { deterministicUuid } from '@/lib/rng'
import { newId, shortReference } from '@/lib/ids'
import { formatMinor } from '@/lib/money'
import { DAY } from '@/lib/time'
import type { PaymentMethodOption } from '@/server/providers/payments'
import { DEMO_METHOD_LABELS } from '@/server/providers/payments'
import type { CheckoutMode, CheckoutPreview } from '@/server/views'

import {
  accountTier,
  appendInventory,
  audit,
  availableStock,
  inventoryEvents,
  memberActor,
  notify,
  track,
  usageSnapshot,
  type Ctx,
} from './context'
import { BONUS_CREDIT_VALIDITY_DAYS, CREDIT_VALUE_MINOR } from './data/commerce'
import {
  awardAchievements,
  awardPurchasePoints,
  buildOrder,
  recordPayment,
  storeOrder,
} from './orders'
import type { AuctionRecord, BidPackOrder, DemoAccount, DropInstance } from './state'
import { buyNowPrice, flags, productCard } from './views'
import { ensureStock, simulatedDropSales } from './world'

export const PAYMENT_METHODS: { id: PaymentMethodOption; label: string; description: string }[] = [
  {
    id: 'DEMO_CARD',
    label: DEMO_METHOD_LABELS.DEMO_CARD,
    description: 'Simulated approval. No card details are collected.',
  },
  {
    id: 'DEMO_WALLET',
    label: DEMO_METHOD_LABELS.DEMO_WALLET,
    description: 'Simulated wallet payment.',
  },
  {
    id: 'DEMO_DECLINE',
    label: DEMO_METHOD_LABELS.DEMO_DECLINE,
    description: 'See how a declined payment is handled.',
  },
]

interface ResolvedLine {
  product: Product
  quantity: number
  unitPriceMinor: number
  note: string | null
}

interface ResolvedCheckout {
  title: string
  source: OrderSource
  lines: ResolvedLine[]
  promoAllowed: boolean
  recovery: RecoveryQuote | null
  record: AuctionRecord | null
  pendingOrder: Order | null
  drop: DropInstance | null
  paymentDueAt: number | null
  warnings: string[]
}

function requireProduct(ctx: Ctx, productId: string): Product {
  const product = ctx.state.products.get(productId)
  if (!product || product.status !== 'ACTIVE')
    throw new DomainError('ITEM_UNAVAILABLE', 'This item is no longer available.')
  return product
}

function resolveCheckout(
  ctx: Ctx,
  account: DemoAccount,
  mode: CheckoutMode,
  now: number,
): ResolvedCheckout {
  const warnings: string[] = []
  switch (mode.kind) {
    case 'CART': {
      if (account.cart.length === 0) throw new DomainError('CART_EMPTY', 'Your basket is empty.')
      const lines = account.cart.map((item) => {
        const product = requireProduct(ctx, item.productId)
        const available =
          product.shippingClass === 'DIGITAL' ? 999 : availableStock(ctx.state, product.id)
        if (available < item.quantity)
          warnings.push(`Only ${available} × ${product.name} available.`)
        return {
          product,
          quantity: item.quantity,
          unitPriceMinor: product.buyNowPriceMinor,
          note: null,
        }
      })
      return {
        title: 'Your basket',
        source: 'MARKETPLACE',
        lines,
        promoAllowed: true,
        recovery: null,
        record: null,
        pendingOrder: null,
        drop: null,
        paymentDueAt: null,
        warnings,
      }
    }
    case 'ORDER': {
      const order = ctx.state.orders.get(mode.orderId)
      if (!order || order.userId !== account.id)
        throw new DomainError('ORDER_NOT_FOUND', 'We could not find that order.')
      if (order.status !== 'PENDING_PAYMENT')
        throw new DomainError('CONFLICT', 'This order has already been paid.')
      const lines = order.lines.map((line) => ({
        product: requireProduct(ctx, line.productId),
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        note: 'Winning auction price',
      }))
      return {
        title: `Pay for your auction win · ${order.reference}`,
        source: order.source,
        lines,
        promoAllowed: false,
        recovery: null,
        record: null,
        pendingOrder: order,
        drop: null,
        paymentDueAt: order.paymentDueAt,
        warnings,
      }
    }
    case 'AUCTION_BUY_NOW': {
      const record = ctx.state.auctions.get(mode.auctionId)
      if (!record) throw new DomainError('AUCTION_NOT_FOUND', 'We could not find that auction.')
      if (!record.state.rules.buyNowEnabled)
        throw new DomainError('ITEM_UNAVAILABLE', 'Buy Now is not available for this auction.')
      if (record.state.result?.winnerId === account.id) {
        throw new DomainError(
          'CONFLICT',
          'You won this auction — complete payment from your orders instead.',
        )
      }
      const product = requireProduct(ctx, record.state.productId)
      const participant = record.participants.get(account.id)
      const market = getMarket('UK')
      const recovery = participant
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
      if (availableStock(ctx.state, product.id) < 1 && product.shippingClass !== 'DIGITAL')
        warnings.push('Stock is limited — this item may be replenished shortly.')
      return {
        title: `Buy Now · ${record.state.title}`,
        source: 'AUCTION_BUY_NOW',
        lines: [
          {
            product,
            quantity: 1,
            unitPriceMinor: buyNowPrice(ctx, record),
            note: 'Buy Now price from the auction',
          },
        ],
        promoAllowed: true,
        recovery,
        record,
        pendingOrder: null,
        drop: null,
        paymentDueAt: null,
        warnings,
      }
    }
    case 'DROP': {
      const drop = ctx.state.drops.get(mode.dropId)
      if (!drop) throw new DomainError('NOT_FOUND', 'This drop is no longer available.')
      const product = requireProduct(ctx, drop.drop.productId)
      const sold = simulatedDropSales(drop, now) + drop.realSold
      const check = checkDropPurchase(drop.drop, {
        sold,
        userPurchased: drop.byUser.get(account.id) ?? 0,
        quantity: mode.quantity,
        tier: accountTier(account, now),
        isMember: true,
        now,
      })
      if (!check.ok) warnings.push(check.message)
      return {
        title: drop.drop.title,
        source: 'FLASH_DROP',
        lines: [
          {
            product,
            quantity: mode.quantity,
            unitPriceMinor: drop.drop.dropPriceMinor,
            note: 'Flash Drop price',
          },
        ],
        promoAllowed: false,
        recovery: null,
        record: null,
        pendingOrder: null,
        drop,
        paymentDueAt: null,
        warnings,
      }
    }
  }
}

export function findPromotion(ctx: Ctx, code: string): Promotion | null {
  const normalized = normalizeCode(code)
  for (const promotion of ctx.state.promotions.values())
    if (promotion.code === normalized) return promotion
  return null
}

function evaluateCode(
  ctx: Ctx,
  account: DemoAccount,
  code: string,
  context: 'CHECKOUT' | 'BID_PACK',
  subtotalMinor: number,
  lines: ResolvedLine[],
  now: number,
  bidPackId?: string,
) {
  const promotion = findPromotion(ctx, code)
  if (!promotion)
    return {
      promotion: null,
      result: { valid: false as const, reason: 'This code is not recognised.' },
    }
  const result = evaluatePromotion({
    promotion,
    context,
    now,
    userRedemptions: account.promoRedemptions.get(promotion.id) ?? 0,
    isNewCustomer: account.orderIds.length === 0,
    tier: accountTier(account, now),
    subtotalMinor,
    lines: lines.map((line) => ({
      categorySlug: line.product.categorySlug,
      lineTotalMinor: line.unitPriceMinor * line.quantity,
    })),
    bidPackId,
  })
  return { promotion, result }
}

function tierFreeDeliveryThreshold(account: DemoAccount, now: number): number | null {
  return compareTiers(accountTier(account, now), 'SILVER') >= 0 ? 3_000 : null
}

function computePricing(
  ctx: Ctx,
  account: DemoAccount,
  resolved: ResolvedCheckout,
  shippingMethodId: string,
  effect: PromotionEffect | null,
  now: number,
): PriceBreakdown {
  const market = getMarket('UK')
  const recoveryCredit =
    resolved.recovery?.eligible && resolved.recovery.mode === 'PRICE_CREDIT'
      ? resolved.recovery.valueMinor
      : 0
  const methodId = market.shippingMethods.some((method) => method.id === shippingMethodId)
    ? shippingMethodId
    : 'STANDARD'
  return priceCheckout({
    lines: resolved.lines.map((line) => ({
      unitPriceMinor: line.unitPriceMinor,
      quantity: line.quantity,
      categorySlug: line.product.categorySlug,
      shippingClass: line.product.shippingClass,
    })),
    market,
    shippingMethodId: methodId as 'STANDARD',
    promotion: effect,
    recoveryCreditMinor: recoveryCredit,
    freeStandardDeliveryOverMinor: tierFreeDeliveryThreshold(account, now),
  })
}

export interface CheckoutOptions {
  promoCode?: string | null
  shippingMethodId?: string
}

export function previewCheckout(
  ctx: Ctx,
  account: DemoAccount,
  mode: CheckoutMode,
  options: CheckoutOptions,
  now: number,
): CheckoutPreview {
  const resolved = resolveCheckout(ctx, account, mode, now)
  const market = getMarket('UK')
  const subtotal = resolved.lines.reduce(
    (total, line) => total + line.unitPriceMinor * line.quantity,
    0,
  )
  let promotion: CheckoutPreview['promotion'] = null
  let effect: PromotionEffect | null = null
  if (options.promoCode && options.promoCode.trim()) {
    const code = normalizeCode(options.promoCode)
    if (!resolved.promoAllowed) {
      promotion = { code, valid: false, message: 'Codes cannot be applied to this purchase.' }
    } else {
      const { result } = evaluateCode(ctx, account, code, 'CHECKOUT', subtotal, resolved.lines, now)
      promotion = result.valid
        ? { code, valid: true, message: result.effect.summary }
        : { code, valid: false, message: result.reason }
      if (result.valid) effect = result.effect
    }
  }
  const shippingMethodId = options.shippingMethodId ?? 'STANDARD'
  const pricing = computePricing(ctx, account, resolved, shippingMethodId, effect, now)
  const perk = tierFreeDeliveryThreshold(account, now)
  return {
    mode,
    title: resolved.title,
    lines: resolved.lines.map((line) => ({
      product: productCard(ctx, line.product, account),
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      lineTotalMinor: line.unitPriceMinor * line.quantity,
      note: line.note,
    })),
    pricing: {
      subtotalMinor: pricing.subtotalMinor,
      discountMinor: pricing.discountMinor,
      recoveryCreditMinor: pricing.recoveryCreditMinor,
      shippingMinor: pricing.shippingMinor,
      bulkySurchargeMinor: pricing.bulkySurchargeMinor,
      freeShippingApplied: pricing.freeShippingApplied,
      taxMinor: pricing.taxMinor,
      taxLabel: market.taxLabel,
      taxInclusive: pricing.taxInclusive,
      totalMinor: pricing.totalMinor,
      requiresShipping: pricing.requiresShipping,
    },
    promotion,
    promoAllowed: resolved.promoAllowed,
    recovery: resolved.recovery,
    shippingMethods: market.shippingMethods.map((method) => ({
      id: method.id,
      label: method.label,
      description: method.description,
      priceMinor: method.priceMinor,
      freeOverMinor:
        method.id === 'STANDARD' && perk !== null
          ? Math.min(perk, method.freeOverMinor ?? perk)
          : method.freeOverMinor,
    })),
    selectedShippingMethod: shippingMethodId,
    addresses: account.addresses,
    paymentMethods: PAYMENT_METHODS,
    paymentDueAt: resolved.paymentDueAt,
    warnings: resolved.warnings,
  }
}

export interface PlaceOrderOptions extends CheckoutOptions {
  addressId?: string | null
  paymentMethod: PaymentMethodOption
  requestId?: string | null
}

function orderLines(resolved: ResolvedCheckout): OrderLine[] {
  return resolved.lines.map((line) => ({
    productId: line.product.id,
    productSlug: line.product.slug,
    name: line.product.name,
    brandName: line.product.brandName,
    quantity: line.quantity,
    unitPriceMinor: line.unitPriceMinor,
    lineTotalMinor: line.unitPriceMinor * line.quantity,
    shippingClass: line.product.shippingClass,
  }))
}

export async function placeOrder(
  ctx: Ctx,
  account: DemoAccount,
  mode: CheckoutMode,
  options: PlaceOrderOptions,
  now: number,
): Promise<Order> {
  const { state } = ctx
  const resolved = resolveCheckout(ctx, account, mode, now)
  if (resolved.drop) {
    const sold = simulatedDropSales(resolved.drop, now) + resolved.drop.realSold
    const check = checkDropPurchase(resolved.drop.drop, {
      sold,
      userPurchased: resolved.drop.byUser.get(account.id) ?? 0,
      quantity: resolved.lines[0]!.quantity,
      tier: accountTier(account, now),
      isMember: true,
      now,
    })
    if (!check.ok) throw new DomainError(check.code, check.message)
  }
  const subtotal = resolved.lines.reduce(
    (total, line) => total + line.unitPriceMinor * line.quantity,
    0,
  )
  let effect: PromotionEffect | null = null
  let promotion: Promotion | null = null
  if (options.promoCode && options.promoCode.trim()) {
    if (!resolved.promoAllowed)
      throw new DomainError('PROMOTION_INVALID', 'Codes cannot be applied to this purchase.')
    const evaluated = evaluateCode(
      ctx,
      account,
      options.promoCode,
      'CHECKOUT',
      subtotal,
      resolved.lines,
      now,
    )
    if (!evaluated.result.valid) throw new DomainError('PROMOTION_INVALID', evaluated.result.reason)
    effect = evaluated.result.effect
    promotion = evaluated.promotion
  }
  const pricing = computePricing(
    ctx,
    account,
    resolved,
    options.shippingMethodId ?? 'STANDARD',
    effect,
    now,
  )
  const address =
    account.addresses.find((item) => item.id === options.addressId) ??
    account.addresses.find((item) => item.isDefault) ??
    null
  if (pricing.requiresShipping && !address)
    throw new DomainError('VALIDATION_FAILED', 'Please choose a delivery address.')

  // Reserve stock before taking payment; release it if payment fails.
  const reservationId = resolved.pendingOrder?.id ?? newId()
  const reserved: { productId: string; quantity: number }[] = []
  const reserveStock = () => {
    if (resolved.drop) return
    for (const line of resolved.lines) {
      if (line.product.shippingClass === 'DIGITAL') continue
      if (resolved.pendingOrder) continue
      if (resolved.record) ensureStock(ctx, line.product, now, line.quantity)
      const draft = planReservation(
        inventoryEvents(state, line.product.id),
        line.quantity,
        { type: 'ORDER', id: reservationId },
        'Checkout',
      )
      appendInventory(state, line.product.id, draft, now)
      reserved.push({ productId: line.product.id, quantity: line.quantity })
    }
  }
  reserveStock()

  const reference = shortReference('ESB', reservationId)
  track(
    ctx,
    'CHECKOUT_STARTED',
    { source: resolved.source, totalMinor: pricing.totalMinor },
    account.id,
  )
  const charge = await ctx.deps.payments.charge({
    amountMinor: pricing.totalMinor,
    currency: 'GBP',
    reference,
    description: resolved.title,
    customerId: account.id,
    method: options.paymentMethod,
  })

  if (charge.status !== 'SUCCEEDED') {
    for (const item of reserved) {
      const draft = planRelease(
        inventoryEvents(state, item.productId),
        { type: 'ORDER', id: reservationId },
        'Checkout',
        'Payment failed',
      )
      if (draft) appendInventory(state, item.productId, draft, now)
    }
    recordPayment(state, {
      providerReference: charge.providerReference,
      userId: account.id,
      customerName: account.displayName,
      kind: 'ORDER',
      orderId: resolved.pendingOrder?.id ?? null,
      bidPackOrderId: null,
      amountMinor: pricing.totalMinor,
      currency: 'GBP',
      status: 'FAILED',
      provider: ctx.deps.payments.name,
      methodLabel: charge.methodLabel,
      createdAt: now,
      simulated: charge.simulated,
      note: charge.failureReason ?? null,
    })
    audit(ctx, {
      actor: memberActor(account),
      action: 'payment.failed',
      entityType: 'PAYMENT',
      entityId: reference,
      severity: 'NOTICE',
      summary: `Payment failed for ${resolved.title} (${formatMinor(pricing.totalMinor)})`,
      metadata: { reason: charge.failureReason ?? null },
      requestId: options.requestId,
      at: now,
    })
    throw new DomainError(
      'PAYMENT_FAILED',
      charge.failureReason ?? 'The payment could not be completed.',
    )
  }

  const paymentSummary = {
    provider: ctx.deps.payments.name,
    status: 'SUCCEEDED' as const,
    reference: charge.providerReference,
    methodLabel: charge.methodLabel,
    paidAt: now,
  }
  let order: Order
  if (resolved.pendingOrder) {
    const pending = resolved.pendingOrder
    const product = resolved.lines[0]!.product
    if (pending.auctionId) {
      if (reservedFor(inventoryEvents(state, product.id), pending.auctionId) < 1) {
        ensureStock(ctx, product, now)
        appendInventory(
          state,
          product.id,
          planReservation(
            inventoryEvents(state, product.id),
            1,
            { type: 'AUCTION', id: pending.auctionId },
            'Payments',
          ),
          now,
        )
      }
      appendInventory(
        state,
        product.id,
        planSale(
          inventoryEvents(state, product.id),
          1,
          { type: 'AUCTION', id: pending.auctionId },
          'Payments',
        ),
        now,
      )
    }
    order = transitionOrder(
      {
        ...pending,
        subtotalMinor: pricing.subtotalMinor,
        discountMinor: pricing.discountMinor,
        shippingMinor: pricing.shippingMinor,
        taxMinor: pricing.taxMinor,
        totalMinor: pricing.totalMinor,
        shippingAddress: address,
        shippingMethod: options.shippingMethodId ?? 'STANDARD',
        payment: paymentSummary,
      },
      'PAID',
      now,
      account.displayName,
      null,
    )
  } else {
    order = buildOrder({
      userId: account.id,
      customerName: account.displayName,
      source: resolved.source,
      lines: orderLines(resolved),
      totals: pricing,
      promotionCode: promotion?.code ?? null,
      recovery: resolved.recovery?.eligible
        ? {
            mode: resolved.recovery.mode,
            credits: resolved.recovery.credits,
            valueMinor: resolved.recovery.valueMinor,
          }
        : null,
      address,
      shippingMethod: options.shippingMethodId ?? 'STANDARD',
      auctionId: resolved.record?.state.id ?? null,
      dropId: resolved.drop?.drop.id ?? null,
      status: 'PAID',
      createdAt: now,
      paymentDueAt: null,
      payment: paymentSummary,
      simulated: false,
      actor: account.displayName,
    })
    order = { ...order, id: reservationId, reference }
    for (const item of reserved) {
      appendInventory(
        state,
        item.productId,
        planSale(
          inventoryEvents(state, item.productId),
          item.quantity,
          { type: 'ORDER', id: reservationId },
          'Checkout',
        ),
        now,
      )
    }
  }
  storeOrder(state, order, account)
  state.progressingOrders.add(order.id)

  recordPayment(state, {
    providerReference: charge.providerReference,
    userId: account.id,
    customerName: account.displayName,
    kind: 'ORDER',
    orderId: order.id,
    bidPackOrderId: null,
    amountMinor: order.totalMinor,
    currency: 'GBP',
    status: 'SUCCEEDED',
    provider: ctx.deps.payments.name,
    methodLabel: charge.methodLabel,
    createdAt: now,
    simulated: charge.simulated,
  })

  if (mode.kind === 'CART') account.cart = []
  if (promotion) {
    promotion.usageCount += 1
    account.promoRedemptions.set(
      promotion.id,
      (account.promoRedemptions.get(promotion.id) ?? 0) + 1,
    )
  }
  if (resolved.drop) {
    const quantity = resolved.lines[0]!.quantity
    resolved.drop.realSold += quantity
    resolved.drop.byUser.set(account.id, (resolved.drop.byUser.get(account.id) ?? 0) + quantity)
    track(ctx, 'DROP_PURCHASE', { dropId: resolved.drop.drop.id, quantity }, account.id)
  }
  if (resolved.record) {
    resolved.record.buyNowConversions += 1
    resolved.record.buyNowRevenueMinor += order.totalMinor
    track(
      ctx,
      'BUY_NOW',
      { auctionId: resolved.record.state.id, recovery: !!order.recovery },
      account.id,
    )
    if (resolved.recovery?.eligible)
      applyRecovery(ctx, account, resolved.record, resolved.recovery, order, now)
  }

  audit(ctx, {
    actor: memberActor(account),
    action: 'payment.succeeded',
    entityType: 'PAYMENT',
    entityId: charge.providerReference,
    summary: `Payment of ${formatMinor(order.totalMinor)} for ${order.reference} (${charge.methodLabel})`,
    metadata: { orderId: order.id, simulated: charge.simulated },
    requestId: options.requestId,
    at: now,
  })
  audit(ctx, {
    actor: memberActor(account),
    action: resolved.pendingOrder ? 'order.status_changed' : 'order.created',
    entityType: 'ORDER',
    entityId: order.id,
    summary: resolved.pendingOrder
      ? `${order.reference}: PENDING_PAYMENT → PAID`
      : `Order ${order.reference} placed (${resolved.source})`,
    metadata: { totalMinor: order.totalMinor, source: order.source },
    requestId: options.requestId,
    at: now,
  })
  notify(
    ctx,
    account,
    'ORDER_PAID',
    `Payment confirmed for ${order.reference}`,
    `${resolved.title} — ${formatMinor(order.totalMinor)} (simulated payment).`,
    `/orders/${order.id}`,
    now,
  )
  awardPurchasePoints(ctx, account, order, now)
  awardAchievements(ctx, account, now)
  track(ctx, 'ORDER_COMPLETED', { source: order.source, totalMinor: order.totalMinor }, account.id)
  return order
}

function applyRecovery(
  ctx: Ctx,
  account: DemoAccount,
  record: AuctionRecord,
  quote: RecoveryQuote,
  order: Order,
  now: number,
): void {
  account.recoveredAuctions.add(record.state.id)
  record.recoveredValueMinor += quote.valueMinor
  if (quote.mode === 'RETURN_BIDS') {
    const parts: ['PURCHASED' | 'PROMOTIONAL', number][] = [
      ['PURCHASED', quote.purchasedCredits],
      ['PROMOTIONAL', quote.promotionalCredits],
    ]
    for (const [bucket, credits] of parts) {
      if (credits <= 0) continue
      account.ledger.push({
        id: newId(),
        userId: account.id,
        type: 'BUY_NOW_RECOVERY',
        bucket,
        credits,
        createdAt: now,
        expiresAt: bucket === 'PROMOTIONAL' ? now + PROMOTIONAL_CREDIT_VALIDITY_MS : null,
        lotId: null,
        description: `Buy Now recovery · ${record.state.title}`,
        reference: { type: 'ORDER', id: order.id },
        idempotencyKey: `recovery:${record.state.id}:${account.id}:${bucket}`,
      })
    }
  }
  audit(ctx, {
    actor: memberActor(account),
    action: 'wallet.recovery',
    entityType: 'WALLET',
    entityId: account.id,
    summary:
      quote.mode === 'RETURN_BIDS'
        ? `${quote.credits} bid credits returned via Buy Now recovery (${record.state.title})`
        : `${formatMinor(quote.valueMinor)} bid value credited against Buy Now (${record.state.title})`,
    metadata: {
      auctionId: record.state.id,
      orderId: order.id,
      mode: quote.mode,
      credits: quote.credits,
    },
    at: now,
  })
}

export interface BidPackPurchaseOptions {
  promoCode?: string | null
  paymentMethod: PaymentMethodOption
  requestId?: string | null
}

export async function purchaseBidPackage(
  ctx: Ctx,
  account: DemoAccount,
  packageId: string,
  options: BidPackPurchaseOptions,
  now: number,
) {
  const { state } = ctx
  const pack = state.packages.find((item) => item.id === packageId && item.active)
  if (!pack) throw new DomainError('NOT_FOUND', 'That bid pack is not available.')
  let discountMinor = 0
  let promoBonus = 0
  let promotion: Promotion | null = null
  if (options.promoCode && options.promoCode.trim()) {
    const evaluated = evaluateCode(
      ctx,
      account,
      options.promoCode,
      'BID_PACK',
      pack.priceMinor,
      [],
      now,
      pack.id,
    )
    if (!evaluated.result.valid) throw new DomainError('PROMOTION_INVALID', evaluated.result.reason)
    promotion = evaluated.promotion
    discountMinor = evaluated.result.effect.discountMinor
    promoBonus = evaluated.result.effect.bonusCredits
  }
  const totalMinor = pack.priceMinor - discountMinor
  const usage = usageSnapshot(account, now)
  const allowance = checkPurchaseAllowance(account.limits, usage, totalMinor, now)
  if (!allowance.allowed) throw new DomainError('RESPONSIBLE_USE_LIMIT', allowance.message)

  const orderId = newId()
  const reference = shortReference('ESB-BP', orderId)
  const charge = await ctx.deps.payments.charge({
    amountMinor: totalMinor,
    currency: 'GBP',
    reference,
    description: `${pack.name} bid pack`,
    customerId: account.id,
    method: options.paymentMethod,
  })
  const payment = recordPayment(state, {
    providerReference: charge.providerReference,
    userId: account.id,
    customerName: account.displayName,
    kind: 'BID_PACK',
    orderId: null,
    bidPackOrderId: orderId,
    amountMinor: totalMinor,
    currency: 'GBP',
    status: charge.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
    provider: ctx.deps.payments.name,
    methodLabel: charge.methodLabel,
    createdAt: now,
    simulated: charge.simulated,
    note: charge.failureReason ?? null,
  })
  const order: BidPackOrder = {
    id: orderId,
    reference,
    userId: account.id,
    customerName: account.displayName,
    packageId: pack.id,
    packageName: pack.name,
    credits: pack.credits,
    bonusCredits: pack.bonusCredits,
    promoBonusCredits: promoBonus,
    priceMinor: pack.priceMinor,
    discountMinor,
    totalMinor,
    promotionCode: promotion?.code ?? null,
    paymentId: payment.id,
    status: charge.status === 'SUCCEEDED' ? 'PAID' : 'FAILED',
    createdAt: now,
    simulated: charge.simulated,
  }
  state.bidPackOrders.unshift(order)
  if (charge.status !== 'SUCCEEDED') {
    audit(ctx, {
      actor: memberActor(account),
      action: 'payment.failed',
      entityType: 'PAYMENT',
      entityId: charge.providerReference,
      severity: 'NOTICE',
      summary: `Bid pack payment failed (${pack.name})`,
      metadata: {},
      requestId: options.requestId,
      at: now,
    })
    throw new DomainError(
      'PAYMENT_FAILED',
      charge.failureReason ?? 'The payment could not be completed.',
    )
  }

  account.ledger.push({
    id: newId(),
    userId: account.id,
    type: 'BID_PACK_PURCHASE',
    bucket: 'PURCHASED',
    credits: pack.credits,
    createdAt: now,
    expiresAt: null,
    lotId: null,
    description: `${pack.name} pack (${pack.credits} bids)`,
    reference: { type: 'BID_PACKAGE_ORDER', id: orderId },
    idempotencyKey: `pack:${orderId}`,
  })
  const bonus = pack.bonusCredits + promoBonus
  if (bonus > 0) {
    const bonusId = newId()
    account.ledger.push({
      id: bonusId,
      userId: account.id,
      type: 'PROMOTIONAL_CREDIT',
      bucket: 'PROMOTIONAL',
      credits: bonus,
      createdAt: now,
      expiresAt: now + BONUS_CREDIT_VALIDITY_DAYS * DAY,
      lotId: bonusId,
      description:
        promoBonus > 0
          ? `${pack.name} bonus + ${promotion?.code} (${bonus} bids)`
          : `${pack.name} bonus bids`,
      reference: { type: 'BID_PACKAGE_ORDER', id: orderId },
      idempotencyKey: `pack-bonus:${orderId}`,
    })
  }
  account.bidPackSpend.push({ at: now, amountMinor: totalMinor })
  if (promotion) {
    promotion.usageCount += 1
    account.promoRedemptions.set(
      promotion.id,
      (account.promoRedemptions.get(promotion.id) ?? 0) + 1,
    )
  }
  if (account.limits.spendingNotifications) {
    const budget = account.limits.monthlyBidPurchaseBudgetMinor
    const crossed = thresholdCrossed(
      budget,
      usage.bidPackSpendThisMonthMinor,
      usage.bidPackSpendThisMonthMinor + totalMinor,
    )
    notify(
      ctx,
      account,
      'LIMIT_THRESHOLD',
      crossed !== null
        ? `You have used ${Math.round(crossed * 100)}% of your monthly bid budget`
        : 'Bid pack purchased',
      budget !== null
        ? `${formatMinor(usage.bidPackSpendThisMonthMinor + totalMinor)} of your ${formatMinor(budget)} monthly budget spent.`
        : `You spent ${formatMinor(totalMinor)} on bid packs. Consider setting a monthly budget.`,
      '/account#responsible-use',
      now,
    )
  }
  audit(ctx, {
    actor: memberActor(account),
    action: 'wallet.credit',
    entityType: 'WALLET',
    entityId: account.id,
    summary: `${pack.credits} bids purchased (${pack.name}) + ${bonus} bonus for ${formatMinor(totalMinor)} (simulated)`,
    metadata: { orderId, packageId: pack.id, credits: pack.credits, bonus, totalMinor },
    requestId: options.requestId,
    at: now,
  })
  track(ctx, 'BID_PACK_PURCHASE', { packageId: pack.id, totalMinor }, account.id)
  return { order, walletAvailable: summarizeWallet(account.ledger, now).available }
}

export function redeemReward(ctx: Ctx, account: DemoAccount, optionId: string, now: number) {
  const option = REDEMPTION_OPTIONS.find((item) => item.id === optionId)
  if (!option) throw new DomainError('NOT_FOUND', 'That reward is not available.')
  const balance = rewardBalance(account.rewards)
  if (balance < option.points)
    throw new DomainError(
      'VALIDATION_FAILED',
      `You need ${option.points - balance} more points for this reward.`,
    )
  const redemptionId = newId()
  account.rewards.push({
    id: newId(),
    type: 'REDEEM',
    points: -option.points,
    at: now,
    description: `Redeemed: ${option.label}`,
    reference: { type: 'REDEMPTION', id: redemptionId },
  })
  let voucherCode: string | null = null
  if (option.bidCredits) {
    const lotId = newId()
    account.ledger.push({
      id: lotId,
      userId: account.id,
      type: 'PROMOTIONAL_CREDIT',
      bucket: 'PROMOTIONAL',
      credits: option.bidCredits,
      createdAt: now,
      expiresAt: now + PROMOTIONAL_CREDIT_VALIDITY_MS,
      lotId,
      description: `Rewards redemption (${option.points} points)`,
      reference: { type: 'REWARD_REDEMPTION', id: redemptionId },
      idempotencyKey: `redeem:${redemptionId}`,
    })
  }
  if (option.voucherMinor) {
    voucherCode = `ESB${deterministicUuid(redemptionId).slice(0, 6).toUpperCase()}`
    const promotion: Promotion = {
      id: newId(),
      code: voucherCode,
      name: `£${(option.voucherMinor / 100).toFixed(0)} rewards voucher`,
      description: 'Single-use rewards voucher',
      type: 'FIXED_DISCOUNT',
      value: option.voucherMinor,
      valueKind: 'FIXED',
      startsAt: now,
      endsAt: now + 90 * DAY,
      usageLimit: 1,
      usageCount: 0,
      perUserLimit: 1,
      minimumSpendMinor: 2_500,
      maximumDiscountMinor: null,
      eligibility: {
        newCustomersOnly: false,
        minimumTier: null,
        categories: null,
        bidPackIds: null,
      },
      status: 'ACTIVE',
      createdAt: now,
    }
    ctx.state.promotions.set(promotion.id, promotion)
  }
  audit(ctx, {
    actor: memberActor(account),
    action: 'rewards.redeemed',
    entityType: 'WALLET',
    entityId: account.id,
    summary: `Redeemed ${option.points} points for ${option.label}`,
    metadata: { optionId, voucherCode },
    at: now,
  })
  return {
    balance: rewardBalance(account.rewards),
    voucherCode,
    walletAvailable: summarizeWallet(account.ledger, now).available,
  }
}
