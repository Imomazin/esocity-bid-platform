import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import {
  currencyEnum,
  productConditionEnum,
  productStatusEnum,
  purchaseOrderStatusEnum,
  shippingClassEnum,
  supplierStatusEnum,
} from './enums'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    icon: text('icon').notNull().default('tag'),
    sortOrder: integer('sort_order').notNull().default(0),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex('categories_slug_key').on(table.slug)],
)

export const brands = pgTable(
  'brands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    originCountry: text('origin_country'),
    ...timestamps,
  },
  (table) => [uniqueIndex('brands_slug_key').on(table.slug)],
)

export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    status: supplierStatusEnum('status').notNull().default('ONBOARDING'),
    countryCode: text('country_code').notNull(),
    leadTimeDays: integer('lead_time_days').notNull(),
    paymentTermsDays: integer('payment_terms_days').notNull().default(30),
    onTimeRateBps: integer('on_time_rate_bps'),
    fillRateBps: integer('fill_rate_bps'),
    defectRateBps: integer('defect_rate_bps'),
    notes: text('notes').notNull().default(''),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('suppliers_code_key').on(table.code),
    check('suppliers_lead_time_positive', sql`${table.leadTimeDays} >= 0`),
    check(
      'suppliers_rates_bps',
      sql`coalesce(${table.onTimeRateBps}, 0) BETWEEN 0 AND 10000 AND coalesce(${table.fillRateBps}, 0) BETWEEN 0 AND 10000 AND coalesce(${table.defectRateBps}, 0) BETWEEN 0 AND 10000`,
    ),
  ],
)

export const supplierContacts = pgTable(
  'supplier_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: text('role').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
  },
  (table) => [index('supplier_contacts_supplier_idx').on(table.supplierId)],
)

/**
 * Products. Prices are integer minor units with an explicit currency. Cost price is internal and
 * must never be exposed through customer-facing views.
 */
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sku: text('sku').notNull(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    subcategory: text('subcategory').notNull(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    description: text('description').notNull(),
    highlights: jsonb('highlights').$type<string[]>().notNull().default([]),
    attributes: jsonb('attributes').$type<Record<string, string>>().notNull().default({}),
    currency: currencyEnum('currency').notNull().default('GBP'),
    referencePriceMinor: integer('reference_price_minor').notNull(),
    buyNowPriceMinor: integer('buy_now_price_minor').notNull(),
    costPriceMinor: integer('cost_price_minor').notNull(),
    condition: productConditionEnum('condition').notNull().default('NEW'),
    shippingClass: shippingClassEnum('shipping_class').notNull().default('STANDARD'),
    status: productStatusEnum('status').notNull().default('DRAFT'),
    auctionEligible: boolean('auction_eligible').notNull().default(false),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    rating: real('rating'),
    reviewCount: integer('review_count').notNull().default(0),
    popularity: integer('popularity').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('products_sku_key').on(table.sku),
    uniqueIndex('products_slug_key').on(table.slug),
    index('products_category_status_idx').on(table.categoryId, table.status),
    index('products_brand_idx').on(table.brandId),
    index('products_supplier_idx').on(table.supplierId),
    index('products_search_idx').using(
      'gin',
      sql`to_tsvector('english', ${table.name} || ' ' || ${table.description})`,
    ),
    check(
      'products_prices_non_negative',
      sql`${table.referencePriceMinor} >= 0 AND ${table.buyNowPriceMinor} >= 0 AND ${table.costPriceMinor} >= 0`,
    ),
    check(
      'products_buy_now_within_reference',
      sql`${table.buyNowPriceMinor} <= ${table.referencePriceMinor}`,
    ),
    check('products_rating_range', sql`${table.rating} IS NULL OR ${table.rating} BETWEEN 0 AND 5`),
  ],
)

export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /** Licensed image URL (object storage / CDN). Only images Esocity has rights to use. */
    url: text('url'),
    /** Illustration key used when no licensed photography is available. */
    artKey: text('art_key'),
    alt: text('alt').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    licence: text('licence'),
  },
  (table) => [
    index('product_images_product_idx').on(table.productId, table.sortOrder),
    check('product_images_source', sql`${table.url} IS NOT NULL OR ${table.artKey} IS NOT NULL`),
  ],
)

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: text('reference').notNull(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    status: purchaseOrderStatusEnum('status').notNull().default('DRAFT'),
    currency: currencyEnum('currency').notNull().default('GBP'),
    expectedAt: timestamp('expected_at', { withTimezone: true, mode: 'date' }),
    receivedAt: timestamp('received_at', { withTimezone: true, mode: 'date' }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('purchase_orders_reference_key').on(table.reference),
    index('purchase_orders_supplier_idx').on(table.supplierId),
  ],
)

export const purchaseOrderLines = pgTable(
  'purchase_order_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    quantity: integer('quantity').notNull(),
    receivedQuantity: integer('received_quantity').notNull().default(0),
    unitCostMinor: bigint('unit_cost_minor', { mode: 'number' }).notNull(),
  },
  (table) => [
    check('purchase_order_lines_quantity_positive', sql`${table.quantity} > 0`),
    check(
      'purchase_order_lines_received_within_quantity',
      sql`${table.receivedQuantity} BETWEEN 0 AND ${table.quantity}`,
    ),
    check('purchase_order_lines_cost_non_negative', sql`${table.unitCostMinor} >= 0`),
  ],
)
