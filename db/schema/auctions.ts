import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
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

import { products } from './catalog'
import {
  auctionOutcomeEnum,
  auctionStatusEnum,
  autoBidStatusEnum,
  bidKindEnum,
  currencyEnum,
  recoveryModeEnum,
} from './enums'
import { users } from './identity'

/** Eligibility rules for an auction (see src/domain/auction/rules.ts). */
export interface EligibilityColumn {
  minimumTier: 'MEMBER' | 'SILVER' | 'GOLD' | 'PLATINUM' | null
  maxPreviousWins: number | null
  minimumAccountAgeDays: number | null
  markets: ('UK' | 'IE' | 'US')[]
  minimumAge: number
}

/**
 * Auctions. The row is the authoritative state: the engine locks it (SELECT … FOR UPDATE) for
 * every bid, so price, close time, leader and bid count only change inside that transaction.
 * Economics-sensitive rules are columns with CHECK constraints; the application also locks them
 * once an auction is live.
 */
export const auctions = pgTable(
  'auctions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    title: text('title').notNull(),
    description: text('description'),
    label: text('label'),
    status: auctionStatusEnum('status').notNull().default('DRAFT'),
    featured: boolean('featured').notNull().default(false),
    currency: currencyEnum('currency').notNull().default('GBP'),

    // Rules
    startingPriceMinor: integer('starting_price_minor').notNull().default(0),
    bidIncrementMinor: integer('bid_increment_minor').notNull().default(1),
    bidCreditCost: integer('bid_credit_cost').notNull().default(1),
    timerSeconds: integer('timer_seconds').notNull(),
    timerExtensionSeconds: integer('timer_extension_seconds').notNull().default(15),
    hardStopAfterSeconds: integer('hard_stop_after_seconds'),
    minimumParticipants: integer('minimum_participants').notNull().default(2),
    maximumParticipants: integer('maximum_participants'),
    reservePriceMinor: integer('reserve_price_minor'),
    perUserBidLimit: integer('per_user_bid_limit'),
    preventSelfOutbid: boolean('prevent_self_outbid').notNull().default(true),
    autoBidEnabled: boolean('autobid_enabled').notNull().default(true),
    buyNowEnabled: boolean('buy_now_enabled').notNull().default(true),
    buyNowPriceMinor: integer('buy_now_price_minor'),
    bidCreditRecoveryEnabled: boolean('bid_credit_recovery_enabled').notNull().default(true),
    recoveryMode: recoveryModeEnum('recovery_mode').notNull().default('RETURN_BIDS'),
    recoveryWindowHours: integer('recovery_window_hours').notNull().default(48),
    recoverPromotionalBids: boolean('recover_promotional_bids').notNull().default(true),
    winnerPaymentWindowHours: integer('winner_payment_window_hours').notNull().default(72),
    eligibility: jsonb('eligibility').$type<EligibilityColumn>().notNull(),

    // Live state (authoritative)
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    closeAt: timestamp('close_at', { withTimezone: true, mode: 'date' }).notNull(),
    hardCloseAt: timestamp('hard_close_at', { withTimezone: true, mode: 'date' }),
    pausedAt: timestamp('paused_at', { withTimezone: true, mode: 'date' }),
    remainingAtPauseMs: bigint('remaining_at_pause_ms', { mode: 'number' }),
    priceMinor: integer('price_minor').notNull().default(0),
    bidCount: integer('bid_count').notNull().default(0),
    uniqueBidders: integer('unique_bidders').notNull().default(0),
    lastBidAt: timestamp('last_bid_at', { withTimezone: true, mode: 'date' }),
    leaderId: uuid('leader_id').references(() => users.id),
    leaderName: text('leader_name'),
    version: integer('version').notNull().default(1),
    cancelReason: text('cancel_reason'),

    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('auctions_status_close_idx').on(table.status, table.closeAt),
    index('auctions_status_starts_idx').on(table.status, table.startsAt),
    index('auctions_product_idx').on(table.productId),
    check(
      'auctions_money_non_negative',
      sql`${table.startingPriceMinor} >= 0 AND ${table.priceMinor} >= 0 AND coalesce(${table.reservePriceMinor}, 0) >= 0 AND coalesce(${table.buyNowPriceMinor}, 0) >= 0`,
    ),
    check('auctions_increment_positive', sql`${table.bidIncrementMinor} BETWEEN 1 AND 10000`),
    check('auctions_bid_cost_positive', sql`${table.bidCreditCost} BETWEEN 1 AND 10`),
    check(
      'auctions_timer_bounds',
      sql`${table.timerSeconds} BETWEEN 30 AND 604800 AND ${table.timerExtensionSeconds} BETWEEN 5 AND 120`,
    ),
    check(
      'auctions_participants',
      sql`${table.minimumParticipants} >= 1 AND (${table.maximumParticipants} IS NULL OR ${table.maximumParticipants} >= ${table.minimumParticipants})`,
    ),
    check(
      'auctions_hard_stop_after_timer',
      sql`${table.hardStopAfterSeconds} IS NULL OR ${table.hardStopAfterSeconds} >= ${table.timerSeconds}`,
    ),
    check(
      'auctions_recovery_requires_buy_now',
      sql`NOT ${table.bidCreditRecoveryEnabled} OR ${table.buyNowEnabled}`,
    ),
    check(
      'auctions_counters_non_negative',
      sql`${table.bidCount} >= 0 AND ${table.uniqueBidders} >= 0 AND ${table.version} >= 1`,
    ),
    check('auctions_close_after_start', sql`${table.closeAt} >= ${table.startsAt}`),
    check(
      'auctions_hard_close_bound',
      sql`${table.hardCloseAt} IS NULL OR ${table.closeAt} <= ${table.hardCloseAt}`,
    ),
    check(
      'auctions_price_matches_bids',
      sql`${table.priceMinor} = ${table.startingPriceMinor} + ${table.bidCount} * ${table.bidIncrementMinor}`,
    ),
    check(
      'auctions_pause_state',
      sql`(${table.status} = 'PAUSED') = (${table.pausedAt} IS NOT NULL)`,
    ),
  ],
)

/** Per-bidder participation summary (updated in the bid transaction). */
export const auctionParticipants = pgTable(
  'auction_participants',
  {
    auctionId: uuid('auction_id')
      .notNull()
      .references(() => auctions.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    bids: integer('bids').notNull().default(0),
    purchasedCreditsSpent: integer('purchased_credits_spent').notNull().default(0),
    promotionalCreditsSpent: integer('promotional_credits_spent').notNull().default(0),
    firstBidAt: timestamp('first_bid_at', { withTimezone: true, mode: 'date' }).notNull(),
    lastBidAt: timestamp('last_bid_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.auctionId, table.userId] }),
    index('auction_participants_user_idx').on(table.userId),
    check(
      'auction_participants_non_negative',
      sql`${table.bids} >= 0 AND ${table.purchasedCreditsSpent} >= 0 AND ${table.promotionalCreditsSpent} >= 0`,
    ),
  ],
)

/**
 * Accepted bids (append-only). The (auction_id, sequence) key makes the sequence gap-free and
 * unique; the idempotency key makes a retried request impossible to double-apply.
 */
export const bids = pgTable(
  'bids',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    auctionId: uuid('auction_id')
      .notNull()
      .references(() => auctions.id),
    sequence: integer('sequence').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: bidKindEnum('kind').notNull(),
    priceAfterMinor: integer('price_after_minor').notNull(),
    creditsSpent: integer('credits_spent').notNull(),
    closeAtAfter: timestamp('close_at_after', { withTimezone: true, mode: 'date' }).notNull(),
    idempotencyKey: text('idempotency_key'),
    requestId: text('request_id'),
    placedAt: timestamp('placed_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('bids_auction_sequence_key').on(table.auctionId, table.sequence),
    uniqueIndex('bids_idempotency_key').on(table.userId, table.idempotencyKey),
    index('bids_user_idx').on(table.userId, table.placedAt),
    check('bids_sequence_positive', sql`${table.sequence} >= 1`),
    check('bids_credits_positive', sql`${table.creditsSpent} >= 1`),
    check('bids_price_non_negative', sql`${table.priceAfterMinor} >= 0`),
  ],
)

/** Final, engine-determined outcome. Written exactly once per auction. */
export const auctionResults = pgTable(
  'auction_results',
  {
    auctionId: uuid('auction_id')
      .primaryKey()
      .references(() => auctions.id),
    outcome: auctionOutcomeEnum('outcome').notNull(),
    winnerId: uuid('winner_id').references(() => users.id),
    finalPriceMinor: integer('final_price_minor').notNull(),
    currency: currencyEnum('currency').notNull().default('GBP'),
    bidCount: integer('bid_count').notNull(),
    uniqueBidders: integer('unique_bidders').notNull(),
    winnerBidCount: integer('winner_bid_count').notNull().default(0),
    bidsRefunded: boolean('bids_refunded').notNull().default(false),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }).notNull(),
    orderId: uuid('order_id'),
  },
  (table) => [
    check(
      'auction_results_winner_consistency',
      sql`(${table.outcome} = 'WON') = (${table.winnerId} IS NOT NULL)`,
    ),
  ],
)

/** Server-side AutoBid agents. At most one active agent per member per auction. */
export const autoBidRules = pgTable(
  'autobid_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    auctionId: uuid('auction_id')
      .notNull()
      .references(() => auctions.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    maxBids: integer('max_bids').notNull(),
    maxPriceMinor: integer('max_price_minor'),
    bidsPlaced: integer('bids_placed').notNull().default(0),
    status: autoBidStatusEnum('status').notNull().default('ACTIVE'),
    stopReason: text('stop_reason'),
    lastBidAt: timestamp('last_bid_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('autobid_rules_one_active')
      .on(table.auctionId, table.userId)
      .where(sql`${table.status} = 'ACTIVE'`),
    index('autobid_rules_auction_active_idx')
      .on(table.auctionId)
      .where(sql`${table.status} = 'ACTIVE'`),
    check(
      'autobid_rules_bounds',
      sql`${table.maxBids} BETWEEN 1 AND 500 AND ${table.bidsPlaced} BETWEEN 0 AND ${table.maxBids}`,
    ),
  ],
)

/** Lifecycle log (append-only): every status change with actor and reason. */
export const auctionTransitions = pgTable(
  'auction_transitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    auctionId: uuid('auction_id')
      .notNull()
      .references(() => auctions.id),
    fromStatus: auctionStatusEnum('from_status').notNull(),
    toStatus: auctionStatusEnum('to_status').notNull(),
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id'),
    reason: text('reason'),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('auction_transitions_auction_idx').on(table.auctionId, table.occurredAt),
    check('auction_transitions_actor', sql`${table.actorType} IN ('SYSTEM', 'ADMIN')`),
  ],
)
