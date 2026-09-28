import { sql } from 'drizzle-orm'
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { auctions } from './auctions'
import { products } from './catalog'
import {
  currencyEnum,
  orderSourceEnum,
  orderStatusEnum,
  paymentKindEnum,
  paymentStatusEnum,
  recoveryModeEnum,
  refundStatusEnum,
  shippingClassEnum,
} from './enums'
import { users } from './identity'
import { bidPackageOrders } from './wallet'

export const carts = pgTable('carts', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

export const cartItems = pgTable(
  'cart_items',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => carts.userId, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    quantity: integer('quantity').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.productId] }),
    check('cart_items_quantity', sql`${table.quantity} BETWEEN 1 AND 10`),
  ],
)

/** Address snapshot stored on the order so later address edits never change history. */
export interface AddressSnapshot {
  fullName: string
  line1: string
  line2: string | null
  city: string
  postcode: string
  countryCode: string
  phone: string | null
}

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: text('reference').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    source: orderSourceEnum('source').notNull(),
    status: orderStatusEnum('status').notNull().default('PENDING_PAYMENT'),
    currency: currencyEnum('currency').notNull().default('GBP'),
    subtotalMinor: bigint('subtotal_minor', { mode: 'number' }).notNull(),
    discountMinor: bigint('discount_minor', { mode: 'number' }).notNull().default(0),
    recoveryCreditMinor: bigint('recovery_credit_minor', { mode: 'number' }).notNull().default(0),
    shippingMinor: bigint('shipping_minor', { mode: 'number' }).notNull().default(0),
    taxMinor: bigint('tax_minor', { mode: 'number' }).notNull().default(0),
    taxInclusive: text('tax_inclusive').notNull().default('INCLUSIVE'),
    totalMinor: bigint('total_minor', { mode: 'number' }).notNull(),
    promotionCode: text('promotion_code'),
    recoveryMode: recoveryModeEnum('recovery_mode'),
    recoveryCredits: integer('recovery_credits'),
    shippingMethod: text('shipping_method').notNull().default('STANDARD'),
    shippingAddress: jsonb('shipping_address').$type<AddressSnapshot>(),
    auctionId: uuid('auction_id').references(() => auctions.id),
    dropId: uuid('drop_id'),
    paymentDueAt: timestamp('payment_due_at', { withTimezone: true, mode: 'date' }),
    trackingNumber: text('tracking_number'),
    carrier: text('carrier'),
    exceptionCode: text('exception_code'),
    exceptionMessage: text('exception_message'),
    idempotencyKey: text('idempotency_key'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('orders_reference_key').on(table.reference),
    uniqueIndex('orders_idempotency_key').on(table.userId, table.idempotencyKey),
    uniqueIndex('orders_one_win_per_auction')
      .on(table.auctionId)
      .where(sql`${table.source} = 'AUCTION_WIN'`),
    index('orders_user_idx').on(table.userId, table.createdAt),
    index('orders_status_idx').on(table.status, table.createdAt),
    check(
      'orders_amounts_non_negative',
      sql`${table.subtotalMinor} >= 0 AND ${table.discountMinor} >= 0 AND ${table.recoveryCreditMinor} >= 0 AND ${table.shippingMinor} >= 0 AND ${table.taxMinor} >= 0 AND ${table.totalMinor} >= 0`,
    ),
    check(
      'orders_total_consistent',
      sql`${table.totalMinor} = ${table.subtotalMinor} - ${table.discountMinor} - ${table.recoveryCreditMinor} + ${table.shippingMinor} + CASE WHEN ${table.taxInclusive} = 'EXCLUSIVE' THEN ${table.taxMinor} ELSE 0 END`,
    ),
    check('orders_tax_mode', sql`${table.taxInclusive} IN ('INCLUSIVE', 'EXCLUSIVE')`),
    check(
      'orders_auction_source',
      sql`${table.source} NOT IN ('AUCTION_WIN', 'AUCTION_BUY_NOW') OR ${table.auctionId} IS NOT NULL`,
    ),
  ],
)

export const orderLines = pgTable(
  'order_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    productName: text('product_name').notNull(),
    brandName: text('brand_name').notNull(),
    shippingClass: shippingClassEnum('shipping_class').notNull(),
    quantity: integer('quantity').notNull(),
    unitPriceMinor: bigint('unit_price_minor', { mode: 'number' }).notNull(),
    lineTotalMinor: bigint('line_total_minor', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('order_lines_order_idx').on(table.orderId),
    check('order_lines_quantity', sql`${table.quantity} >= 1`),
    check(
      'order_lines_total',
      sql`${table.unitPriceMinor} >= 0 AND ${table.lineTotalMinor} = ${table.unitPriceMinor} * ${table.quantity}`,
    ),
  ],
)

/** Order status history (append-only). */
export const orderEvents = pgTable(
  'order_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    status: orderStatusEnum('status').notNull(),
    note: text('note'),
    actor: text('actor').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('order_events_order_idx').on(table.orderId, table.occurredAt)],
)

/**
 * Payments. Only provider references are stored — never card numbers or other raw card data.
 * Payment state changes come from verified provider webhooks, never from the browser.
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    providerReference: text('provider_reference').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: paymentKindEnum('kind').notNull(),
    orderId: uuid('order_id').references(() => orders.id),
    bidPackageOrderId: uuid('bid_package_order_id').references(() => bidPackageOrders.id),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: currencyEnum('currency').notNull().default('GBP'),
    status: paymentStatusEnum('status').notNull().default('PENDING'),
    methodLabel: text('method_label'),
    refundedMinor: bigint('refunded_minor', { mode: 'number' }).notNull().default(0),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('payments_provider_reference_key').on(table.provider, table.providerReference),
    index('payments_order_idx').on(table.orderId),
    index('payments_created_idx').on(table.createdAt),
    check(
      'payments_amounts',
      sql`${table.amountMinor} > 0 AND ${table.refundedMinor} BETWEEN 0 AND ${table.amountMinor}`,
    ),
    check(
      'payments_target',
      sql`(${table.kind} = 'ORDER' AND ${table.orderId} IS NOT NULL) OR (${table.kind} = 'BID_PACK' AND ${table.bidPackageOrderId} IS NOT NULL)`,
    ),
  ],
)

/** Provider webhook/event log for payments (append-only). */
export const paymentEvents = pgTable(
  'payment_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    providerEventId: text('provider_event_id'),
    status: text('status').notNull(),
    note: text('note'),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('payment_events_payment_idx').on(table.paymentId),
    uniqueIndex('payment_events_provider_event_key').on(table.providerEventId),
  ],
)

export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id),
    orderId: uuid('order_id').references(() => orders.id),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    currency: currencyEnum('currency').notNull().default('GBP'),
    reason: text('reason').notNull(),
    status: refundStatusEnum('status').notNull().default('PENDING'),
    providerReference: text('provider_reference'),
    actorId: uuid('actor_id').references(() => users.id),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('refunds_idempotency_key').on(table.idempotencyKey),
    index('refunds_payment_idx').on(table.paymentId),
    check('refunds_amount_positive', sql`${table.amountMinor} > 0`),
  ],
)

export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    carrier: text('carrier').notNull(),
    service: text('service').notNull(),
    trackingNumber: text('tracking_number').notNull(),
    labelUrl: text('label_url'),
    shippedAt: timestamp('shipped_at', { withTimezone: true, mode: 'date' }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('shipments_tracking_key').on(table.carrier, table.trackingNumber),
    index('shipments_order_idx').on(table.orderId),
  ],
)
