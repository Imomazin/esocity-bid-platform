import type { RedisLike } from './redis'

/**
 * Rate limiting. Policies are stricter around money- and fairness-sensitive actions.
 * Demo: in-memory sliding log. Production: Redis-backed sliding window (Upstash-compatible).
 */

export interface RateLimitPolicy {
  name: string
  limit: number
  windowMs: number
}

export const RATE_LIMIT_POLICIES = {
  bidBurst: { name: 'bid-burst', limit: 4, windowMs: 1_000 },
  bidSustained: { name: 'bid-sustained', limit: 90, windowMs: 60_000 },
  autobid: { name: 'autobid', limit: 20, windowMs: 60_000 },
  login: { name: 'login', limit: 10, windowMs: 15 * 60_000 },
  demoSession: { name: 'demo-session', limit: 30, windowMs: 60 * 60_000 },
  checkout: { name: 'checkout', limit: 10, windowMs: 60_000 },
  walletPurchase: { name: 'wallet-purchase', limit: 6, windowMs: 60_000 },
  dropPurchase: { name: 'drop-purchase', limit: 10, windowMs: 60_000 },
  promoValidation: { name: 'promo-validation', limit: 20, windowMs: 10 * 60_000 },
  supportTicket: { name: 'support-ticket', limit: 5, windowMs: 60 * 60_000 },
  mutation: { name: 'mutation', limit: 120, windowMs: 60_000 },
  adminMutation: { name: 'admin-mutation', limit: 60, windowMs: 60_000 },
  read: { name: 'read', limit: 600, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitPolicy>

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfterMs: number
}

export interface RateLimiter {
  readonly kind: 'memory' | 'redis' | 'disabled'
  consume(key: string, policy: RateLimitPolicy, now?: number): Promise<RateLimitResult>
}

/** Exact sliding-log limiter for a single process. Memory per key is bounded by the policy limit. */
export class MemoryRateLimiter implements RateLimiter {
  readonly kind = 'memory' as const
  private readonly logs = new Map<string, number[]>()
  private operations = 0

  async consume(key: string, policy: RateLimitPolicy, now = Date.now()): Promise<RateLimitResult> {
    const bucketKey = `${policy.name}:${key}`
    const windowStart = now - policy.windowMs
    const log = (this.logs.get(bucketKey) ?? []).filter((at) => at > windowStart)
    const allowed = log.length < policy.limit
    if (allowed) log.push(now)
    this.logs.set(bucketKey, log)
    if (++this.operations % 500 === 0) this.prune(now)
    const oldest = log[0] ?? now
    return {
      allowed,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - log.length),
      resetAt: oldest + policy.windowMs,
      retryAfterMs: allowed ? 0 : Math.max(0, oldest + policy.windowMs - now),
    }
  }

  private prune(now: number): void {
    for (const [key, log] of this.logs) {
      if (log.every((at) => at < now - 60 * 60_000)) this.logs.delete(key)
    }
  }
}

export class DisabledRateLimiter implements RateLimiter {
  readonly kind = 'disabled' as const
  async consume(_key: string, policy: RateLimitPolicy, now = Date.now()): Promise<RateLimitResult> {
    return {
      allowed: true,
      limit: policy.limit,
      remaining: policy.limit,
      resetAt: now,
      retryAfterMs: 0,
    }
  }
}

/**
 * Sliding-window limiter on Redis using a sorted set, executed atomically in a Lua script.
 * Works with Upstash (REST EVAL) and any Redis 6+.
 */
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
local allowed = 0
if count < limit then
  redis.call('ZADD', key, now, member)
  count = count + 1
  allowed = 1
end
redis.call('PEXPIRE', key, window)
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldestScore = now
if oldest[2] then oldestScore = tonumber(oldest[2]) end
return { allowed, count, oldestScore }
`

export class RedisRateLimiter implements RateLimiter {
  readonly kind = 'redis' as const

  constructor(
    private readonly redis: RedisLike,
    private readonly prefix = 'esb:rl:',
  ) {}

  async consume(key: string, policy: RateLimitPolicy, now = Date.now()): Promise<RateLimitResult> {
    const result = (await this.redis.eval(
      SLIDING_WINDOW_SCRIPT,
      [`${this.prefix}${policy.name}:${key}`],
      [now, policy.windowMs, policy.limit, `${now}:${crypto.randomUUID()}`],
    )) as [number, number, number]
    const [allowedFlag, count, oldest] = result
    const allowed = Number(allowedFlag) === 1
    const resetAt = Number(oldest) + policy.windowMs
    return {
      allowed,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - Number(count)),
      resetAt,
      retryAfterMs: allowed ? 0 : Math.max(0, resetAt - now),
    }
  }
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))),
  }
  if (!result.allowed)
    headers['Retry-After'] = String(Math.max(1, Math.ceil(result.retryAfterMs / 1000)))
  return headers
}
