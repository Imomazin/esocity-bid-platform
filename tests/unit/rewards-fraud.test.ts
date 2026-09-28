import { describe, expect, it } from 'vitest'

import {
  assessRisk,
  classifyScore,
  detectBidSignals,
  scoreSignals,
  type FraudSignal,
} from '@/domain/fraud'
import {
  ACHIEVEMENTS,
  QUALIFYING_WINDOW_MS,
  REDEMPTION_OPTIONS,
  canRedeem,
  evaluateAchievements,
  pointsForPurchase,
  qualifyingPoints,
  rewardBalance,
  tierAtLeast,
  tierForPoints,
  tierProgress,
  type RewardEntry,
} from '@/domain/rewards'
import { SECOND } from '@/lib/time'

import { T0 } from './fixtures'

describe('Esocity Rewards', () => {
  const reward = (type: RewardEntry['type'], points: number, at = T0): RewardEntry => ({
    id: `${type}-${points}-${at}`,
    type,
    points,
    at,
    description: type,
    reference: null,
  })

  it('earns 1 point per whole pound, scaled by tier', () => {
    expect(pointsForPurchase(12_999, 'MEMBER')).toBe(129)
    expect(pointsForPurchase(12_999, 'GOLD')).toBe(161)
    expect(pointsForPurchase(0, 'PLATINUM')).toBe(0)
  })

  it('never awards points for bid activity: every achievement and earn type is commerce or healthy-habit based', () => {
    // A member who bids heavily but does nothing else unlocks only the one-off "First Bid" badge.
    const progress = evaluateAchievements({
      bidsPlaced: 10_000,
      auctionsWon: 0,
      ordersPlaced: 0,
      categoriesExplored: 0,
      watchlistItems: 0,
      recoveriesUsed: 0,
      limitsConfigured: false,
      weeklyStreak: 0,
    })
    const unlocked = progress.filter((achievement) => achievement.unlocked)
    expect(unlocked.map((achievement) => achievement.id)).toEqual(['first-bid'])
    expect(unlocked[0]!.points).toBeLessThanOrEqual(50)
    expect(ACHIEVEMENTS.find((achievement) => achievement.id === 'first-bid')!.target).toBe(1)
  })

  it('derives balance and tier from the ledger, counting only the trailing 12 months of earnings', () => {
    const entries = [
      reward('EARN_PURCHASE', 800, T0 - QUALIFYING_WINDOW_MS - 1),
      reward('EARN_PURCHASE', 900),
      reward('EARN_ACHIEVEMENT', 200),
      reward('REDEEM', -500),
    ]
    expect(rewardBalance(entries)).toBe(1_400)
    expect(qualifyingPoints(entries, T0)).toBe(1_100)
    expect(tierForPoints(qualifyingPoints(entries, T0))).toBe('SILVER')
  })

  it('reports progress to the next tier', () => {
    expect(tierProgress(0)).toMatchObject({
      tier: 'MEMBER',
      nextTier: 'SILVER',
      pointsToNext: 1_000,
      progress: 0,
    })
    expect(tierProgress(3_000)).toMatchObject({
      tier: 'SILVER',
      nextTier: 'GOLD',
      pointsToNext: 2_000,
      progress: 0.5,
    })
    expect(tierProgress(20_000)).toMatchObject({ tier: 'PLATINUM', nextTier: null, progress: 1 })
    expect(tierAtLeast('GOLD', 'SILVER')).toBe(true)
    expect(tierAtLeast('SILVER', 'GOLD')).toBe(false)
    expect(tierAtLeast('MEMBER', null)).toBe(true)
  })

  it('only allows redemption with enough points', () => {
    const voucher = REDEMPTION_OPTIONS.find((option) => option.id === 'VOUCHER_5')!
    expect(canRedeem(999, voucher)).toBe(false)
    expect(canRedeem(1_000, voucher)).toBe(true)
  })
})

describe('fraud and bot risk indicators', () => {
  const signal = (weight: number): FraudSignal => ({
    code: 'BID_VELOCITY',
    weight,
    detail: '',
    observedAt: T0,
  })

  it('combines signals into a bounded, monotonic 0–100 score', () => {
    expect(scoreSignals([])).toBe(0)
    expect(scoreSignals([signal(50), signal(50)])).toBe(75)
    expect(scoreSignals([signal(150)])).toBe(100)
    expect(scoreSignals([signal(-20)])).toBe(0)
    expect(scoreSignals([signal(30), signal(10)])).toBeGreaterThan(scoreSignals([signal(30)]))
  })

  it.each([
    [0, 'LOW'],
    [24, 'LOW'],
    [25, 'MODERATE'],
    [50, 'HIGH'],
    [75, 'CRITICAL'],
    [100, 'CRITICAL'],
  ] as const)('classifies %s as %s', (score, riskClass) => {
    expect(classifyScore(score)).toBe(riskClass)
  })

  it('never blocks automatically: critical risk recommends BLOCK but only throttles until an analyst decides', () => {
    const assessment = assessRisk([signal(90)], T0)
    expect(assessment).toMatchObject({
      score: 90,
      riskClass: 'CRITICAL',
      recommendedAction: 'BLOCK',
      automatedAction: 'THROTTLE',
    })
    expect(assessRisk([signal(30)], T0)).toMatchObject({
      riskClass: 'MODERATE',
      recommendedAction: 'REVIEW',
      automatedAction: 'REVIEW',
    })
    expect(assessRisk([], T0)).toMatchObject({ riskClass: 'LOW', automatedAction: 'ALLOW' })
  })

  it('detects velocity, impossible timing and machine-regular intervals', () => {
    const machine = Array.from({ length: 40 }, (_, index) => T0 - 40 * SECOND + index * SECOND)
    const codes = detectBidSignals(machine, T0).map((found) => found.code)
    expect(codes).toContain('BID_VELOCITY')
    expect(codes).toContain('AUTOMATION_PATTERN')

    const burst = [T0 - 1_000, T0 - 950, T0 - 900, T0 - 850, T0 - 800]
    expect(detectBidSignals(burst, T0).map((found) => found.code)).toContain('IMPOSSIBLE_FREQUENCY')

    // A human-paced member produces no signals.
    const human = [0, 7_400, 9_100, 21_800, 26_300, 41_000, 44_200, 58_900].map(
      (offset) => T0 - 60 * SECOND + offset,
    )
    expect(detectBidSignals(human, T0)).toEqual([])
  })
})
