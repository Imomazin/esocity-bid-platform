import { DAY, HOUR, formatDateTime } from '@/lib/time'

/**
 * Responsible-use controls.
 *
 * Paid bidding can create financial risk, so members can set limits that the SERVER enforces on
 * every bid (manual or AutoBid) and every bid pack purchase.
 *
 * Safety rules:
 *  - Lowering a limit (or adding one) takes effect immediately.
 *  - Raising or removing a limit only takes effect after a 24-hour cooling period.
 *  - A cool-off (self-imposed break) can be started or extended immediately but never shortened.
 * There is deliberately no mechanism to bypass these rules.
 */

export const LIMIT_INCREASE_DELAY_MS = 24 * HOUR
export const COOL_OFF_OPTIONS_DAYS = [1, 7, 30] as const

export type LimitField = 'dailyBidLimit' | 'weeklyBidLimit' | 'monthlyBidPurchaseBudgetMinor'

export interface PendingLimitChange {
  field: LimitField
  value: number | null
  requestedAt: number
  effectiveAt: number
}

export interface ResponsibleUseLimits {
  /** Maximum bid credits spent per calendar day (UTC). */
  dailyBidLimit: number | null
  weeklyBidLimit: number | null
  /** Maximum spend on bid packs per calendar month, minor units. */
  monthlyBidPurchaseBudgetMinor: number | null
  coolOffUntil: number | null
  spendingNotifications: boolean
  bidUseNotifications: boolean
  pendingChanges: PendingLimitChange[]
  updatedAt: number
}

export const DEFAULT_LIMITS: ResponsibleUseLimits = {
  dailyBidLimit: null,
  weeklyBidLimit: null,
  monthlyBidPurchaseBudgetMinor: null,
  coolOffUntil: null,
  spendingNotifications: true,
  bidUseNotifications: true,
  pendingChanges: [],
  updatedAt: 0,
}

export interface UsageSnapshot {
  bidCreditsToday: number
  bidCreditsThisWeek: number
  bidPackSpendThisMonthMinor: number
}

export type LimitDecision =
  | { allowed: true }
  | { allowed: false; code: 'COOL_OFF' | 'DAILY' | 'WEEKLY' | 'MONTHLY_BUDGET'; message: string }

/** Applies pending increases whose cooling period has elapsed. */
export function applyMaturedChanges(
  limits: ResponsibleUseLimits,
  now: number,
): ResponsibleUseLimits {
  const matured = limits.pendingChanges.filter((change) => change.effectiveAt <= now)
  if (matured.length === 0) return limits
  const next: ResponsibleUseLimits = {
    ...limits,
    pendingChanges: limits.pendingChanges.filter((change) => change.effectiveAt > now),
  }
  for (const change of matured) next[change.field] = change.value
  return next
}

export function isCoolingOff(limits: ResponsibleUseLimits, now: number): boolean {
  return limits.coolOffUntil !== null && limits.coolOffUntil > now
}

export function checkBidAllowance(
  limits: ResponsibleUseLimits,
  usage: UsageSnapshot,
  credits: number,
  now: number,
): LimitDecision {
  const effective = applyMaturedChanges(limits, now)
  if (isCoolingOff(effective, now)) {
    return {
      allowed: false,
      code: 'COOL_OFF',
      message: `You are taking a break until ${formatDateTime(effective.coolOffUntil!)}. Bidding is paused on your account.`,
    }
  }
  if (
    effective.dailyBidLimit !== null &&
    usage.bidCreditsToday + credits > effective.dailyBidLimit
  ) {
    return {
      allowed: false,
      code: 'DAILY',
      message: `You have reached your daily limit of ${effective.dailyBidLimit} bids.`,
    }
  }
  if (
    effective.weeklyBidLimit !== null &&
    usage.bidCreditsThisWeek + credits > effective.weeklyBidLimit
  ) {
    return {
      allowed: false,
      code: 'WEEKLY',
      message: `You have reached your weekly limit of ${effective.weeklyBidLimit} bids.`,
    }
  }
  return { allowed: true }
}

export function checkPurchaseAllowance(
  limits: ResponsibleUseLimits,
  usage: UsageSnapshot,
  amountMinor: number,
  now: number,
): LimitDecision {
  const effective = applyMaturedChanges(limits, now)
  if (isCoolingOff(effective, now)) {
    return {
      allowed: false,
      code: 'COOL_OFF',
      message: `You are taking a break until ${formatDateTime(effective.coolOffUntil!)}. Bid pack purchases are paused.`,
    }
  }
  const budget = effective.monthlyBidPurchaseBudgetMinor
  if (budget !== null && usage.bidPackSpendThisMonthMinor + amountMinor > budget) {
    const remaining = Math.max(0, budget - usage.bidPackSpendThisMonthMinor)
    return {
      allowed: false,
      code: 'MONTHLY_BUDGET',
      message: `This purchase would exceed your monthly bid budget. £${(remaining / 100).toFixed(2)} remains this month.`,
    }
  }
  return { allowed: true }
}

export interface LimitChangeRequest {
  dailyBidLimit?: number | null
  weeklyBidLimit?: number | null
  monthlyBidPurchaseBudgetMinor?: number | null
  coolOffDays?: number | null
  spendingNotifications?: boolean
  bidUseNotifications?: boolean
}

export interface LimitChangeResult {
  limits: ResponsibleUseLimits
  appliedNow: string[]
  scheduled: PendingLimitChange[]
}

/** A value is "more restrictive" if it lowers a limit or introduces one where there was none. */
function isStricter(current: number | null, proposed: number | null): boolean {
  if (proposed === null) return false
  if (current === null) return true
  return proposed <= current
}

export function requestLimitChange(
  limits: ResponsibleUseLimits,
  request: LimitChangeRequest,
  now: number,
): LimitChangeResult {
  let next = applyMaturedChanges(limits, now)
  const appliedNow: string[] = []
  const scheduled: PendingLimitChange[] = []
  const fields: LimitField[] = ['dailyBidLimit', 'weeklyBidLimit', 'monthlyBidPurchaseBudgetMinor']

  for (const field of fields) {
    if (!(field in request)) continue
    const proposed = request[field] ?? null
    if (proposed !== null && (!Number.isSafeInteger(proposed) || proposed < 0)) continue
    if (proposed === next[field]) continue
    // Any pending change for this field is superseded by the new request.
    next = {
      ...next,
      pendingChanges: next.pendingChanges.filter((change) => change.field !== field),
    }
    if (isStricter(next[field], proposed)) {
      next = { ...next, [field]: proposed }
      appliedNow.push(field)
    } else {
      const change: PendingLimitChange = {
        field,
        value: proposed,
        requestedAt: now,
        effectiveAt: now + LIMIT_INCREASE_DELAY_MS,
      }
      next = { ...next, pendingChanges: [...next.pendingChanges, change] }
      scheduled.push(change)
    }
  }

  if (request.coolOffDays) {
    const until = now + request.coolOffDays * DAY
    if (next.coolOffUntil === null || until > next.coolOffUntil) {
      next = { ...next, coolOffUntil: until }
      appliedNow.push('coolOffUntil')
    }
  }
  if (
    request.spendingNotifications !== undefined &&
    request.spendingNotifications !== next.spendingNotifications
  ) {
    next = { ...next, spendingNotifications: request.spendingNotifications }
    appliedNow.push('spendingNotifications')
  }
  if (
    request.bidUseNotifications !== undefined &&
    request.bidUseNotifications !== next.bidUseNotifications
  ) {
    next = { ...next, bidUseNotifications: request.bidUseNotifications }
    appliedNow.push('bidUseNotifications')
  }
  return { limits: { ...next, updatedAt: now }, appliedNow, scheduled }
}

export const USAGE_THRESHOLDS = [0.5, 0.8, 1] as const

/** Threshold (50/80/100%) crossed by moving from `before` to `after` usage, if any. */
export function thresholdCrossed(
  limit: number | null,
  before: number,
  after: number,
): number | null {
  if (limit === null || limit <= 0) return null
  let crossed: number | null = null
  for (const threshold of USAGE_THRESHOLDS) {
    if (before < limit * threshold && after >= limit * threshold) crossed = threshold
  }
  return crossed
}

export function hasAnyLimit(limits: ResponsibleUseLimits): boolean {
  return (
    limits.dailyBidLimit !== null ||
    limits.weeklyBidLimit !== null ||
    limits.monthlyBidPurchaseBudgetMinor !== null ||
    limits.coolOffUntil !== null
  )
}
