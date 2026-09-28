import type { CompliancePolicy } from '@/domain/compliance'
import type { CurrencyCode } from '@/lib/money'

/**
 * Market configuration. Commercial assumptions (currency, tax, shipping, age eligibility and
 * whether paid-bid mechanics are enabled) live here rather than being hard-coded in components.
 *
 * IMPORTANT: `paidBiddingEnabled` and related switches are configuration hooks only. Whether
 * pay-to-bid mechanics are permitted in a jurisdiction requires legal review — see
 * docs/COMPLIANCE.md. No legal conclusion is encoded here.
 */

export type MarketCode = 'UK' | 'IE' | 'US'

export interface ShippingMethodConfig {
  id: 'STANDARD' | 'EXPRESS' | 'NEXT_DAY'
  label: string
  description: string
  priceMinor: number
  /** Orders at or above this subtotal ship free with this method (null = never free). */
  freeOverMinor: number | null
  minDays: number
  maxDays: number
}

export interface MarketConfig {
  code: MarketCode
  name: string
  locale: string
  timeZone: string
  currency: CurrencyCode
  /** Consumer prices include tax (true for UK VAT). */
  taxInclusivePricing: boolean
  taxLabel: string
  taxRateBasisPoints: number
  minimumAge: number
  paidBiddingEnabled: boolean
  buyNowRecoveryEnabled: boolean
  bulkyItemSurchargeMinor: number
  shippingMethods: ShippingMethodConfig[]
  returnsWindowDays: number
  statutoryCoolingOffDays: number
  /** Terms, age and identity gates per action. Hooks only; set by legal review (docs/COMPLIANCE.md). */
  compliance: CompliancePolicy
}

/** Current member terms version. Bumping it requires members to accept the new terms. */
export const TERMS_VERSION = '2026-09-01'

const STANDARD_COMPLIANCE: CompliancePolicy = {
  termsVersion: TERMS_VERSION,
  termsRequiredFor: ['PLACE_BID', 'BUY_BID_PACK', 'CHECKOUT'],
  ageVerificationRequiredFor: ['PLACE_BID', 'BUY_BID_PACK'],
  // KYC placeholder: no market requires identity verification until legal review says otherwise.
  kycRequiredFor: [],
}

export const MARKETS: Record<MarketCode, MarketConfig> = {
  UK: {
    code: 'UK',
    name: 'United Kingdom',
    locale: 'en-GB',
    timeZone: 'Europe/London',
    currency: 'GBP',
    taxInclusivePricing: true,
    taxLabel: 'VAT',
    taxRateBasisPoints: 2000,
    minimumAge: 18,
    paidBiddingEnabled: true,
    buyNowRecoveryEnabled: true,
    bulkyItemSurchargeMinor: 1500,
    shippingMethods: [
      {
        id: 'STANDARD',
        label: 'Standard delivery',
        description: 'Tracked, 3–5 working days',
        priceMinor: 399,
        freeOverMinor: 5000,
        minDays: 3,
        maxDays: 5,
      },
      {
        id: 'EXPRESS',
        label: 'Express delivery',
        description: 'Tracked, 1–2 working days',
        priceMinor: 699,
        freeOverMinor: null,
        minDays: 1,
        maxDays: 2,
      },
      {
        id: 'NEXT_DAY',
        label: 'Next-day delivery',
        description: 'Order by 8pm, delivered next working day',
        priceMinor: 999,
        freeOverMinor: null,
        minDays: 1,
        maxDays: 1,
      },
    ],
    returnsWindowDays: 30,
    statutoryCoolingOffDays: 14,
    compliance: STANDARD_COMPLIANCE,
  },
  IE: {
    code: 'IE',
    name: 'Ireland',
    locale: 'en-IE',
    timeZone: 'Europe/Dublin',
    currency: 'EUR',
    taxInclusivePricing: true,
    taxLabel: 'VAT',
    taxRateBasisPoints: 2300,
    minimumAge: 18,
    // Placeholder market: disabled until legal review is complete.
    paidBiddingEnabled: false,
    buyNowRecoveryEnabled: false,
    bulkyItemSurchargeMinor: 1800,
    shippingMethods: [
      {
        id: 'STANDARD',
        label: 'Standard delivery',
        description: 'Tracked, 3–6 working days',
        priceMinor: 499,
        freeOverMinor: 6000,
        minDays: 3,
        maxDays: 6,
      },
    ],
    returnsWindowDays: 30,
    statutoryCoolingOffDays: 14,
    compliance: STANDARD_COMPLIANCE,
  },
  US: {
    code: 'US',
    name: 'United States',
    locale: 'en-US',
    timeZone: 'America/New_York',
    currency: 'USD',
    taxInclusivePricing: false,
    taxLabel: 'Sales tax',
    taxRateBasisPoints: 0,
    minimumAge: 18,
    // Placeholder market: disabled until legal review is complete.
    paidBiddingEnabled: false,
    buyNowRecoveryEnabled: false,
    bulkyItemSurchargeMinor: 2000,
    shippingMethods: [
      {
        id: 'STANDARD',
        label: 'Standard shipping',
        description: '4–7 business days',
        priceMinor: 599,
        freeOverMinor: 7500,
        minDays: 4,
        maxDays: 7,
      },
    ],
    returnsWindowDays: 30,
    statutoryCoolingOffDays: 0,
    compliance: STANDARD_COMPLIANCE,
  },
}

export const DEFAULT_MARKET: MarketCode = 'UK'

export function isMarketCode(value: string | undefined): value is MarketCode {
  return value !== undefined && Object.hasOwn(MARKETS, value)
}

export function getMarket(code: string | undefined = DEFAULT_MARKET): MarketConfig {
  return MARKETS[isMarketCode(code) ? code : DEFAULT_MARKET]
}
