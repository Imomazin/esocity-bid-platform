import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { products } from './catalog'
import { inventoryEventTypeEnum } from './enums'

/**
 * Inventory ledger (append-only; UPDATE/DELETE are rejected by a trigger). Stock positions are
 * always derivable from these events. RESERVED/RELEASED model auction and checkout holds.
 */
export const inventoryEvents = pgTable(
  'inventory_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    type: inventoryEventTypeEnum('type').notNull(),
    /** Positive for every type except ADJUSTED, which may be negative. */
    quantity: integer('quantity').notNull(),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    note: text('note'),
    actor: text('actor').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('inventory_events_product_idx').on(table.productId, table.occurredAt),
    index('inventory_events_reference_idx').on(table.referenceType, table.referenceId),
    check(
      'inventory_events_quantity_sign',
      sql`(${table.type} = 'ADJUSTED' AND ${table.quantity} <> 0) OR (${table.type} <> 'ADJUSTED' AND ${table.quantity} > 0)`,
    ),
    check(
      'inventory_events_reference_type',
      sql`${table.referenceType} IS NULL OR ${table.referenceType} IN ('AUCTION', 'ORDER', 'DROP', 'PURCHASE_ORDER', 'MANUAL')`,
    ),
  ],
)

/**
 * Stock position projection, updated in the same transaction as each inventory event. The CHECK
 * constraints make overselling impossible even under concurrent checkouts.
 */
export const inventoryPositions = pgTable(
  'inventory_positions',
  {
    productId: uuid('product_id')
      .primaryKey()
      .references(() => products.id),
    onHand: integer('on_hand').notNull().default(0),
    reserved: integer('reserved').notNull().default(0),
    sold: integer('sold').notNull().default(0),
    damaged: integer('damaged').notNull().default(0),
    returned: integer('returned').notNull().default(0),
    version: integer('version').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'inventory_positions_non_negative',
      sql`${table.onHand} >= 0 AND ${table.reserved} >= 0 AND ${table.sold} >= 0 AND ${table.damaged} >= 0 AND ${table.returned} >= 0`,
    ),
    check('inventory_positions_reserved_within_on_hand', sql`${table.reserved} <= ${table.onHand}`),
  ],
)
