import { checkEligibility, type EligibilityDecision } from '@/domain/auction/rules'
import type { EligibilityRules } from '@/domain/auction/types'
import {
  checkCompliance,
  withCompliance,
  type ComplianceAction,
  type ComplianceProfile,
} from '@/domain/compliance'
import { DomainError } from '@/domain/errors'
import type { InventoryEvent } from '@/domain/inventory'
import { projectInventory } from '@/domain/inventory'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  shouldDeliver,
  type NotificationType,
} from '@/domain/notifications'
import { qualifyingPoints, tierForPoints, type RewardTier } from '@/domain/rewards'
import { collectExpiries } from '@/domain/wallet'
import { getMarket } from '@/lib/config/market'
import { newId } from '@/lib/ids'
import { startOfLondonDay, startOfLondonMonth, startOfLondonWeek } from '@/lib/time'
import type { AuditActor, AuditEntityType, AuditSeverity } from '@/server/infra/audit'
import type { AnalyticsEventName, AnalyticsTracker } from '@/server/providers/analytics'
import type { EmailProvider } from '@/server/providers/email'
import type { PaymentProvider } from '@/server/providers/payments'
import type { RealtimePublisher } from '@/server/providers/realtime'
import type { ShippingProvider } from '@/server/providers/shipping'

import type { DemoAccount, DemoState } from './state'

/** Providers the demo backend talks to. The same interfaces back production adapters. */
export interface DemoDeps {
  payments: PaymentProvider
  email: EmailProvider
  realtime: RealtimePublisher
  shipping: ShippingProvider
  analytics: AnalyticsTracker
}

export interface Ctx {
  state: DemoState
  deps: DemoDeps
}

export const MAX_NOTIFICATIONS = 100

export function audit(
  ctx: Ctx,
  input: {
    actor: AuditActor
    action: string
    entityType: AuditEntityType
    entityId: string
    severity?: AuditSeverity
    summary: string
    metadata?: Record<string, unknown>
    requestId?: string | null
    at?: number
  },
): void {
  ctx.state.audit.recordSync({
    actor: input.actor,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    severity: input.severity ?? 'INFO',
    summary: input.summary,
    metadata: input.metadata ?? {},
    requestId: input.requestId ?? null,
    occurredAt: input.at ?? ctx.state.clock(),
  })
}

export function memberActor(account: DemoAccount): AuditActor {
  return { type: 'CUSTOMER', id: account.id, name: `${account.displayName} (${account.handle})` }
}

export function track(
  ctx: Ctx,
  name: AnalyticsEventName,
  properties: Record<string, string | number | boolean | null>,
  userId: string | null,
): void {
  ctx.deps.analytics.track(name, properties, userId)
}

/** Delivers an in-app notification (always, subject to preferences) and a demo email if enabled. */
export function notify(
  ctx: Ctx,
  account: DemoAccount,
  type: NotificationType,
  title: string,
  body: string,
  href: string | null,
  at = ctx.state.clock(),
): void {
  const prefs = account.preferences.notifications ?? DEFAULT_NOTIFICATION_PREFERENCES
  if (shouldDeliver(prefs, type, 'IN_APP')) {
    account.notifications.unshift({
      id: newId(),
      userId: account.id,
      type,
      title,
      body,
      href,
      createdAt: at,
      readAt: null,
    })
    account.notifications.splice(MAX_NOTIFICATIONS)
  }
  if (shouldDeliver(prefs, type, 'EMAIL')) {
    void ctx.deps.email.send({
      to: account.profile.email,
      subject: title,
      text: body,
      tags: [type],
    })
  }
}

export function inventoryEvents(state: DemoState, productId: string): InventoryEvent[] {
  let events = state.inventory.get(productId)
  if (!events) {
    events = []
    state.inventory.set(productId, events)
  }
  return events
}

export function appendInventory(
  state: DemoState,
  productId: string,
  draft: Omit<InventoryEvent, 'id' | 'at' | 'productId'>,
  at: number,
): InventoryEvent {
  const event: InventoryEvent = { id: newId(), productId, at, ...draft }
  inventoryEvents(state, productId).push(event)
  return event
}

export function availableStock(state: DemoState, productId: string): number {
  return projectInventory(inventoryEvents(state, productId)).available
}

/** Writes EXPIRY ledger entries for promotional lots that have lapsed. */
export function expireCredits(account: DemoAccount, now: number): void {
  const expiries = collectExpiries(account.ledger, account.id, now, newId)
  if (expiries.length > 0) account.ledger.push(...expiries)
}

export interface Usage {
  bidCreditsToday: number
  bidCreditsThisWeek: number
  bidPackSpendThisMonthMinor: number
}

export function usageSnapshot(account: DemoAccount, now: number): Usage {
  const dayStart = startOfLondonDay(now)
  const weekStart = startOfLondonWeek(now)
  const monthStart = startOfLondonMonth(now)
  let today = 0
  let week = 0
  for (const entry of account.ledger) {
    if (entry.type !== 'AUCTION_BID') continue
    if (entry.createdAt >= weekStart) week -= entry.credits
    if (entry.createdAt >= dayStart) today -= entry.credits
  }
  const spend = account.bidPackSpend
    .filter((item) => item.at >= monthStart)
    .reduce((total, item) => total + item.amountMinor, 0)
  return { bidCreditsToday: today, bidCreditsThisWeek: week, bidPackSpendThisMonthMinor: spend }
}

export function accountTier(account: DemoAccount, now: number): RewardTier {
  return tierForPoints(qualifyingPoints(account.rewards, now))
}

export function complianceProfile(account: DemoAccount): ComplianceProfile {
  return {
    termsAcceptedVersion: account.compliance.termsAcceptedVersion,
    ageVerified: account.profile.ageVerified,
    kycStatus: account.compliance.kycStatus,
  }
}

/** Throws NOT_ELIGIBLE when the member's market requires terms, age or identity checks first. */
export function assertCompliance(account: DemoAccount, action: ComplianceAction): void {
  const decision = checkCompliance(
    action,
    complianceProfile(account),
    getMarket(account.market).compliance,
  )
  if (!decision.allowed) {
    throw new DomainError('NOT_ELIGIBLE', decision.message, { requirement: decision.requirement })
  }
}

/** Auction eligibility for a member: the auction's rules plus the market's compliance gates. */
export function bidderEligibility(
  account: DemoAccount,
  rules: EligibilityRules,
  now: number,
): EligibilityDecision {
  const eligibility = checkEligibility(
    rules,
    {
      tier: accountTier(account, now),
      previousWins: account.previousWins,
      accountCreatedAt: account.createdAt,
      market: account.market,
      ageVerifiedAtLeast: account.profile.ageVerified ? 18 : 0,
    },
    now,
  )
  const compliance = checkCompliance(
    'PLACE_BID',
    complianceProfile(account),
    getMarket(account.market).compliance,
  )
  return withCompliance(eligibility, compliance)
}

export function isSimulatedId(id: string | null): boolean {
  return !!id && id.startsWith('sim:')
}

export function nextOrderNumber(state: DemoState): string {
  state.sequence.order += 1
  return `ESB-${String(state.sequence.order).padStart(6, '0')}`
}
