import { describe, expect, it } from 'vitest'

import { priceCheckout, refundableAmount, type PricingLine } from '@/domain/checkout'
import { checkDropPurchase, dropStatus, type FlashDrop } from '@/domain/drops'
import { DomainError } from '@/domain/errors'
import {
  evaluatePromotion,
  normalizeCode,
  promotionState,
  type Promotion,
  type PromotionEvaluationInput,
} from '@/domain/promotions'
import { MARKETS } from '@/lib/config/market'
import { DAY, HOUR } from '@/lib/time'

import { T0 } from './fixtures'

const UK = MARKETS.UK
const line = (
  unitPriceMinor: number,
  quantity = 1,
  overrides: Partial<PricingLine> = {},
): PricingLine => ({
  unitPriceMinor,
  quantity,
  categorySlug: 'audio',
  shippingClass: 'STANDARD',
  ...overrides,
})

describe('checkout pricing (UK, VAT-inclusive)', () => {
  it('charges standard delivery below the free-delivery threshold and extracts VAT', () => {
    const price = priceCheckout({
      lines: [line(2_000)],
      market: UK,
      shippingMethodId: 'STANDARD',
      promotion: null,
    })
    expect(price).toMatchObject({
      subtotalMinor: 2_000,
      shippingMinor: 399,
      totalMinor: 2_399,
      taxInclusive: true,
    })
    expect(price.taxMinor).toBe(400) // 2 399 × 20 / 120 = 399.83 → 400
  })

  it('ships free at or above £50 after discounts, and adds the bulky surcharge', () => {
    expect(
      priceCheckout({
        lines: [line(2_500, 2)],
        market: UK,
        shippingMethodId: 'STANDARD',
        promotion: null,
      }).freeShippingApplied,
    ).toBe(true)
    const discounted = priceCheckout({
      lines: [line(5_000)],
      market: UK,
      shippingMethodId: 'STANDARD',
      promotion: { discountMinor: 500, freeShipping: false, bonusCredits: 0, summary: '' },
    })
    expect(discounted).toMatchObject({ discountMinor: 500, shippingMinor: 399, totalMinor: 4_899 })
    const bulky = priceCheckout({
      lines: [line(60_000, 1, { shippingClass: 'LARGE' })],
      market: UK,
      shippingMethodId: 'STANDARD',
      promotion: null,
    })
    expect(bulky).toMatchObject({
      shippingBaseMinor: 0,
      bulkySurchargeMinor: 1_500,
      totalMinor: 61_500,
    })
  })

  it('never charges delivery for digital-only baskets', () => {
    const digital = priceCheckout({
      lines: [line(1_000, 1, { shippingClass: 'DIGITAL' })],
      market: UK,
      shippingMethodId: 'EXPRESS',
      promotion: null,
    })
    expect(digital).toMatchObject({ requiresShipping: false, shippingMinor: 0, totalMinor: 1_000 })
  })

  it('applies a tier free-delivery perk and bid recovery price credit without going negative', () => {
    const perk = priceCheckout({
      lines: [line(3_000)],
      market: UK,
      shippingMethodId: 'STANDARD',
      promotion: null,
      freeStandardDeliveryOverMinor: 3_000,
    })
    expect(perk.freeShippingApplied).toBe(true)
    const recovery = priceCheckout({
      lines: [line(3_000)],
      market: UK,
      shippingMethodId: 'EXPRESS',
      promotion: null,
      recoveryCreditMinor: 10_000,
    })
    expect(recovery).toMatchObject({
      recoveryCreditMinor: 3_000,
      shippingMinor: 699,
      totalMinor: 699,
    })
  })

  it('rejects empty baskets, invalid quantities and unknown delivery options', () => {
    expect(() =>
      priceCheckout({ lines: [], market: UK, shippingMethodId: 'STANDARD', promotion: null }),
    ).toThrow(expect.objectContaining({ code: 'CART_EMPTY' }))
    expect(() =>
      priceCheckout({
        lines: [line(100, 21)],
        market: UK,
        shippingMethodId: 'STANDARD',
        promotion: null,
      }),
    ).toThrow(DomainError)
    expect(() =>
      priceCheckout({
        lines: [line(100)],
        market: MARKETS.IE,
        shippingMethodId: 'NEXT_DAY',
        promotion: null,
      }),
    ).toThrow(/delivery option/)
  })

  it('adds tax on top in tax-exclusive markets', () => {
    const market = { ...MARKETS.US, taxRateBasisPoints: 800 }
    const price = priceCheckout({
      lines: [line(10_000)],
      market,
      shippingMethodId: 'STANDARD',
      promotion: null,
    })
    expect(price).toMatchObject({ taxInclusive: false, taxMinor: 800, totalMinor: 10_800 })
  })

  it('never refunds more than was paid', () => {
    expect(refundableAmount(5_000, 1_000)).toBe(4_000)
    expect(refundableAmount(5_000, 1_000, 4_000)).toBe(4_000)
    expect(() => refundableAmount(5_000, 1_000, 4_001)).toThrow(/exceeds/)
    expect(() => refundableAmount(5_000, 0, 0)).toThrow(DomainError)
    expect(refundableAmount(5_000, 6_000)).toBe(0)
  })
})

describe('promotions', () => {
  const promotion = (overrides: Partial<Promotion> = {}): Promotion => ({
    id: 'promo-1',
    code: 'SAVE10',
    name: 'Save 10%',
    description: '',
    type: 'PERCENT_DISCOUNT',
    value: 1_000,
    valueKind: 'PERCENT',
    startsAt: T0 - DAY,
    endsAt: T0 + DAY,
    usageLimit: null,
    usageCount: 0,
    perUserLimit: 1,
    minimumSpendMinor: null,
    maximumDiscountMinor: null,
    eligibility: { newCustomersOnly: false, minimumTier: null, categories: null, bidPackIds: null },
    status: 'ACTIVE',
    createdAt: T0 - DAY,
    ...overrides,
  })
  const evaluate = (promo: Promotion, overrides: Partial<PromotionEvaluationInput> = {}) =>
    evaluatePromotion({
      promotion: promo,
      context: 'CHECKOUT',
      now: T0,
      userRedemptions: 0,
      isNewCustomer: false,
      tier: 'MEMBER',
      subtotalMinor: 10_000,
      ...overrides,
    })

  it('normalises codes', () => {
    expect(normalizeCode('  save 10 ')).toBe('SAVE10')
  })

  it('applies percentage, fixed and capped discounts', () => {
    expect(evaluate(promotion())).toMatchObject({ valid: true, effect: { discountMinor: 1_000 } })
    expect(evaluate(promotion({ maximumDiscountMinor: 700 }))).toMatchObject({
      effect: { discountMinor: 700 },
    })
    expect(
      evaluate(promotion({ type: 'FIXED_DISCOUNT', value: 15_000, valueKind: 'FIXED' })),
    ).toMatchObject({ effect: { discountMinor: 10_000 } })
    expect(
      evaluate(promotion({ type: 'FREE_SHIPPING', value: 0, valueKind: 'NONE' })),
    ).toMatchObject({ effect: { freeShipping: true, discountMinor: 0 } })
  })

  it('discounts only eligible categories for category offers', () => {
    const offer = promotion({
      type: 'CATEGORY_OFFER',
      value: 2_000,
      eligibility: {
        newCustomersOnly: false,
        minimumTier: null,
        categories: ['audio'],
        bidPackIds: null,
      },
    })
    const lines = [
      { categorySlug: 'audio', lineTotalMinor: 4_000 },
      { categorySlug: 'home', lineTotalMinor: 6_000 },
    ]
    expect(evaluate(offer, { lines })).toMatchObject({ effect: { discountMinor: 800 } })
    expect(evaluate(offer, { lines: [lines[1]!] })).toEqual({
      valid: false,
      reason: 'No items in your basket qualify for this offer.',
    })
  })

  it.each([
    ['paused', { status: 'PAUSED' as const }, {}, 'This code is not active.'],
    ['not started', { startsAt: T0 + HOUR }, {}, 'This code is not active yet.'],
    ['expired', { endsAt: T0 }, {}, 'This code has expired.'],
    ['exhausted', { usageLimit: 5, usageCount: 5 }, {}, 'This code has reached its usage limit.'],
    [
      'used by this member',
      {},
      { userRedemptions: 1 },
      'You have already used this code the maximum number of times.',
    ],
    [
      'for new customers',
      { type: 'NEW_CUSTOMER' as const },
      {},
      'This code is for new customers only.',
    ],
    [
      'below minimum spend',
      { minimumSpendMinor: 20_000 },
      {},
      'Spend at least £200.00 to use this code.',
    ],
    [
      'a bid pack code at checkout',
      { type: 'BONUS_BID_CREDITS' as const, value: 20, valueKind: 'CREDITS' as const },
      {},
      'This code can only be used when buying bid packs.',
    ],
    [
      'a checkout code on a bid pack',
      {},
      { context: 'BID_PACK' as const },
      'This code can only be used at checkout.',
    ],
  ])('rejects a code that is %s', (_label, promoOverrides, inputOverrides, reason) => {
    expect(
      evaluate(
        promotion(promoOverrides as Partial<Promotion>),
        inputOverrides as Partial<PromotionEvaluationInput>,
      ),
    ).toEqual({ valid: false, reason })
  })

  it('grants bonus credits on eligible bid packs only', () => {
    const bonus = promotion({
      type: 'BONUS_BID_CREDITS',
      value: 25,
      valueKind: 'CREDITS',
      eligibility: {
        newCustomersOnly: false,
        minimumTier: null,
        categories: null,
        bidPackIds: ['power'],
      },
    })
    expect(evaluate(bonus, { context: 'BID_PACK', bidPackId: 'power' })).toMatchObject({
      valid: true,
      effect: { bonusCredits: 25 },
    })
    expect(evaluate(bonus, { context: 'BID_PACK', bidPackId: 'starter' })).toMatchObject({
      valid: false,
    })
  })

  it('derives the operator-facing state', () => {
    expect(promotionState(promotion(), T0)).toBe('LIVE')
    expect(promotionState(promotion({ startsAt: T0 + HOUR }), T0)).toBe('SCHEDULED')
    expect(promotionState(promotion({ usageLimit: 1, usageCount: 1 }), T0)).toBe('EXHAUSTED')
    expect(promotionState(promotion(), T0 + 2 * DAY)).toBe('EXPIRED')
  })
})

describe('flash drops', () => {
  const drop: FlashDrop = {
    id: 'drop-1',
    slug: 'drop',
    productId: 'product-1',
    title: 'Drop',
    subtitle: '',
    dropPriceMinor: 9_900,
    referencePriceMinor: 14_900,
    stockTotal: 10,
    perCustomerLimit: 2,
    startsAt: T0,
    endsAt: T0 + HOUR,
    eligibility: { minimumTier: null, membersOnly: true },
  }
  const ctx = {
    sold: 0,
    userPurchased: 0,
    quantity: 1,
    tier: 'MEMBER' as const,
    isMember: true,
    now: T0,
  }

  it('computes status from time and stock', () => {
    expect(dropStatus(drop, 0, T0 - 1)).toBe('UPCOMING')
    expect(dropStatus(drop, 3, T0)).toBe('LIVE')
    expect(dropStatus(drop, 10, T0)).toBe('SOLD_OUT')
    expect(dropStatus(drop, 3, T0 + HOUR)).toBe('ENDED')
  })

  it('enforces per-member limits, stock and membership', () => {
    expect(checkDropPurchase(drop, ctx)).toEqual({ ok: true })
    expect(checkDropPurchase(drop, { ...ctx, userPurchased: 1, quantity: 2 })).toMatchObject({
      code: 'PURCHASE_LIMIT_REACHED',
    })
    expect(checkDropPurchase(drop, { ...ctx, sold: 9, quantity: 2 })).toMatchObject({
      code: 'DROP_SOLD_OUT',
    })
    expect(checkDropPurchase(drop, { ...ctx, isMember: false })).toMatchObject({
      code: 'NOT_ELIGIBLE',
    })
    expect(checkDropPurchase(drop, { ...ctx, quantity: 0 })).toMatchObject({
      code: 'VALIDATION_FAILED',
    })
    expect(checkDropPurchase(drop, { ...ctx, now: T0 + HOUR })).toMatchObject({
      code: 'DROP_NOT_LIVE',
    })
  })
})
