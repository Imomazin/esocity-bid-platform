import { describe, expect, it } from 'vitest'

import * as db from '@db/schema'
import type { AutoBidStatus } from '@/domain/auction/autobid'
import {
  AUCTION_STATUSES,
  type AuctionOutcome,
  type BidKind,
  type RecoveryMode,
} from '@/domain/auction/types'
import { KYC_STATUSES } from '@/domain/compliance'
import type { FraudCaseStatus, RiskAction, RiskClass } from '@/domain/fraud'
import { INVENTORY_EVENT_TYPES } from '@/domain/inventory'
import { NOTIFICATION_TYPES } from '@/domain/notifications'
import { ORDER_STATUSES, type OrderSource } from '@/domain/orders'
import { PROMOTION_TYPES } from '@/domain/promotions'
import { REWARD_TIERS, type RewardEntryType } from '@/domain/rewards'
import { TICKET_CATEGORIES, TICKET_STATUSES } from '@/domain/support'
import { LEDGER_ENTRY_TYPES, type CreditBucket } from '@/domain/wallet'
import { ROLES } from '@/server/auth/roles'
import { AUDIT_SEVERITIES } from '@/server/infra/audit'

/** Exhaustive key lists for domain union types (the compiler rejects missing or extra members). */
function keys<T extends string>(record: Record<T, true>): T[] {
  return Object.keys(record) as T[]
}

const sorted = (values: readonly string[]) => [...values].sort()

describe('database enums mirror the domain', () => {
  it.each([
    ['role', db.roleEnum.enumValues, ROLES],
    ['auction_status', db.auctionStatusEnum.enumValues, AUCTION_STATUSES],
    ['inventory_event_type', db.inventoryEventTypeEnum.enumValues, INVENTORY_EVENT_TYPES],
    ['ledger_entry_type', db.ledgerEntryTypeEnum.enumValues, LEDGER_ENTRY_TYPES],
    ['order_status', db.orderStatusEnum.enumValues, ORDER_STATUSES],
    ['promotion_type', db.promotionTypeEnum.enumValues, PROMOTION_TYPES],
    ['reward_tier', db.rewardTierEnum.enumValues, REWARD_TIERS],
    ['notification_type', db.notificationTypeEnum.enumValues, NOTIFICATION_TYPES],
    ['ticket_status', db.ticketStatusEnum.enumValues, TICKET_STATUSES],
    ['ticket_category', db.ticketCategoryEnum.enumValues, TICKET_CATEGORIES],
    ['audit_severity', db.auditSeverityEnum.enumValues, AUDIT_SEVERITIES],
    ['kyc_status', db.kycStatusEnum.enumValues, KYC_STATUSES],
    [
      'bid_kind',
      db.bidKindEnum.enumValues,
      keys<BidKind>({ MANUAL: true, AUTOBID: true, SIMULATED: true }),
    ],
    [
      'autobid_status',
      db.autoBidStatusEnum.enumValues,
      keys<AutoBidStatus>({
        ACTIVE: true,
        EXHAUSTED: true,
        COMPLETED: true,
        CANCELLED: true,
        STOPPED: true,
      }),
    ],
    [
      'auction_outcome',
      db.auctionOutcomeEnum.enumValues,
      keys<AuctionOutcome>({
        WON: true,
        NO_BIDS: true,
        RESERVE_NOT_MET: true,
        MIN_PARTICIPANTS_NOT_MET: true,
      }),
    ],
    [
      'recovery_mode',
      db.recoveryModeEnum.enumValues,
      keys<RecoveryMode>({ RETURN_BIDS: true, PRICE_CREDIT: true }),
    ],
    [
      'credit_bucket',
      db.creditBucketEnum.enumValues,
      keys<CreditBucket>({ PURCHASED: true, PROMOTIONAL: true }),
    ],
    [
      'order_source',
      db.orderSourceEnum.enumValues,
      keys<OrderSource>({
        AUCTION_WIN: true,
        MARKETPLACE: true,
        FLASH_DROP: true,
        AUCTION_BUY_NOW: true,
      }),
    ],
    [
      'risk_class',
      db.riskClassEnum.enumValues,
      keys<RiskClass>({ LOW: true, MODERATE: true, HIGH: true, CRITICAL: true }),
    ],
    [
      'risk_action',
      db.riskActionEnum.enumValues,
      keys<RiskAction>({ ALLOW: true, REVIEW: true, THROTTLE: true, BLOCK: true }),
    ],
    [
      'fraud_case_status',
      db.fraudCaseStatusEnum.enumValues,
      keys<FraudCaseStatus>({
        OPEN: true,
        UNDER_REVIEW: true,
        CLEARED: true,
        THROTTLED: true,
        BLOCKED: true,
      }),
    ],
    [
      'reward_entry_type',
      db.rewardEntryTypeEnum.enumValues,
      keys<RewardEntryType>({
        EARN_PURCHASE: true,
        EARN_ACHIEVEMENT: true,
        EARN_REFERRAL: true,
        REDEEM: true,
        EXPIRE: true,
        ADJUST: true,
      }),
    ],
  ])('%s', (_name, database, domain) => {
    expect(sorted(database)).toEqual(sorted(domain))
  })
})
