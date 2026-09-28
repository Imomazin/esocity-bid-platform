import { tierAtLeast, type RewardTier } from '@/domain/rewards'
import { money, percentageDiscount } from '@/lib/money'

/** Promotions engine: validation is explicit and every rejection has a clear reason. */

export const PROMOTION_TYPES = [
  'PERCENT_DISCOUNT',
  'FIXED_DISCOUNT',
  'FREE_SHIPPING',
  'BONUS_BID_CREDITS',
  'BID_PACK_DISCOUNT',
  'CATEGORY_OFFER',
  'NEW_CUSTOMER',
] as const

export type PromotionType = (typeof PROMOTION_TYPES)[number]

export const PROMOTION_TYPE_LABELS: Record<PromotionType, string> = {
  PERCENT_DISCOUNT: 'Percentage coupon',
  FIXED_DISCOUNT: 'Fixed-amount coupon',
  FREE_SHIPPING: 'Free shipping',
  BONUS_BID_CREDITS: 'Bonus bid credits',
  BID_PACK_DISCOUNT: 'Bid pack discount',
  CATEGORY_OFFER: 'Category offer',
  NEW_CUSTOMER: 'New customer offer',
}

export type PromotionStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED'

export interface PromotionEligibility {
  newCustomersOnly: boolean
  minimumTier: RewardTier | null
  categories: string[] | null
  bidPackIds: string[] | null
}

export interface Promotion {
  id: string
  code: string
  name: string
  description: string
  type: PromotionType
  /**
   * PERCENT_DISCOUNT / CATEGORY_OFFER / NEW_CUSTOMER / BID_PACK_DISCOUNT: basis points.
   * FIXED_DISCOUNT: minor units. BONUS_BID_CREDITS: credits. FREE_SHIPPING: unused (0).
   */
  value: number
  /** NEW_CUSTOMER offers may be fixed instead of percentage. */
  valueKind: 'PERCENT' | 'FIXED' | 'CREDITS' | 'NONE'
  startsAt: number
  endsAt: number
  usageLimit: number | null
  usageCount: number
  perUserLimit: number | null
  minimumSpendMinor: number | null
  maximumDiscountMinor: number | null
  eligibility: PromotionEligibility
  status: PromotionStatus
  createdAt: number
}

export type PromotionContext = 'CHECKOUT' | 'BID_PACK'

export interface PromotionEvaluationInput {
  promotion: Promotion
  context: PromotionContext
  now: number
  userRedemptions: number
  isNewCustomer: boolean
  tier: RewardTier
  /** Merchandise subtotal (checkout) or pack price (bid pack), minor units. */
  subtotalMinor: number
  /** Checkout lines by category, used by category offers. */
  lines?: { categorySlug: string; lineTotalMinor: number }[]
  bidPackId?: string
}

export interface PromotionEffect {
  discountMinor: number
  freeShipping: boolean
  bonusCredits: number
  summary: string
}

export type PromotionEvaluation =
  { valid: true; effect: PromotionEffect } | { valid: false; reason: string }

function invalid(reason: string): PromotionEvaluation {
  return { valid: false, reason }
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '')
}

export function evaluatePromotion(input: PromotionEvaluationInput): PromotionEvaluation {
  const { promotion: promo, now } = input
  if (promo.status !== 'ACTIVE') return invalid('This code is not active.')
  if (now < promo.startsAt) return invalid('This code is not active yet.')
  if (now >= promo.endsAt) return invalid('This code has expired.')
  if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) {
    return invalid('This code has reached its usage limit.')
  }
  if (promo.perUserLimit !== null && input.userRedemptions >= promo.perUserLimit) {
    return invalid('You have already used this code the maximum number of times.')
  }
  if (
    (promo.eligibility.newCustomersOnly || promo.type === 'NEW_CUSTOMER') &&
    !input.isNewCustomer
  ) {
    return invalid('This code is for new customers only.')
  }
  if (!tierAtLeast(input.tier, promo.eligibility.minimumTier)) {
    return invalid(
      `This code requires ${promo.eligibility.minimumTier?.toLowerCase()} status or above.`,
    )
  }
  const bidPackTypes: PromotionType[] = ['BONUS_BID_CREDITS', 'BID_PACK_DISCOUNT']
  if (input.context === 'BID_PACK' && !bidPackTypes.includes(promo.type)) {
    return invalid('This code can only be used at checkout.')
  }
  if (input.context === 'CHECKOUT' && bidPackTypes.includes(promo.type)) {
    return invalid('This code can only be used when buying bid packs.')
  }
  if (
    input.context === 'BID_PACK' &&
    promo.eligibility.bidPackIds &&
    input.bidPackId &&
    !promo.eligibility.bidPackIds.includes(input.bidPackId)
  ) {
    return invalid('This code does not apply to the selected bid pack.')
  }
  if (promo.minimumSpendMinor !== null && input.subtotalMinor < promo.minimumSpendMinor) {
    return invalid(
      `Spend at least £${(promo.minimumSpendMinor / 100).toFixed(2)} to use this code.`,
    )
  }

  const subtotal = money(input.subtotalMinor)
  const cap = (value: number) =>
    Math.min(value, promo.maximumDiscountMinor ?? Number.MAX_SAFE_INTEGER, input.subtotalMinor)

  switch (promo.type) {
    case 'PERCENT_DISCOUNT':
    case 'BID_PACK_DISCOUNT': {
      const discount = cap(percentageDiscount(subtotal, promo.value).amount)
      return {
        valid: true,
        effect: {
          discountMinor: discount,
          freeShipping: false,
          bonusCredits: 0,
          summary: `${promo.value / 100}% off`,
        },
      }
    }
    case 'NEW_CUSTOMER': {
      const discount = cap(
        promo.valueKind === 'FIXED'
          ? promo.value
          : percentageDiscount(subtotal, promo.value).amount,
      )
      return {
        valid: true,
        effect: {
          discountMinor: discount,
          freeShipping: false,
          bonusCredits: 0,
          summary:
            promo.valueKind === 'FIXED'
              ? `£${(promo.value / 100).toFixed(2)} off your first order`
              : `${promo.value / 100}% off your first order`,
        },
      }
    }
    case 'FIXED_DISCOUNT': {
      const discount = cap(promo.value)
      return {
        valid: true,
        effect: {
          discountMinor: discount,
          freeShipping: false,
          bonusCredits: 0,
          summary: `£${(promo.value / 100).toFixed(2)} off`,
        },
      }
    }
    case 'FREE_SHIPPING':
      return {
        valid: true,
        effect: {
          discountMinor: 0,
          freeShipping: true,
          bonusCredits: 0,
          summary: 'Free standard delivery',
        },
      }
    case 'BONUS_BID_CREDITS':
      return {
        valid: true,
        effect: {
          discountMinor: 0,
          freeShipping: false,
          bonusCredits: promo.value,
          summary: `+${promo.value} bonus bids`,
        },
      }
    case 'CATEGORY_OFFER': {
      const categories = promo.eligibility.categories ?? []
      const eligibleTotal = (input.lines ?? [])
        .filter((line) => categories.includes(line.categorySlug))
        .reduce((total, line) => total + line.lineTotalMinor, 0)
      if (eligibleTotal === 0) return invalid('No items in your basket qualify for this offer.')
      const discount = cap(percentageDiscount(money(eligibleTotal), promo.value).amount)
      return {
        valid: true,
        effect: {
          discountMinor: discount,
          freeShipping: false,
          bonusCredits: 0,
          summary: `${promo.value / 100}% off eligible items`,
        },
      }
    }
  }
}

export function promotionState(
  promo: Promotion,
  now: number,
): 'SCHEDULED' | 'LIVE' | 'EXPIRED' | 'PAUSED' | 'EXHAUSTED' | 'ARCHIVED' {
  if (promo.status === 'ARCHIVED') return 'ARCHIVED'
  if (promo.status === 'PAUSED') return 'PAUSED'
  if (now >= promo.endsAt) return 'EXPIRED'
  if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit) return 'EXHAUSTED'
  if (now < promo.startsAt) return 'SCHEDULED'
  return 'LIVE'
}
