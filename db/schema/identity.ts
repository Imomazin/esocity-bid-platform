import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
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

import { currencyEnum, marketEnum, rewardTierEnum, roleEnum, userStatusEnum } from './enums'

const createdAt = () =>
  timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()

/** Members and staff. Authentication itself is delegated to the auth provider (docs/SECURITY.md). */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'date' }),
    authProviderId: text('auth_provider_id'),
    displayName: text('display_name').notNull(),
    handle: text('handle').notNull(),
    firstName: text('first_name').notNull().default(''),
    lastName: text('last_name').notNull().default(''),
    phone: text('phone'),
    /** Age is verified (18+) without storing the full date of birth where the provider allows. */
    ageVerifiedAt: timestamp('age_verified_at', { withTimezone: true, mode: 'date' }),
    dateOfBirth: date('date_of_birth', { mode: 'string' }),
    market: marketEnum('market').notNull().default('UK'),
    status: userStatusEnum('status').notNull().default('ACTIVE'),
    restrictionReason: text('restriction_reason'),
    marketingOptIn: boolean('marketing_opt_in').notNull().default(false),
    previousWins: integer('previous_wins').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    uniqueIndex('users_email_key').on(sql`lower(${table.email})`),
    uniqueIndex('users_handle_key').on(table.handle),
    uniqueIndex('users_auth_provider_id_key').on(table.authProviderId),
    check('users_previous_wins_non_negative', sql`${table.previousWins} >= 0`),
  ],
)

/** Role assignments (RBAC). A user may hold several staff roles. */
export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    grantedBy: uuid('granted_by').references(() => users.id),
    grantedAt: timestamp('granted_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.role] })],
)

export const addresses = pgTable(
  'addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    fullName: text('full_name').notNull(),
    line1: text('line1').notNull(),
    line2: text('line2'),
    city: text('city').notNull(),
    postcode: text('postcode').notNull(),
    countryCode: text('country_code').notNull().default('GB'),
    phone: text('phone'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [
    index('addresses_user_idx').on(table.userId),
    uniqueIndex('addresses_one_default_per_user')
      .on(table.userId)
      .where(sql`${table.isDefault}`),
  ],
)

export const userPreferences = pgTable('user_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  theme: text('theme').notNull().default('system'),
  interests: jsonb('interests').$type<string[]>().notNull().default([]),
  currency: currencyEnum('currency').notNull().default('GBP'),
  locale: text('locale').notNull().default('en-GB'),
  notificationChannels: jsonb('notification_channels')
    .$type<Record<string, boolean>>()
    .notNull()
    .default({ IN_APP: true, EMAIL: true, PUSH: false, SMS: false }),
  notificationTypes: jsonb('notification_types')
    .$type<Record<string, boolean>>()
    .notNull()
    .default({}),
  updatedAt: updatedAt(),
})

/**
 * Responsible-use limits, enforced server-side on every bid and bid pack purchase.
 * Increases are staged in `limit_change_requests` and only applied after 24 hours.
 */
export const responsibleUseLimits = pgTable(
  'responsible_use_limits',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    dailyBidLimit: integer('daily_bid_limit'),
    weeklyBidLimit: integer('weekly_bid_limit'),
    monthlyBidPurchaseBudgetMinor: integer('monthly_bid_purchase_budget_minor'),
    budgetCurrency: currencyEnum('budget_currency').notNull().default('GBP'),
    coolOffUntil: timestamp('cool_off_until', { withTimezone: true, mode: 'date' }),
    spendingNotifications: boolean('spending_notifications').notNull().default(true),
    bidUseNotifications: boolean('bid_use_notifications').notNull().default(true),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      'limits_daily_positive',
      sql`${table.dailyBidLimit} IS NULL OR ${table.dailyBidLimit} > 0`,
    ),
    check(
      'limits_weekly_positive',
      sql`${table.weeklyBidLimit} IS NULL OR ${table.weeklyBidLimit} > 0`,
    ),
    check(
      'limits_budget_positive',
      sql`${table.monthlyBidPurchaseBudgetMinor} IS NULL OR ${table.monthlyBidPurchaseBudgetMinor} > 0`,
    ),
  ],
)

export const limitChangeRequests = pgTable(
  'limit_change_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    field: text('field').notNull(),
    value: integer('value'),
    requestedAt: timestamp('requested_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    effectiveAt: timestamp('effective_at', { withTimezone: true, mode: 'date' }).notNull(),
    appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'date' }),
    supersededAt: timestamp('superseded_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => [
    index('limit_change_requests_pending_idx')
      .on(table.userId, table.effectiveAt)
      .where(sql`${table.appliedAt} IS NULL AND ${table.supersededAt} IS NULL`),
    check(
      'limit_change_requests_field',
      sql`${table.field} IN ('dailyBidLimit', 'weeklyBidLimit', 'monthlyBidPurchaseBudgetMinor')`,
    ),
    check(
      'limit_change_requests_delay',
      sql`${table.effectiveAt} >= ${table.requestedAt} + interval '24 hours'`,
    ),
  ],
)

/** Reward tier status cache (the reward ledger is the source of truth). */
export const rewardAccounts = pgTable(
  'reward_accounts',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    tier: rewardTierEnum('tier').notNull().default('MEMBER'),
    balance: integer('balance').notNull().default(0),
    qualifyingPoints: integer('qualifying_points').notNull().default(0),
    weeklyStreak: integer('weekly_streak').notNull().default(0),
    referralCode: text('referral_code'),
    updatedAt: updatedAt(),
  },
  (table) => [
    check('reward_accounts_balance_non_negative', sql`${table.balance} >= 0`),
    uniqueIndex('reward_accounts_referral_code_key').on(table.referralCode),
  ],
)
