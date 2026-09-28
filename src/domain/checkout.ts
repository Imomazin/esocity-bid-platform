import { DomainError } from '@/domain/errors'
import type { ShippingClass } from '@/domain/catalog'
import type { PromotionEffect } from '@/domain/promotions'
import type { MarketConfig, ShippingMethodConfig } from '@/lib/config/market'
import { money, taxFromGross, taxOnNet } from '@/lib/money'

/** Checkout pricing. All amounts are integer minor units. */

export interface PricingLine {
  unitPriceMinor: number
  quantity: number
  categorySlug: string
  shippingClass: ShippingClass
}

export interface PricingInput {
  lines: PricingLine[]
  market: MarketConfig
  shippingMethodId: ShippingMethodConfig['id']
  promotion: PromotionEffect | null
  /** Additional price reduction from Bid Credit Recovery (PRICE_CREDIT mode). */
  recoveryCreditMinor?: number
  /** Tier perk: free standard delivery threshold override. */
  freeStandardDeliveryOverMinor?: number | null
}

export interface PriceBreakdown {
  subtotalMinor: number
  discountMinor: number
  recoveryCreditMinor: number
  shippingMinor: number
  shippingBaseMinor: number
  bulkySurchargeMinor: number
  freeShippingApplied: boolean
  taxMinor: number
  taxInclusive: boolean
  totalMinor: number
  requiresShipping: boolean
}

export function priceCheckout(input: PricingInput): PriceBreakdown {
  if (input.lines.length === 0) throw new DomainError('CART_EMPTY', 'Your basket is empty.')
  for (const line of input.lines) {
    if (!Number.isSafeInteger(line.unitPriceMinor) || line.unitPriceMinor < 0) {
      throw new DomainError('VALIDATION_FAILED', 'Invalid line price')
    }
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
      throw new DomainError('VALIDATION_FAILED', 'Quantities must be between 1 and 20')
    }
  }
  const method = input.market.shippingMethods.find(
    (candidate) => candidate.id === input.shippingMethodId,
  )
  if (!method) throw new DomainError('VALIDATION_FAILED', 'Unknown delivery option')

  const subtotalMinor = input.lines.reduce(
    (total, line) => total + line.unitPriceMinor * line.quantity,
    0,
  )
  const discountMinor = Math.min(input.promotion?.discountMinor ?? 0, subtotalMinor)
  const recoveryCreditMinor = Math.min(
    input.recoveryCreditMinor ?? 0,
    subtotalMinor - discountMinor,
  )
  const merchandiseAfterDiscounts = subtotalMinor - discountMinor - recoveryCreditMinor

  const requiresShipping = input.lines.some((line) => line.shippingClass !== 'DIGITAL')
  let shippingBaseMinor = 0
  let bulkySurchargeMinor = 0
  let freeShippingApplied = false
  if (requiresShipping) {
    shippingBaseMinor = method.priceMinor
    const perkThreshold = input.freeStandardDeliveryOverMinor ?? null
    const freeThreshold =
      method.id === 'STANDARD' && perkThreshold !== null
        ? Math.min(perkThreshold, method.freeOverMinor ?? Number.MAX_SAFE_INTEGER)
        : method.freeOverMinor
    if (
      (freeThreshold !== null && merchandiseAfterDiscounts >= freeThreshold) ||
      input.promotion?.freeShipping
    ) {
      shippingBaseMinor = 0
      freeShippingApplied = true
    }
    bulkySurchargeMinor = input.lines.some((line) => line.shippingClass === 'LARGE')
      ? input.market.bulkyItemSurchargeMinor
      : 0
  }
  const shippingMinor = shippingBaseMinor + bulkySurchargeMinor
  const taxable = money(merchandiseAfterDiscounts + shippingMinor, input.market.currency)
  const taxMinor = input.market.taxInclusivePricing
    ? taxFromGross(taxable, input.market.taxRateBasisPoints).amount
    : taxOnNet(taxable, input.market.taxRateBasisPoints).amount
  const totalMinor =
    merchandiseAfterDiscounts + shippingMinor + (input.market.taxInclusivePricing ? 0 : taxMinor)

  return {
    subtotalMinor,
    discountMinor,
    recoveryCreditMinor,
    shippingMinor,
    shippingBaseMinor,
    bulkySurchargeMinor,
    freeShippingApplied,
    taxMinor,
    taxInclusive: input.market.taxInclusivePricing,
    totalMinor,
    requiresShipping,
  }
}

/** Refund amount helper: never refunds more than was paid minus previous refunds. */
export function refundableAmount(
  totalPaidMinor: number,
  alreadyRefundedMinor: number,
  requestedMinor?: number,
): number {
  const remaining = Math.max(0, totalPaidMinor - alreadyRefundedMinor)
  if (requestedMinor === undefined) return remaining
  if (!Number.isSafeInteger(requestedMinor) || requestedMinor <= 0) {
    throw new DomainError('VALIDATION_FAILED', 'Refund amount must be a positive amount')
  }
  if (requestedMinor > remaining) {
    throw new DomainError('VALIDATION_FAILED', 'Refund exceeds the refundable balance')
  }
  return requestedMinor
}
