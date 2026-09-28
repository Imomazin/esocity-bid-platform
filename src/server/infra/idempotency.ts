import { DomainError } from '@/domain/errors'

import type { RedisLike } from './redis'

/**
 * Idempotency for critical commerce actions (bids, checkout, bid-pack purchases, drop purchases,
 * refunds). Clients send an `Idempotency-Key` header (a UUID per user intent). Repeating a request
 * with the same key returns the original response without re-executing the action, so a double
 * click or a network retry can never double-deduct credits or double-charge.
 *
 * Keys are scoped by action and user. Reusing a key with a different payload is rejected.
 */

export interface StoredResponse {
  status: number
  body: unknown
  /** Present when the original request ended in a business rejection; replays re-raise it. */
  error?: { code: string; message: string; details?: Record<string, unknown> }
}

export type BeginResult =
  | { state: 'NEW' }
  | { state: 'REPLAY'; response: StoredResponse }
  | { state: 'IN_PROGRESS' }
  | { state: 'MISMATCH' }

export interface IdempotencyStore {
  readonly kind: 'memory' | 'redis' | 'postgres'
  begin(scopeKey: string, fingerprint: string, ttlMs: number): Promise<BeginResult>
  complete(
    scopeKey: string,
    fingerprint: string,
    response: StoredResponse,
    ttlMs: number,
  ): Promise<void>
  abandon(scopeKey: string): Promise<void>
}

export const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000

interface MemoryRecord {
  fingerprint: string
  state: 'IN_PROGRESS' | 'COMPLETED'
  response: StoredResponse | null
  expiresAt: number
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  readonly kind = 'memory' as const
  private readonly records = new Map<string, MemoryRecord>()

  async begin(scopeKey: string, fingerprint: string, ttlMs: number): Promise<BeginResult> {
    const now = Date.now()
    const existing = this.records.get(scopeKey)
    if (existing && existing.expiresAt > now) {
      if (existing.fingerprint !== fingerprint) return { state: 'MISMATCH' }
      if (existing.state === 'IN_PROGRESS') return { state: 'IN_PROGRESS' }
      return { state: 'REPLAY', response: existing.response! }
    }
    this.records.set(scopeKey, {
      fingerprint,
      state: 'IN_PROGRESS',
      response: null,
      expiresAt: now + ttlMs,
    })
    if (this.records.size > 50_000) this.prune(now)
    return { state: 'NEW' }
  }

  async complete(
    scopeKey: string,
    fingerprint: string,
    response: StoredResponse,
    ttlMs: number,
  ): Promise<void> {
    this.records.set(scopeKey, {
      fingerprint,
      state: 'COMPLETED',
      response,
      expiresAt: Date.now() + ttlMs,
    })
  }

  async abandon(scopeKey: string): Promise<void> {
    this.records.delete(scopeKey)
  }

  private prune(now: number): void {
    for (const [key, record] of this.records) if (record.expiresAt <= now) this.records.delete(key)
  }
}

interface RedisRecord {
  f: string
  s: 'IN_PROGRESS' | 'COMPLETED'
  r: StoredResponse | null
}

export class RedisIdempotencyStore implements IdempotencyStore {
  readonly kind = 'redis' as const

  constructor(
    private readonly redis: RedisLike,
    private readonly prefix = 'esb:idem:',
  ) {}

  async begin(scopeKey: string, fingerprint: string, ttlMs: number): Promise<BeginResult> {
    const key = `${this.prefix}${scopeKey}`
    const record: RedisRecord = { f: fingerprint, s: 'IN_PROGRESS', r: null }
    const created = await this.redis.set(key, JSON.stringify(record), { nx: true, px: ttlMs })
    if (created === 'OK' || created === true) return { state: 'NEW' }
    const raw = await this.redis.get<RedisRecord | string>(key)
    if (!raw) return this.begin(scopeKey, fingerprint, ttlMs)
    const existing: RedisRecord = typeof raw === 'string' ? (JSON.parse(raw) as RedisRecord) : raw
    if (existing.f !== fingerprint) return { state: 'MISMATCH' }
    if (existing.s === 'IN_PROGRESS' || !existing.r) return { state: 'IN_PROGRESS' }
    return { state: 'REPLAY', response: existing.r }
  }

  async complete(
    scopeKey: string,
    fingerprint: string,
    response: StoredResponse,
    ttlMs: number,
  ): Promise<void> {
    const record: RedisRecord = { f: fingerprint, s: 'COMPLETED', r: response }
    await this.redis.set(`${this.prefix}${scopeKey}`, JSON.stringify(record), { px: ttlMs })
  }

  async abandon(scopeKey: string): Promise<void> {
    await this.redis.del(`${this.prefix}${scopeKey}`)
  }
}

const KEY_PATTERN = /^[A-Za-z0-9_\-:.]{8,128}$/

export function assertIdempotencyKey(key: string | null | undefined): string {
  if (!key || !KEY_PATTERN.test(key)) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'A valid Idempotency-Key header is required for this action.',
    )
  }
  return key
}

/** Stable fingerprint of a JSON-serialisable payload. */
export async function fingerprint(payload: unknown): Promise<string> {
  const text = stableStringify(payload)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, inner]) => inner !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${stableStringify(inner)}`).join(',')}}`
}

export interface IdempotentExecution {
  store: IdempotencyStore
  scope: string
  userId: string
  key: string
  payload: unknown
  ttlMs?: number
}

/**
 * Runs `action` at most once per (scope, user, key). Business rejections (DomainError) are stored
 * and replayed too, so a retried request sees the same outcome. Unexpected failures release the
 * key so the client can retry safely.
 */
export async function executeIdempotently(
  options: IdempotentExecution,
  action: () => Promise<StoredResponse>,
): Promise<StoredResponse & { replayed: boolean }> {
  const ttl = options.ttlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS
  const scopeKey = `${options.scope}:${options.userId}:${options.key}`
  const print = await fingerprint(options.payload)
  const started = await options.store.begin(scopeKey, print, ttl)
  if (started.state === 'REPLAY') {
    const stored = started.response
    if (stored.error) {
      throw new DomainError(
        stored.error.code as DomainError['code'],
        stored.error.message,
        stored.error.details,
      )
    }
    return { ...stored, replayed: true }
  }
  if (started.state === 'MISMATCH') {
    throw new DomainError(
      'IDEMPOTENCY_CONFLICT',
      'This request key was already used for a different request.',
    )
  }
  if (started.state === 'IN_PROGRESS') {
    throw new DomainError('IDEMPOTENCY_IN_PROGRESS', 'This request is already being processed.')
  }
  try {
    const response = await action()
    await options.store.complete(scopeKey, print, response, ttl)
    return { ...response, replayed: false }
  } catch (error) {
    if (error instanceof DomainError) {
      const response: StoredResponse = {
        status: 0,
        body: null,
        error: { code: error.code, message: error.message, details: error.details },
      }
      await options.store.complete(scopeKey, print, response, ttl)
    } else {
      await options.store.abandon(scopeKey)
    }
    throw error
  }
}
