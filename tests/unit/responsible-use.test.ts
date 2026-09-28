import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LIMITS,
  LIMIT_INCREASE_DELAY_MS,
  checkBidAllowance,
  checkPurchaseAllowance,
  hasAnyLimit,
  requestLimitChange,
  thresholdCrossed,
  type ResponsibleUseLimits,
} from '@/domain/responsible-use'
import { DAY, HOUR } from '@/lib/time'

import { T0 } from './fixtures'

const noUsage = { bidCreditsToday: 0, bidCreditsThisWeek: 0, bidPackSpendThisMonthMinor: 0 }
const limits = (overrides: Partial<ResponsibleUseLimits> = {}): ResponsibleUseLimits => ({
  ...DEFAULT_LIMITS,
  ...overrides,
})

describe('responsible-use limits', () => {
  it('applies a new or lower limit immediately', () => {
    const first = requestLimitChange(limits(), { dailyBidLimit: 50 }, T0)
    expect(first.limits.dailyBidLimit).toBe(50)
    expect(first.appliedNow).toEqual(['dailyBidLimit'])
    const lower = requestLimitChange(first.limits, { dailyBidLimit: 20 }, T0 + HOUR)
    expect(lower.limits.dailyBidLimit).toBe(20)
    expect(lower.scheduled).toEqual([])
  })

  it('delays a higher limit, or removing a limit, by 24 hours', () => {
    const start = limits({ dailyBidLimit: 20 })
    const raised = requestLimitChange(start, { dailyBidLimit: 100 }, T0)
    expect(raised.limits.dailyBidLimit).toBe(20)
    expect(raised.scheduled).toEqual([
      {
        field: 'dailyBidLimit',
        value: 100,
        requestedAt: T0,
        effectiveAt: T0 + LIMIT_INCREASE_DELAY_MS,
      },
    ])
    const usage = { ...noUsage, bidCreditsToday: 20 }
    expect(checkBidAllowance(raised.limits, usage, 1, T0 + 23 * HOUR)).toMatchObject({
      allowed: false,
      code: 'DAILY',
    })
    expect(checkBidAllowance(raised.limits, usage, 1, T0 + 24 * HOUR)).toEqual({ allowed: true })

    const removed = requestLimitChange(start, { dailyBidLimit: null }, T0)
    expect(removed.limits.dailyBidLimit).toBe(20)
    expect(removed.scheduled[0]).toMatchObject({ field: 'dailyBidLimit', value: null })
  })

  it('lets a new stricter request supersede a pending increase', () => {
    const raised = requestLimitChange(limits({ weeklyBidLimit: 100 }), { weeklyBidLimit: 500 }, T0)
    const reconsidered = requestLimitChange(raised.limits, { weeklyBidLimit: 80 }, T0 + HOUR)
    expect(reconsidered.limits.weeklyBidLimit).toBe(80)
    expect(reconsidered.limits.pendingChanges).toEqual([])
  })

  it('starts or extends a cool-off immediately but never shortens it', () => {
    const week = requestLimitChange(limits(), { coolOffDays: 7 }, T0)
    expect(week.limits.coolOffUntil).toBe(T0 + 7 * DAY)
    const shorter = requestLimitChange(week.limits, { coolOffDays: 1 }, T0 + DAY)
    expect(shorter.limits.coolOffUntil).toBe(T0 + 7 * DAY)
    const longer = requestLimitChange(week.limits, { coolOffDays: 30 }, T0 + DAY)
    expect(longer.limits.coolOffUntil).toBe(T0 + 31 * DAY)
  })

  it('blocks bids and bid pack purchases during a cool-off', () => {
    const coolingOff = limits({ coolOffUntil: T0 + DAY })
    expect(checkBidAllowance(coolingOff, noUsage, 1, T0)).toMatchObject({
      allowed: false,
      code: 'COOL_OFF',
    })
    expect(checkPurchaseAllowance(coolingOff, noUsage, 999, T0)).toMatchObject({
      allowed: false,
      code: 'COOL_OFF',
    })
    expect(checkBidAllowance(coolingOff, noUsage, 1, T0 + DAY)).toEqual({ allowed: true })
  })

  it('enforces daily, weekly and monthly budget limits', () => {
    const set = limits({
      dailyBidLimit: 10,
      weeklyBidLimit: 30,
      monthlyBidPurchaseBudgetMinor: 5_000,
    })
    expect(checkBidAllowance(set, { ...noUsage, bidCreditsToday: 9 }, 1, T0)).toEqual({
      allowed: true,
    })
    expect(checkBidAllowance(set, { ...noUsage, bidCreditsToday: 9 }, 2, T0)).toMatchObject({
      code: 'DAILY',
    })
    expect(checkBidAllowance(set, { ...noUsage, bidCreditsThisWeek: 30 }, 1, T0)).toMatchObject({
      code: 'WEEKLY',
    })
    const budget = checkPurchaseAllowance(
      set,
      { ...noUsage, bidPackSpendThisMonthMinor: 3_000 },
      2_500,
      T0,
    )
    expect(budget).toMatchObject({ allowed: false, code: 'MONTHLY_BUDGET' })
    if (!budget.allowed) expect(budget.message).toContain('£20.00 remains')
  })

  it('reports usage thresholds once as they are crossed', () => {
    expect(thresholdCrossed(100, 40, 55)).toBe(0.5)
    expect(thresholdCrossed(100, 40, 100)).toBe(1)
    expect(thresholdCrossed(100, 55, 60)).toBeNull()
    expect(thresholdCrossed(null, 0, 1_000)).toBeNull()
    expect(hasAnyLimit(limits())).toBe(false)
    expect(hasAnyLimit(limits({ weeklyBidLimit: 5 }))).toBe(true)
  })
})
