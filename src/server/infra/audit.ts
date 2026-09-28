/**
 * Immutable audit log.
 *
 * Audit events are append-only: the interface exposes no update or delete. In PostgreSQL the
 * `audit_events` table is additionally protected by a trigger that rejects UPDATE and DELETE.
 */

export const AUDIT_SEVERITIES = ['INFO', 'NOTICE', 'WARNING', 'CRITICAL'] as const
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number]

export const AUDIT_ENTITY_TYPES = [
  'AUCTION',
  'BID',
  'AUTOBID',
  'WALLET',
  'PAYMENT',
  'REFUND',
  'ORDER',
  'PRODUCT',
  'INVENTORY',
  'PROMOTION',
  'SUPPORT_TICKET',
  'FRAUD_CASE',
  'USER',
  'USER_LIMITS',
  'FEATURE_FLAG',
  'SESSION',
  'DROP',
] as const
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]

export interface AuditActor {
  type: 'CUSTOMER' | 'ADMIN' | 'SYSTEM'
  id: string
  name: string
  role?: string
}

export interface AuditEvent {
  readonly id: string
  readonly occurredAt: number
  readonly actor: Readonly<AuditActor>
  readonly action: string
  readonly entityType: AuditEntityType
  readonly entityId: string
  readonly severity: AuditSeverity
  readonly summary: string
  readonly metadata: Readonly<Record<string, unknown>>
  readonly requestId: string | null
}

export type AuditInput = Omit<AuditEvent, 'id' | 'occurredAt'> & {
  occurredAt?: number
  id?: string
}

export interface AuditQuery {
  from?: number
  to?: number
  actor?: string
  action?: string
  entityType?: AuditEntityType
  entityId?: string
  severity?: AuditSeverity
  limit?: number
  offset?: number
}

export interface AuditLog {
  record(input: AuditInput): Promise<AuditEvent>
  query(query: AuditQuery): Promise<{ items: AuditEvent[]; total: number }>
}

export const SYSTEM_ACTOR: AuditActor = { type: 'SYSTEM', id: 'system', name: 'Esocity Bid engine' }

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const inner of Object.values(value as Record<string, unknown>)) deepFreeze(inner)
  }
  return value
}

export function matchesAuditQuery(event: AuditEvent, query: AuditQuery): boolean {
  if (query.from !== undefined && event.occurredAt < query.from) return false
  if (query.to !== undefined && event.occurredAt > query.to) return false
  if (
    query.actor &&
    !`${event.actor.name} ${event.actor.id}`.toLowerCase().includes(query.actor.toLowerCase())
  )
    return false
  if (query.action && !event.action.toLowerCase().includes(query.action.toLowerCase())) return false
  if (query.entityType && event.entityType !== query.entityType) return false
  if (query.entityId && !event.entityId.toLowerCase().includes(query.entityId.toLowerCase()))
    return false
  if (query.severity && event.severity !== query.severity) return false
  return true
}

/**
 * In-memory append-only audit log (demo mode). Entries are deep-frozen. Retention is capped for
 * memory safety in long-running demo instances; production retention is governed by PostgreSQL.
 */
export class MemoryAuditLog implements AuditLog {
  private readonly events: AuditEvent[] = []

  constructor(private readonly retention = 25_000) {}

  async record(input: AuditInput): Promise<AuditEvent> {
    return this.recordSync(input)
  }

  recordSync(input: AuditInput): AuditEvent {
    const event: AuditEvent = deepFreeze({
      id: input.id ?? crypto.randomUUID(),
      occurredAt: input.occurredAt ?? Date.now(),
      actor: { ...input.actor },
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      severity: input.severity,
      summary: input.summary,
      metadata: structuredClone(input.metadata),
      requestId: input.requestId,
    })
    this.events.push(event)
    if (this.events.length > this.retention)
      this.events.splice(0, this.events.length - this.retention)
    return event
  }

  async query(query: AuditQuery): Promise<{ items: AuditEvent[]; total: number }> {
    const matches = this.events
      .filter((event) => matchesAuditQuery(event, query))
      .sort((a, b) => b.occurredAt - a.occurredAt)
    const offset = query.offset ?? 0
    const limit = query.limit ?? 50
    return { items: matches.slice(offset, offset + limit), total: matches.length }
  }

  get size(): number {
    return this.events.length
  }
}
