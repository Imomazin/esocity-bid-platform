import { z } from 'zod'

import { REWARD_TIERS, tierAtLeast, type RewardTier } from '@/domain/rewards'
import type { MarketCode } from '@/lib/config/market'
import { DAY } from '@/lib/time'

import type { AuctionRules, AuctionStatus, EligibilityRules } from './types'

export const DEFAULT_ELIGIBILITY: EligibilityRules = {
  minimumTier: null,
  maxPreviousWins: null,
  minimumAccountAgeDays: null,
  markets: ['UK'],
  minimumAge: 18,
}

export const DEFAULT_AUCTION_RULES: AuctionRules = {
  startingPriceMinor: 0,
  bidIncrementMinor: 1,
  bidCreditCost: 1,
  timerSeconds: 3_600,
  timerExtensionSeconds: 15,
  minimumParticipants: 2,
  maximumParticipants: null,
  hardStopAfterSeconds: null,
  buyNowEnabled: true,
  buyNowPriceMinor: null,
  bidCreditRecoveryEnabled: true,
  recoveryMode: 'RETURN_BIDS',
  recoveryWindowHours: 48,
  recoverPromotionalBids: true,
  reservePriceMinor: null,
  winnerPaymentWindowHours: 72,
  perUserBidLimit: null,
  autoBidEnabled: true,
  preventSelfOutbid: true,
  eligibility: DEFAULT_ELIGIBILITY,
}

const minorUnits = z.number().int().min(0).max(100_000_000)

export const eligibilityRulesSchema = z.object({
  minimumTier: z.enum(REWARD_TIERS).nullable(),
  maxPreviousWins: z.number().int().min(0).max(1_000).nullable(),
  minimumAccountAgeDays: z.number().int().min(0).max(3_650).nullable(),
  markets: z.array(z.enum(['UK', 'IE', 'US'])).min(1),
  minimumAge: z.number().int().min(18).max(99),
})

const auctionRulesObject = z.object({
  startingPriceMinor: minorUnits,
  bidIncrementMinor: z.number().int().min(1).max(10_000),
  bidCreditCost: z.number().int().min(1).max(10),
  timerSeconds: z
    .number()
    .int()
    .min(30)
    .max(7 * 24 * 3_600),
  timerExtensionSeconds: z.number().int().min(5).max(120),
  minimumParticipants: z.number().int().min(1).max(100),
  maximumParticipants: z.number().int().min(2).max(100_000).nullable(),
  hardStopAfterSeconds: z
    .number()
    .int()
    .min(60)
    .max(14 * 24 * 3_600)
    .nullable(),
  buyNowEnabled: z.boolean(),
  buyNowPriceMinor: minorUnits.nullable(),
  bidCreditRecoveryEnabled: z.boolean(),
  recoveryMode: z.enum(['RETURN_BIDS', 'PRICE_CREDIT']),
  recoveryWindowHours: z.number().int().min(0).max(720),
  recoverPromotionalBids: z.boolean(),
  reservePriceMinor: minorUnits.nullable(),
  winnerPaymentWindowHours: z.number().int().min(1).max(336),
  perUserBidLimit: z.number().int().min(1).max(100_000).nullable(),
  autoBidEnabled: z.boolean(),
  preventSelfOutbid: z.boolean(),
  eligibility: eligibilityRulesSchema,
})

/** Full rule set, including cross-field checks. */
export const auctionRulesSchema = auctionRulesObject.superRefine((rules, ctx) => {
  if (rules.maximumParticipants !== null && rules.maximumParticipants < rules.minimumParticipants) {
    ctx.addIssue({
      code: 'custom',
      path: ['maximumParticipants'],
      message: 'Maximum participants must be at least the minimum participants',
    })
  }
  if (rules.hardStopAfterSeconds !== null && rules.hardStopAfterSeconds < rules.timerSeconds) {
    ctx.addIssue({
      code: 'custom',
      path: ['hardStopAfterSeconds'],
      message: 'The hard stop must be after the initial countdown ends',
    })
  }
  if (rules.bidCreditRecoveryEnabled && !rules.buyNowEnabled) {
    ctx.addIssue({
      code: 'custom',
      path: ['bidCreditRecoveryEnabled'],
      message: 'Bid credit recovery requires Buy Now to be enabled',
    })
  }
})

/**
 * A partial update to an auction's rules. The merged result is re-validated with
 * `auctionRulesSchema`, so cross-field rules still apply.
 */
export const auctionRulesPatchSchema = auctionRulesObject
  .partial()
  .extend({ eligibility: eligibilityRulesSchema.partial().optional() })

export type AuctionRulesPatch = z.infer<typeof auctionRulesPatchSchema>

export function mergeRules(base: AuctionRules, patch: Partial<AuctionRules>): AuctionRules {
  return {
    ...base,
    ...patch,
    eligibility: { ...base.eligibility, ...(patch.eligibility ?? {}) },
  }
}

/** Rules that change the economics or fairness of an auction once bidding has started. */
export const SENSITIVE_RULE_FIELDS = [
  'startingPriceMinor',
  'bidIncrementMinor',
  'bidCreditCost',
  'timerSeconds',
  'timerExtensionSeconds',
  'minimumParticipants',
  'maximumParticipants',
  'hardStopAfterSeconds',
  'buyNowEnabled',
  'buyNowPriceMinor',
  'bidCreditRecoveryEnabled',
  'recoveryMode',
  'recoveryWindowHours',
  'recoverPromotionalBids',
  'reservePriceMinor',
  'winnerPaymentWindowHours',
  'perUserBidLimit',
  'preventSelfOutbid',
  'eligibility',
] as const satisfies ReadonlyArray<keyof AuctionRules>

const EDITABLE_STATUSES: ReadonlySet<AuctionStatus> = new Set(['DRAFT', 'SCHEDULED'])
const LIVE_STATUSES: ReadonlySet<AuctionStatus> = new Set(['LIVE', 'PAUSED'])

/** Rule fields that cannot be edited in the given status. */
export function lockedFieldsFor(status: AuctionStatus): (keyof AuctionRules)[] {
  if (EDITABLE_STATUSES.has(status)) return []
  if (LIVE_STATUSES.has(status)) return [...SENSITIVE_RULE_FIELDS]
  return Object.keys(DEFAULT_AUCTION_RULES) as (keyof AuctionRules)[]
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Returns the rule fields a patch is not allowed to change in the given status.
 * - DRAFT / SCHEDULED: everything is editable.
 * - LIVE / PAUSED: sensitive fields are locked. AutoBid may only be switched *off* (kill switch).
 * - FINALIZING / COMPLETED / CANCELLED: nothing is editable.
 */
export function lockedRuleViolations(
  status: AuctionStatus,
  current: AuctionRules,
  patch: Partial<AuctionRules>,
): string[] {
  const changed = (Object.keys(patch) as (keyof AuctionRules)[]).filter(
    (key) => patch[key] !== undefined && !sameValue(patch[key], current[key]),
  )
  if (EDITABLE_STATUSES.has(status)) return []
  if (LIVE_STATUSES.has(status)) {
    return changed.filter((key) => {
      if (key === 'autoBidEnabled') return patch.autoBidEnabled === true
      return (SENSITIVE_RULE_FIELDS as readonly string[]).includes(key)
    })
  }
  return changed
}

export interface BidderEligibilityProfile {
  tier: RewardTier
  previousWins: number
  accountCreatedAt: number
  market: MarketCode
  ageVerifiedAtLeast: number
}

export type EligibilityDecision = { eligible: true } | { eligible: false; reasons: string[] }

export function checkEligibility(
  rules: EligibilityRules,
  profile: BidderEligibilityProfile,
  now: number,
): EligibilityDecision {
  const reasons: string[] = []
  if (!rules.markets.includes(profile.market)) {
    reasons.push('This auction is not available in your region.')
  }
  if (profile.ageVerifiedAtLeast < rules.minimumAge) {
    reasons.push(`Bidders must be ${rules.minimumAge} or over.`)
  }
  if (!tierAtLeast(profile.tier, rules.minimumTier)) {
    reasons.push(
      `This auction is reserved for ${rules.minimumTier?.toLowerCase()} members and above.`,
    )
  }
  if (rules.maxPreviousWins !== null && profile.previousWins > rules.maxPreviousWins) {
    reasons.push(
      rules.maxPreviousWins === 0
        ? 'Beginner auctions are for members who have not won an auction yet.'
        : `Open to members with ${rules.maxPreviousWins} or fewer wins.`,
    )
  }
  if (
    rules.minimumAccountAgeDays !== null &&
    now - profile.accountCreatedAt < rules.minimumAccountAgeDays * DAY
  ) {
    reasons.push(`Accounts must be at least ${rules.minimumAccountAgeDays} days old to join.`)
  }
  return reasons.length === 0 ? { eligible: true } : { eligible: false, reasons }
}

/** Human-readable summary of the format, used on auction pages and admin. */
export function describeRules(rules: AuctionRules): string[] {
  const lines = [
    `Each bid costs ${rules.bidCreditCost} bid credit${rules.bidCreditCost === 1 ? '' : 's'} and raises the price by ${(rules.bidIncrementMinor / 100).toFixed(2)}.`,
    `Every bid guarantees at least ${rules.timerExtensionSeconds} seconds remain on the clock.`,
  ]
  if (rules.hardStopAfterSeconds) {
    lines.push(
      'This auction has a hard stop — the clock cannot be extended beyond its scheduled end.',
    )
  }
  if (rules.minimumParticipants > 1) {
    lines.push(
      `At least ${rules.minimumParticipants} different bidders are needed; otherwise all bids are refunded.`,
    )
  }
  if (rules.reservePriceMinor) {
    lines.push(
      'A reserve price applies. If it is not reached, no sale occurs and bids are refunded.',
    )
  }
  if (rules.perUserBidLimit) {
    lines.push(`Each member can place up to ${rules.perUserBidLimit} bids in this auction.`)
  }
  if (rules.buyNowEnabled && rules.bidCreditRecoveryEnabled) {
    lines.push(
      rules.recoveryMode === 'RETURN_BIDS'
        ? `If you don't win, buy it now within ${rules.recoveryWindowHours} hours and eligible bids are returned to your wallet.`
        : `If you don't win, the value of eligible bids is credited against the Buy Now price for ${rules.recoveryWindowHours} hours.`,
    )
  }
  if (rules.preventSelfOutbid) {
    lines.push('You cannot bid while you are already the leading bidder.')
  }
  return lines
}
