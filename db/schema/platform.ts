import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import {
  actorTypeEnum,
  auditSeverityEnum,
  fraudCaseStatusEnum,
  idempotencyStatusEnum,
  riskActionEnum,
  riskClassEnum,
} from './enums'
import { users } from './identity'

/**
 * Immutable audit log. UPDATE, DELETE and TRUNCATE are rejected by triggers (see the
 * append-only guards migration); the application role should also only hold INSERT/SELECT.
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    actorType: actorTypeEnum('actor_type').notNull(),
    actorId: text('actor_id').notNull(),
    actorName: text('actor_name').notNull(),
    actorRole: text('actor_role'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    severity: auditSeverityEnum('severity').notNull().default('INFO'),
    summary: text('summary').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    requestId: text('request_id'),
    ipHash: text('ip_hash'),
  },
  (table) => [
    index('audit_events_occurred_idx').on(table.occurredAt),
    index('audit_events_entity_idx').on(table.entityType, table.entityId, table.occurredAt),
    index('audit_events_actor_idx').on(table.actorId, table.occurredAt),
    index('audit_events_action_idx').on(table.action, table.occurredAt),
  ],
)

/** Idempotency records for critical commands (bids, checkout, bid packs, refunds, redemptions). */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    scope: text('scope').notNull(),
    ownerKey: text('owner_key').notNull(),
    key: text('key').notNull(),
    requestHash: text('request_hash').notNull(),
    status: idempotencyStatusEnum('status').notNull().default('IN_PROGRESS'),
    responseStatus: integer('response_status'),
    responseBody: jsonb('response_body'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scope, table.ownerKey, table.key] }),
    index('idempotency_keys_expiry_idx').on(table.expiresAt),
  ],
)

export const featureFlags = pgTable('feature_flags', {
  key: text('key').primaryKey(),
  enabled: boolean('enabled').notNull(),
  marketOverrides: jsonb('market_overrides').$type<Record<string, boolean>>().notNull().default({}),
  description: text('description').notNull().default(''),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
})

/**
 * Risk cases. Scores recommend an action; automated handling is limited to review/throttle and
 * never blocks an account without an analyst decision.
 */
export const fraudCases = pgTable(
  'fraud_cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    score: integer('score').notNull(),
    riskClass: riskClassEnum('risk_class').notNull(),
    recommendedAction: riskActionEnum('recommended_action').notNull(),
    automatedAction: riskActionEnum('automated_action').notNull(),
    signals: jsonb('signals')
      .$type<{ code: string; weight: number; detail: string; observedAt: string }[]>()
      .notNull(),
    status: fraudCaseStatusEnum('status').notNull().default('OPEN'),
    decisionAction: text('decision_action'),
    decisionNote: text('decision_note'),
    decidedBy: uuid('decided_by').references(() => users.id),
    decidedAt: timestamp('decided_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('fraud_cases_status_idx').on(table.status, table.score),
    index('fraud_cases_user_idx').on(table.userId),
    check('fraud_cases_score_range', sql`${table.score} BETWEEN 0 AND 100`),
    check('fraud_cases_no_automated_block', sql`${table.automatedAction} <> 'BLOCK'`),
    check(
      'fraud_cases_decision_note',
      sql`${table.decisionAction} IS NULL OR length(${table.decisionNote}) >= 5`,
    ),
  ],
)

/** Product analytics events (no personal data in properties). */
export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    userId: uuid('user_id'),
    sessionId: text('session_id'),
    properties: jsonb('properties')
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('analytics_events_name_idx').on(table.name, table.occurredAt)],
)
