/**
 * Esocity Rewards.
 *
 * Points are held in an append-only ledger; balances and tiers are always derived from it.
 * Design principle: rewards recognise commerce engagement and healthy habits. Points are earned
 * on product purchases and achievements — never on buying bid packs — so the programme does not
 * incentivise uncontrolled spending on bids.
 */

import { DAY } from '@/lib/time'

export const REWARD_TIERS = ['MEMBER', 'SILVER', 'GOLD', 'PLATINUM'] as const
export type RewardTier = (typeof REWARD_TIERS)[number]

export interface RewardTierDefinition {
  tier: RewardTier
  label: string
  /** Qualifying points earned in the trailing 12 months. */
  threshold: number
  /** Earn-rate multiplier on purchases, in basis points (10 000 = 1×). */
  multiplierBps: number
  perks: string[]
}

export const TIER_DEFINITIONS: readonly RewardTierDefinition[] = [
  {
    tier: 'MEMBER',
    label: 'Member',
    threshold: 0,
    multiplierBps: 10_000,
    perks: ['1 point per £1 on purchases', 'Access to member Flash Drops', 'Birthday bonus'],
  },
  {
    tier: 'SILVER',
    label: 'Silver',
    threshold: 1_000,
    multiplierBps: 11_000,
    perks: [
      '1.1× points on purchases',
      'Early access to selected drops',
      'Free standard delivery on £30+',
    ],
  },
  {
    tier: 'GOLD',
    label: 'Gold',
    threshold: 5_000,
    multiplierBps: 12_500,
    perks: [
      '1.25× points on purchases',
      'Gold-only drops',
      'Priority support',
      'Extended 45-day returns',
    ],
  },
  {
    tier: 'PLATINUM',
    label: 'Platinum',
    threshold: 15_000,
    multiplierBps: 15_000,
    perks: [
      '1.5× points on purchases',
      'Dedicated concierge',
      'Exclusive previews',
      'Free express delivery',
    ],
  },
]

const TIER_RANK: Record<RewardTier, number> = { MEMBER: 0, SILVER: 1, GOLD: 2, PLATINUM: 3 }

export function compareTiers(a: RewardTier, b: RewardTier): number {
  return TIER_RANK[a] - TIER_RANK[b]
}

export function tierAtLeast(tier: RewardTier, minimum: RewardTier | null | undefined): boolean {
  return !minimum || compareTiers(tier, minimum) >= 0
}

export function getTierDefinition(tier: RewardTier): RewardTierDefinition {
  return TIER_DEFINITIONS.find((definition) => definition.tier === tier) ?? TIER_DEFINITIONS[0]!
}

export type RewardEntryType =
  'EARN_PURCHASE' | 'EARN_ACHIEVEMENT' | 'EARN_REFERRAL' | 'REDEEM' | 'EXPIRE' | 'ADJUST'

export interface RewardEntry {
  id: string
  type: RewardEntryType
  /** Signed integer: positive for earn, negative for redeem/expire. */
  points: number
  at: number
  description: string
  reference: {
    type: 'ORDER' | 'ACHIEVEMENT' | 'REDEMPTION' | 'REFERRAL' | 'ADMIN'
    id: string
  } | null
}

export const QUALIFYING_WINDOW_MS = 365 * DAY

export function rewardBalance(entries: readonly RewardEntry[]): number {
  return entries.reduce((total, entry) => total + entry.points, 0)
}

/** Points that count towards tier status: earned (not redeemed) in the trailing 12 months. */
export function qualifyingPoints(entries: readonly RewardEntry[], now: number): number {
  return entries
    .filter(
      (entry) =>
        entry.points > 0 && entry.type.startsWith('EARN_') && entry.at > now - QUALIFYING_WINDOW_MS,
    )
    .reduce((total, entry) => total + entry.points, 0)
}

export function tierForPoints(points: number): RewardTier {
  let current: RewardTier = 'MEMBER'
  for (const definition of TIER_DEFINITIONS) {
    if (points >= definition.threshold) current = definition.tier
  }
  return current
}

export interface TierProgress {
  tier: RewardTier
  qualifyingPoints: number
  nextTier: RewardTier | null
  pointsToNext: number
  /** 0–1 progress through the current tier band. */
  progress: number
}

export function tierProgress(points: number): TierProgress {
  const tier = tierForPoints(points)
  const index = TIER_DEFINITIONS.findIndex((definition) => definition.tier === tier)
  const current = TIER_DEFINITIONS[index]!
  const next = TIER_DEFINITIONS[index + 1]
  if (!next) {
    return { tier, qualifyingPoints: points, nextTier: null, pointsToNext: 0, progress: 1 }
  }
  const band = next.threshold - current.threshold
  return {
    tier,
    qualifyingPoints: points,
    nextTier: next.tier,
    pointsToNext: next.threshold - points,
    progress: Math.min(1, (points - current.threshold) / band),
  }
}

/** 1 point per whole pound on product purchases, scaled by tier multiplier. */
export function pointsForPurchase(amountMinor: number, tier: RewardTier): number {
  if (amountMinor <= 0) return 0
  const base = Math.floor(amountMinor / 100)
  return Math.floor((base * getTierDefinition(tier).multiplierBps) / 10_000)
}

export interface RedemptionOption {
  id: 'BIDS_10' | 'BIDS_25' | 'VOUCHER_5'
  label: string
  description: string
  points: number
  bidCredits?: number
  voucherMinor?: number
}

export const REDEMPTION_OPTIONS: readonly RedemptionOption[] = [
  {
    id: 'BIDS_10',
    label: '10 promotional bids',
    description: 'Credited to your Bid Wallet as promotional bids (valid 30 days).',
    points: 500,
    bidCredits: 10,
  },
  {
    id: 'BIDS_25',
    label: '25 promotional bids',
    description: 'Better value bundle, credited as promotional bids (valid 30 days).',
    points: 1_100,
    bidCredits: 25,
  },
  {
    id: 'VOUCHER_5',
    label: '£5 marketplace voucher',
    description: 'A single-use £5 voucher for marketplace purchases over £25.',
    points: 1_000,
    voucherMinor: 500,
  },
]

export function canRedeem(balance: number, option: RedemptionOption): boolean {
  return balance >= option.points
}

export interface AchievementStats {
  bidsPlaced: number
  auctionsWon: number
  ordersPlaced: number
  categoriesExplored: number
  watchlistItems: number
  recoveriesUsed: number
  limitsConfigured: boolean
  weeklyStreak: number
}

export interface AchievementDefinition {
  id: string
  title: string
  description: string
  points: number
  target: number
  metric: (stats: AchievementStats) => number
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: 'first-bid',
    title: 'First Bid',
    description: 'Place your first bid in a live auction.',
    points: 50,
    target: 1,
    metric: (stats) => stats.bidsPlaced,
  },
  {
    id: 'first-win',
    title: 'Winner’s Circle',
    description: 'Win your first auction.',
    points: 200,
    target: 1,
    metric: (stats) => stats.auctionsWon,
  },
  {
    id: 'explorer',
    title: 'Explorer',
    description: 'Browse products in six different categories.',
    points: 75,
    target: 6,
    metric: (stats) => stats.categoriesExplored,
  },
  {
    id: 'smart-saver',
    title: 'Smart Saver',
    description: 'Use Bid Credit Recovery with Buy Now.',
    points: 100,
    target: 1,
    metric: (stats) => stats.recoveriesUsed,
  },
  {
    id: 'in-control',
    title: 'In Control',
    description: 'Set your own spending and bidding limits.',
    points: 150,
    target: 1,
    metric: (stats) => (stats.limitsConfigured ? 1 : 0),
  },
  {
    id: 'curator',
    title: 'Curator',
    description: 'Follow ten products, auctions or drops on your watchlist.',
    points: 50,
    target: 10,
    metric: (stats) => stats.watchlistItems,
  },
  {
    id: 'regular',
    title: 'Regular',
    description: 'Visit Esocity Bid four weeks in a row.',
    points: 100,
    target: 4,
    metric: (stats) => stats.weeklyStreak,
  },
  {
    id: 'loyal-shopper',
    title: 'Loyal Shopper',
    description: 'Complete five orders.',
    points: 250,
    target: 5,
    metric: (stats) => stats.ordersPlaced,
  },
]

export interface AchievementProgress {
  id: string
  title: string
  description: string
  points: number
  current: number
  target: number
  unlocked: boolean
}

export function evaluateAchievements(stats: AchievementStats): AchievementProgress[] {
  return ACHIEVEMENTS.map((achievement) => {
    const current = Math.min(achievement.metric(stats), achievement.target)
    return {
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      points: achievement.points,
      current,
      target: achievement.target,
      unlocked: current >= achievement.target,
    }
  })
}
