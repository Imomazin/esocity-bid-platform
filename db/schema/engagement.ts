import { sql } from 'drizzle-orm'
import {
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
  messageAuthorEnum,
  notificationTypeEnum,
  rewardEntryTypeEnum,
  ticketCategoryEnum,
  ticketPriorityEnum,
  ticketStatusEnum,
  watchTargetEnum,
} from './enums'
import { users } from './identity'

export const watchlistItems = pgTable(
  'watchlist_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetType: watchTargetEnum('target_type').notNull(),
    targetId: text('target_id').notNull(),
    priceAtAddMinor: integer('price_at_add_minor'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('watchlist_items_unique').on(table.userId, table.targetType, table.targetId),
    index('watchlist_items_target_idx').on(table.targetType, table.targetId),
  ],
)

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: notificationTypeEnum('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    href: text('href'),
    dedupeKey: text('dedupe_key'),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_user_idx').on(table.userId, table.createdAt),
    index('notifications_unread_idx')
      .on(table.userId)
      .where(sql`${table.readAt} IS NULL`),
    uniqueIndex('notifications_dedupe_key').on(table.userId, table.dedupeKey),
  ],
)

/** Reward points ledger (append-only). Points never depend on bid volume. */
export const rewardLedgerEntries = pgTable(
  'reward_ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    type: rewardEntryTypeEnum('type').notNull(),
    points: integer('points').notNull(),
    description: text('description').notNull(),
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    idempotencyKey: text('idempotency_key'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('reward_ledger_user_idx').on(table.userId, table.createdAt),
    uniqueIndex('reward_ledger_idempotency_key').on(table.userId, table.idempotencyKey),
    check('reward_ledger_points_non_zero', sql`${table.points} <> 0`),
    check(
      'reward_ledger_sign_by_type',
      sql`(${table.type}::text LIKE 'EARN_%' AND ${table.points} > 0) OR (${table.type} IN ('REDEEM', 'EXPIRE') AND ${table.points} < 0) OR ${table.type} = 'ADJUST'`,
    ),
  ],
)

export const achievementUnlocks = pgTable(
  'achievement_unlocks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    achievementId: text('achievement_id').notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('achievement_unlocks_key').on(table.userId, table.achievementId)],
)

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reference: text('reference').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    category: ticketCategoryEnum('category').notNull(),
    subject: text('subject').notNull(),
    status: ticketStatusEnum('status').notNull().default('OPEN'),
    priority: ticketPriorityEnum('priority').notNull().default('NORMAL'),
    assigneeId: uuid('assignee_id').references(() => users.id),
    relatedReference: text('related_reference'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('support_tickets_reference_key').on(table.reference),
    index('support_tickets_status_idx').on(table.status, table.updatedAt),
    index('support_tickets_user_idx').on(table.userId),
  ],
)

export const supportMessages = pgTable(
  'support_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => supportTickets.id, { onDelete: 'cascade' }),
    author: messageAuthorEnum('author').notNull(),
    authorId: uuid('author_id').references(() => users.id),
    authorName: text('author_name').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('support_messages_ticket_idx').on(table.ticketId, table.createdAt),
    check('support_messages_body', sql`length(${table.body}) BETWEEN 1 AND 5000`),
  ],
)
