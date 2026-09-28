import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import {
  currencyEnum,
  dropStateEnum,
  promotionStatusEnum,
  promotionTypeEnum,
  rewardTierEnum,
} from './enums'
import { products } from './catalog'
import { users } from './identity'

export interface PromotionEligibilityColumn {
  newCustomersOnly: boolean
  minimumTier: 'MEMBER' | 'SILVER' | 'GOLD' | 'PLATINUM' | null
  categories: string[] | null
  bidPackIds: string[] | null
}

/**
 * Promotions. `value` is interpreted by `value_kind`: basis points for percentages, minor units
 * for fixed amounts, a number of credits for bonus bids. Usage is counted atomically.
 */
export const promotions = pgTable(
  'promotions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    type: promotionTypeEnum('type').notNull(),
    value: integer('value').notNull(),
    valueKind: text('value_kind').notNull(),
    currency: currencyEnum('currency').notNull().default('GBP'),
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }).notNull(),
    usageLimit: integer('usage_limit'),
    usageCount: integer('usage_count').notNull().default(0),
    perUserLimit: integer('per_user_limit'),
    minimumSpendMinor: integer('minimum_spend_minor'),
    maximumDiscountMinor: integer('maximum_discount_minor'),
    eligibility: jsonb('eligibility').$type<PromotionEligibilityColumn>().notNull(),
    status: promotionStatusEnum('status').notNull().default('ACTIVE'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('promotions_code_key').on(sql`upper(${table.code})`),
    check('promotions_window', sql`${table.endsAt} > ${table.startsAt}`),
    check(
      'promotions_usage',
      sql`${table.usageCount} >= 0 AND (${table.usageLimit} IS NULL OR ${table.usageCount} <= ${table.usageLimit})`,
    ),
    check(
      'promotions_value_kind',
      sql`${table.valueKind} IN ('PERCENT', 'FIXED', 'CREDITS', 'NONE')`,
    ),
    check(
      'promotions_percent_range',
      sql`${table.valueKind} <> 'PERCENT' OR ${table.value} BETWEEN 1 AND 9000`,
    ),
    check('promotions_value_non_negative', sql`${table.value} >= 0`),
  ],
)

export const promotionRedemptions = pgTable(
  'promotion_redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    promotionId: uuid('promotion_id')
      .notNull()
      .references(() => promotions.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    orderId: uuid('order_id'),
    bidPackageOrderId: uuid('bid_package_order_id'),
    discountMinor: integer('discount_minor').notNull().default(0),
    bonusCredits: integer('bonus_credits').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('promotion_redemptions_user_idx').on(table.promotionId, table.userId),
    check(
      'promotion_redemptions_target',
      sql`${table.orderId} IS NOT NULL OR ${table.bidPackageOrderId} IS NOT NULL`,
    ),
    check(
      'promotion_redemptions_values',
      sql`${table.discountMinor} >= 0 AND ${table.bonusCredits} >= 0`,
    ),
  ],
)

/** Flash Drops: limited stock at a set price for a short window, with a per-customer cap. */
export const flashDrops = pgTable(
  'flash_drops',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    title: text('title').notNull(),
    subtitle: text('subtitle').notNull().default(''),
    currency: currencyEnum('currency').notNull().default('GBP'),
    dropPriceMinor: integer('drop_price_minor').notNull(),
    stockTotal: integer('stock_total').notNull(),
    stockSold: integer('stock_sold').notNull().default(0),
    perCustomerLimit: integer('per_customer_limit').notNull().default(1),
    minimumTier: rewardTierEnum('minimum_tier'),
    membersOnly: boolean('members_only').notNull().default(false),
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }).notNull(),
    state: dropStateEnum('state').notNull().default('DRAFT'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('flash_drops_slug_key').on(table.slug),
    index('flash_drops_window_idx').on(table.startsAt, table.endsAt),
    check('flash_drops_window', sql`${table.endsAt} > ${table.startsAt}`),
    check(
      'flash_drops_stock',
      sql`${table.stockTotal} > 0 AND ${table.stockSold} BETWEEN 0 AND ${table.stockTotal}`,
    ),
    check(
      'flash_drops_limits',
      sql`${table.perCustomerLimit} >= 1 AND ${table.dropPriceMinor} >= 0`,
    ),
  ],
)

export const flashDropPurchases = pgTable(
  'flash_drop_purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dropId: uuid('drop_id')
      .notNull()
      .references(() => flashDrops.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    orderId: uuid('order_id').notNull(),
    quantity: integer('quantity').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('flash_drop_purchases_user_idx').on(table.dropId, table.userId),
    check('flash_drop_purchases_quantity', sql`${table.quantity} >= 1`),
  ],
)
