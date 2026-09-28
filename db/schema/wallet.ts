import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import {
  bidPackOrderStatusEnum,
  creditBucketEnum,
  currencyEnum,
  ledgerEntryTypeEnum,
} from './enums'
import { users } from './identity'

/**
 * Bid Wallet balance projection. The ledger is the source of truth; this row is locked
 * (SELECT … FOR UPDATE) and updated in the same transaction as each ledger entry, and its CHECK
 * constraints make a negative balance impossible.
 */
export const bidWallets = pgTable(
  'bid_wallets',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id),
    purchasedBalance: integer('purchased_balance').notNull().default(0),
    promotionalBalance: integer('promotional_balance').notNull().default(0),
    version: integer('version').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'bid_wallets_non_negative',
      sql`${table.purchasedBalance} >= 0 AND ${table.promotionalBalance} >= 0`,
    ),
  ],
)

/**
 * Bid credit ledger (append-only). Credits are signed integers; grants of promotional credits
 * open a "lot" (lot_id = the entry id) with an expiry, and debits reference the lot they draw on.
 */
export const bidLedgerEntries = pgTable(
  'bid_ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    type: ledgerEntryTypeEnum('type').notNull(),
    bucket: creditBucketEnum('bucket').notNull(),
    credits: integer('credits').notNull(),
    lotId: uuid('lot_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
    description: text('description').notNull(),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    idempotencyKey: text('idempotency_key'),
    purchasedBalanceAfter: integer('purchased_balance_after').notNull(),
    promotionalBalanceAfter: integer('promotional_balance_after').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('bid_ledger_user_idx').on(table.userId, table.createdAt),
    index('bid_ledger_lot_idx').on(table.lotId),
    index('bid_ledger_reference_idx').on(table.referenceType, table.referenceId),
    uniqueIndex('bid_ledger_idempotency_key').on(table.userId, table.idempotencyKey),
    check('bid_ledger_credits_non_zero', sql`${table.credits} <> 0`),
    check(
      'bid_ledger_balances_non_negative',
      sql`${table.purchasedBalanceAfter} >= 0 AND ${table.promotionalBalanceAfter} >= 0`,
    ),
    check(
      'bid_ledger_sign_by_type',
      sql`(${table.type} IN ('BID_PACK_PURCHASE', 'PROMOTIONAL_CREDIT', 'BID_REFUND', 'BUY_NOW_RECOVERY') AND ${table.credits} > 0)
        OR (${table.type} IN ('AUCTION_BID', 'EXPIRY') AND ${table.credits} < 0)
        OR ${table.type} = 'ADMIN_ADJUSTMENT'`,
    ),
    check(
      'bid_ledger_purchase_bucket',
      sql`${table.type} <> 'BID_PACK_PURCHASE' OR ${table.bucket} = 'PURCHASED'`,
    ),
    check(
      'bid_ledger_promotional_expiry',
      sql`NOT (${table.bucket} = 'PROMOTIONAL' AND ${table.credits} > 0) OR ${table.expiresAt} IS NOT NULL`,
    ),
  ],
)

export const bidPackages = pgTable(
  'bid_packages',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    credits: integer('credits').notNull(),
    bonusCredits: integer('bonus_credits').notNull().default(0),
    priceMinor: integer('price_minor').notNull(),
    currency: currencyEnum('currency').notNull().default('GBP'),
    badge: text('badge'),
    description: text('description').notNull().default(''),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'bid_packages_values',
      sql`${table.credits} > 0 AND ${table.bonusCredits} >= 0 AND ${table.priceMinor} > 0`,
    ),
  ],
)

export const bidPackageOrders = pgTable(
  'bid_package_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: text('reference').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    packageId: text('package_id')
      .notNull()
      .references(() => bidPackages.id),
    credits: integer('credits').notNull(),
    bonusCredits: integer('bonus_credits').notNull().default(0),
    promoBonusCredits: integer('promo_bonus_credits').notNull().default(0),
    currency: currencyEnum('currency').notNull().default('GBP'),
    priceMinor: integer('price_minor').notNull(),
    discountMinor: integer('discount_minor').notNull().default(0),
    totalMinor: integer('total_minor').notNull(),
    promotionCode: text('promotion_code'),
    status: bidPackOrderStatusEnum('status').notNull().default('PENDING'),
    idempotencyKey: text('idempotency_key'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('bid_package_orders_reference_key').on(table.reference),
    uniqueIndex('bid_package_orders_idempotency_key').on(table.userId, table.idempotencyKey),
    index('bid_package_orders_user_idx').on(table.userId, table.createdAt),
    check(
      'bid_package_orders_amounts',
      sql`${table.priceMinor} > 0 AND ${table.discountMinor} >= 0 AND ${table.totalMinor} = ${table.priceMinor} - ${table.discountMinor} AND ${table.totalMinor} >= 0`,
    ),
  ],
)
