import { logger } from '@/server/infra/logger'

/** Product analytics events. Demo logger now; PostHog / GA4 adapters later. */

export const ANALYTICS_EVENTS = [
  'PRODUCT_VIEW',
  'AUCTION_VIEW',
  'AUCTION_WATCH',
  'BID_SUBMITTED',
  'BID_ACCEPTED',
  'BID_REJECTED',
  'BID_PACK_VIEW',
  'BID_PACK_PURCHASE',
  'BUY_NOW',
  'DROP_VIEW',
  'DROP_PURCHASE',
  'CHECKOUT_STARTED',
  'ORDER_COMPLETED',
  'REWARD_EARNED',
] as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number]

export interface AnalyticsEvent {
  name: AnalyticsEventName
  userId: string | null
  properties: Record<string, string | number | boolean | null>
  at: number
}

export interface AnalyticsTracker {
  readonly name: 'demo' | 'posthog' | 'ga4'
  track(
    name: AnalyticsEventName,
    properties?: AnalyticsEvent['properties'],
    userId?: string | null,
  ): void
}

export class DemoAnalyticsTracker implements AnalyticsTracker {
  readonly name = 'demo' as const
  readonly recent: AnalyticsEvent[] = []
  readonly counts = new Map<AnalyticsEventName, number>()

  track(
    name: AnalyticsEventName,
    properties: AnalyticsEvent['properties'] = {},
    userId: string | null = null,
  ): void {
    this.recent.unshift({ name, properties, userId, at: Date.now() })
    this.recent.splice(500)
    this.counts.set(name, (this.counts.get(name) ?? 0) + 1)
    logger.debug('analytics', { event: name, ...properties })
  }
}
