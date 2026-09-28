import { pgEnum } from 'drizzle-orm/pg-core'

/*
 * Database enums. Values mirror the domain constants in src/domain; a unit test
 * (tests/unit/schema-enums.test.ts) fails if the two ever drift apart.
 */

export const roleEnum = pgEnum('role', [
  'CUSTOMER',
  'SUPPORT_AGENT',
  'OPERATIONS',
  'MERCHANDISER',
  'FINANCE',
  'ADMIN',
  'SUPER_ADMIN',
])
export const userStatusEnum = pgEnum('user_status', [
  'ACTIVE',
  'UNDER_REVIEW',
  'RESTRICTED',
  'CLOSED',
])
export const marketEnum = pgEnum('market', ['UK', 'IE', 'US'])
export const currencyEnum = pgEnum('currency', ['GBP', 'EUR', 'USD'])
export const rewardTierEnum = pgEnum('reward_tier', ['MEMBER', 'SILVER', 'GOLD', 'PLATINUM'])
/** Identity verification (KYC) status: a compliance placeholder until a market requires it. */
export const kycStatusEnum = pgEnum('kyc_status', [
  'NOT_STARTED',
  'PENDING',
  'VERIFIED',
  'REJECTED',
])

export const productStatusEnum = pgEnum('product_status', ['ACTIVE', 'DRAFT', 'ARCHIVED'])
export const productConditionEnum = pgEnum('product_condition', ['NEW', 'REFURBISHED', 'OPEN_BOX'])
export const shippingClassEnum = pgEnum('shipping_class', ['DIGITAL', 'SMALL', 'STANDARD', 'LARGE'])
export const supplierStatusEnum = pgEnum('supplier_status', ['ACTIVE', 'ONBOARDING', 'ON_HOLD'])
export const purchaseOrderStatusEnum = pgEnum('purchase_order_status', [
  'DRAFT',
  'SENT',
  'CONFIRMED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
])

export const inventoryEventTypeEnum = pgEnum('inventory_event_type', [
  'RECEIVED',
  'RESERVED',
  'RESERVATION_RELEASED',
  'SOLD',
  'DAMAGED',
  'RETURNED',
  'RESTOCKED',
  'ADJUSTED',
])

export const auctionStatusEnum = pgEnum('auction_status', [
  'DRAFT',
  'SCHEDULED',
  'LIVE',
  'PAUSED',
  'FINALIZING',
  'COMPLETED',
  'CANCELLED',
])
export const auctionOutcomeEnum = pgEnum('auction_outcome', [
  'WON',
  'NO_BIDS',
  'RESERVE_NOT_MET',
  'MIN_PARTICIPANTS_NOT_MET',
])
export const bidKindEnum = pgEnum('bid_kind', ['MANUAL', 'AUTOBID', 'SIMULATED'])
export const autoBidStatusEnum = pgEnum('autobid_status', [
  'ACTIVE',
  'COMPLETED',
  'EXHAUSTED',
  'STOPPED',
  'CANCELLED',
])
export const recoveryModeEnum = pgEnum('recovery_mode', ['RETURN_BIDS', 'PRICE_CREDIT'])

export const ledgerEntryTypeEnum = pgEnum('ledger_entry_type', [
  'BID_PACK_PURCHASE',
  'PROMOTIONAL_CREDIT',
  'AUCTION_BID',
  'BID_REFUND',
  'BUY_NOW_RECOVERY',
  'ADMIN_ADJUSTMENT',
  'EXPIRY',
])
export const creditBucketEnum = pgEnum('credit_bucket', ['PURCHASED', 'PROMOTIONAL'])

export const orderStatusEnum = pgEnum('order_status', [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
])
export const orderSourceEnum = pgEnum('order_source', [
  'AUCTION_WIN',
  'MARKETPLACE',
  'FLASH_DROP',
  'AUCTION_BUY_NOW',
])
export const paymentStatusEnum = pgEnum('payment_status', [
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
])
export const paymentKindEnum = pgEnum('payment_kind', ['ORDER', 'BID_PACK'])
export const refundStatusEnum = pgEnum('refund_status', ['PENDING', 'SUCCEEDED', 'FAILED'])
export const bidPackOrderStatusEnum = pgEnum('bid_pack_order_status', [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
])

export const promotionTypeEnum = pgEnum('promotion_type', [
  'PERCENT_DISCOUNT',
  'FIXED_DISCOUNT',
  'FREE_SHIPPING',
  'BONUS_BID_CREDITS',
  'BID_PACK_DISCOUNT',
  'CATEGORY_OFFER',
  'NEW_CUSTOMER',
])
export const promotionStatusEnum = pgEnum('promotion_status', ['ACTIVE', 'PAUSED', 'ARCHIVED'])
/** Operator lifecycle of a drop. Customer-facing status (upcoming/live/sold out/ended) is computed from time and stock. */
export const dropStateEnum = pgEnum('drop_state', ['DRAFT', 'PUBLISHED', 'CANCELLED'])

export const rewardEntryTypeEnum = pgEnum('reward_entry_type', [
  'EARN_PURCHASE',
  'EARN_ACHIEVEMENT',
  'EARN_REFERRAL',
  'REDEEM',
  'EXPIRE',
  'ADJUST',
])
export const watchTargetEnum = pgEnum('watch_target', ['AUCTION', 'PRODUCT', 'DROP'])
export const notificationTypeEnum = pgEnum('notification_type', [
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
])

export const ticketStatusEnum = pgEnum('ticket_status', [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
])
export const ticketCategoryEnum = pgEnum('ticket_category', [
  'auction',
  'payment',
  'wallet',
  'order',
  'delivery',
  'refund',
  'technical',
  'account',
])
export const ticketPriorityEnum = pgEnum('ticket_priority', ['LOW', 'NORMAL', 'HIGH', 'URGENT'])
export const messageAuthorEnum = pgEnum('message_author', ['CUSTOMER', 'AGENT', 'SYSTEM'])

export const riskClassEnum = pgEnum('risk_class', ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'])
export const riskActionEnum = pgEnum('risk_action', ['ALLOW', 'REVIEW', 'THROTTLE', 'BLOCK'])
export const fraudCaseStatusEnum = pgEnum('fraud_case_status', [
  'OPEN',
  'UNDER_REVIEW',
  'CLEARED',
  'THROTTLED',
  'BLOCKED',
])

export const auditSeverityEnum = pgEnum('audit_severity', ['INFO', 'NOTICE', 'WARNING', 'CRITICAL'])
export const actorTypeEnum = pgEnum('actor_type', ['CUSTOMER', 'ADMIN', 'SYSTEM'])
export const idempotencyStatusEnum = pgEnum('idempotency_status', ['IN_PROGRESS', 'COMPLETED'])
