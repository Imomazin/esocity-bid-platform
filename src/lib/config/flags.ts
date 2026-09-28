import type { MarketCode } from './market'

/**
 * Feature flags. Defaults can be overridden per market (jurisdiction) and via the
 * FEATURE_FLAGS environment variable ("referrals=true,drops=false"). Operational kill switches
 * (e.g. AutoBid) are layered on top at runtime by the backend.
 */

export const FEATURE_FLAGS = [
  'auctions',
  'marketplace',
  'drops',
  'rewards',
  'autobid',
  'buyNowRecovery',
  'referrals',
  'sellerPortal',
] as const

export type FeatureFlag = (typeof FEATURE_FLAGS)[number]

export type FlagSet = Record<FeatureFlag, boolean>

export const DEFAULT_FLAGS: FlagSet = {
  auctions: true,
  marketplace: true,
  drops: true,
  rewards: true,
  autobid: true,
  buyNowRecovery: true,
  referrals: false,
  sellerPortal: false,
}

/** Jurisdiction overrides. Placeholder markets keep paid-bid mechanics off pending legal review. */
export const MARKET_FLAG_OVERRIDES: Record<MarketCode, Partial<FlagSet>> = {
  UK: {},
  IE: { auctions: false, autobid: false, buyNowRecovery: false },
  US: { auctions: false, autobid: false, buyNowRecovery: false },
}

export const FLAG_DESCRIPTIONS: Record<FeatureFlag, string> = {
  auctions: 'Live auctions and bid placement',
  marketplace: 'Fixed-price marketplace and Buy Now',
  drops: 'Flash Drops (limited-stock timed releases)',
  rewards: 'Esocity Rewards points, tiers and achievements',
  autobid: 'Server-side AutoBid agents',
  buyNowRecovery: 'Bid credit recovery when buying a lost auction item',
  referrals: 'Member referral programme',
  sellerPortal: 'Supplier self-service portal',
}

export function isFeatureFlag(value: string): value is FeatureFlag {
  return (FEATURE_FLAGS as readonly string[]).includes(value)
}

export function parseFlagOverrides(input: string | undefined): Partial<FlagSet> {
  if (!input) return {}
  const result: Partial<FlagSet> = {}
  for (const pair of input.split(',')) {
    const [rawKey, rawValue] = pair.split('=').map((part) => part.trim())
    if (!rawKey || !isFeatureFlag(rawKey)) continue
    result[rawKey] = rawValue === 'true' || rawValue === '1' || rawValue === 'on'
  }
  return result
}

export function resolveFlags(
  market: MarketCode,
  envOverrides: Partial<FlagSet> = {},
  runtimeOverrides: Partial<FlagSet> = {},
): FlagSet {
  return {
    ...DEFAULT_FLAGS,
    ...MARKET_FLAG_OVERRIDES[market],
    ...envOverrides,
    ...runtimeOverrides,
  }
}
