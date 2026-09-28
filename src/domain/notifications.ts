export const NOTIFICATION_TYPES = [
  'AUCTION_STARTING',
  'OUTBID',
  'AUCTION_WON',
  'AUCTION_LOST',
  'AUCTION_ENDING',
  'DROP_STARTING',
  'ORDER_PAID',
  'ORDER_SHIPPED',
  'REWARD_EARNED',
  'BID_BALANCE_LOW',
  'LIMIT_THRESHOLD',
  'SYSTEM',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'PUSH' | 'SMS'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  href: string | null
  createdAt: number
  readAt: number | null
}

export interface NotificationPreferences {
  channels: Record<NotificationChannel, boolean>
  types: Record<NotificationType, boolean>
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  AUCTION_STARTING: 'Watched auction starting',
  OUTBID: 'You have been outbid',
  AUCTION_WON: 'Auction won',
  AUCTION_LOST: 'Auction ended (not won)',
  AUCTION_ENDING: 'Watched auction ending soon',
  DROP_STARTING: 'Flash Drop starting',
  ORDER_PAID: 'Order payment confirmed',
  ORDER_SHIPPED: 'Order shipped',
  REWARD_EARNED: 'Rewards earned',
  BID_BALANCE_LOW: 'Low bid balance',
  LIMIT_THRESHOLD: 'Spending & bid limit alerts',
  SYSTEM: 'Account & service messages',
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  channels: { IN_APP: true, EMAIL: true, PUSH: false, SMS: false },
  types: {
    AUCTION_STARTING: true,
    OUTBID: true,
    AUCTION_WON: true,
    AUCTION_LOST: true,
    AUCTION_ENDING: true,
    DROP_STARTING: true,
    ORDER_PAID: true,
    ORDER_SHIPPED: true,
    REWARD_EARNED: true,
    BID_BALANCE_LOW: true,
    // Responsible-use alerts are always delivered in-app.
    LIMIT_THRESHOLD: true,
    SYSTEM: true,
  },
}

/** Types that members cannot switch off because they protect the customer or are transactional. */
export const MANDATORY_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set([
  'LIMIT_THRESHOLD',
  'SYSTEM',
  'AUCTION_WON',
])

export function shouldDeliver(
  prefs: NotificationPreferences,
  type: NotificationType,
  channel: NotificationChannel,
): boolean {
  if (MANDATORY_NOTIFICATION_TYPES.has(type) && channel === 'IN_APP') return true
  return prefs.channels[channel] && prefs.types[type]
}
