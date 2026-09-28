import 'server-only'

import { DomainError } from '@/domain/errors'
import { getServerEnv } from '@/lib/config/env'
import { MemoryAuditLog } from '@/server/infra/audit'
import {
  MemoryIdempotencyStore,
  RedisIdempotencyStore,
  type IdempotencyStore,
} from '@/server/infra/idempotency'
import { MemoryLockProvider, RedisLockProvider, type LockProvider } from '@/server/infra/locks'
import {
  DisabledRateLimiter,
  MemoryRateLimiter,
  RedisRateLimiter,
  type RateLimiter,
} from '@/server/infra/rate-limit'
import { getRedisLike } from '@/server/infra/redis'
import { DemoAnalyticsTracker, type AnalyticsTracker } from '@/server/providers/analytics'
import {
  DemoEmailProvider,
  ResendEmailProvider,
  type EmailProvider,
} from '@/server/providers/email'
import {
  DemoPaymentProvider,
  StripePaymentProvider,
  type PaymentProvider,
} from '@/server/providers/payments'
import {
  AblyRealtimePublisher,
  DemoRealtimePublisher,
  type RealtimePublisher,
} from '@/server/providers/realtime'
import { DemoShippingProvider, type ShippingProvider } from '@/server/providers/shipping'
import { DemoStorageProvider, type StorageProvider } from '@/server/providers/storage'

import { DemoBackend } from './demo/backend'

/**
 * Composition root. Chooses an implementation for every port based on configuration.
 *
 *  - DEMO_MODE=true (default): in-memory deterministic backend, simulated payments and email.
 *    If Upstash is configured, rate limits, locks and idempotency keys become distributed.
 *  - DEMO_MODE=false: production adapters. The PostgreSQL auction engine and ledgers live in
 *    src/server/postgres; wiring the full production backend is Phase 2 (docs/ROADMAP.md).
 */
export interface Runtime {
  mode: 'demo' | 'production'
  rateLimiter: RateLimiter
  locks: LockProvider
  idempotency: IdempotencyStore
  audit: MemoryAuditLog
  payments: PaymentProvider
  email: EmailProvider
  realtime: RealtimePublisher
  shipping: ShippingProvider
  storage: StorageProvider
  analytics: AnalyticsTracker
  readonly backend: DemoBackend
}

function createRuntime(): Runtime {
  const env = getServerEnv()
  const demo = env.DEMO_MODE
  const redis = getRedisLike()
  const rateLimiter: RateLimiter = !env.RATE_LIMIT_ENABLED
    ? new DisabledRateLimiter()
    : redis
      ? new RedisRateLimiter(redis)
      : new MemoryRateLimiter()
  // Demo state lives in this process, so bids are serialised with an in-process lock. The Redis
  // lock is used by the production engine, where state is shared across instances.
  const locks: LockProvider =
    !demo && redis ? new RedisLockProvider(redis) : new MemoryLockProvider()
  const idempotency: IdempotencyStore = redis
    ? new RedisIdempotencyStore(redis)
    : new MemoryIdempotencyStore()
  const payments: PaymentProvider =
    !demo && env.PAYMENT_PROVIDER === 'stripe' && env.STRIPE_SECRET_KEY
      ? new StripePaymentProvider(env.STRIPE_SECRET_KEY)
      : new DemoPaymentProvider()
  const email: EmailProvider =
    !demo && env.EMAIL_PROVIDER === 'resend' && env.RESEND_API_KEY
      ? new ResendEmailProvider(
          env.RESEND_API_KEY,
          env.EMAIL_FROM ?? 'Esocity Bid <no-reply@esocity.example>',
        )
      : new DemoEmailProvider()
  const realtime: RealtimePublisher =
    env.REALTIME_PROVIDER === 'ably' && env.ABLY_API_KEY
      ? new AblyRealtimePublisher(env.ABLY_API_KEY)
      : new DemoRealtimePublisher()
  const shipping = new DemoShippingProvider()
  const storage = new DemoStorageProvider()
  const analytics = new DemoAnalyticsTracker()
  const audit = new MemoryAuditLog()

  let backend: DemoBackend | null = null
  return {
    mode: demo ? 'demo' : 'production',
    rateLimiter,
    locks,
    idempotency,
    audit,
    payments,
    email,
    realtime,
    shipping,
    storage,
    analytics,
    get backend(): DemoBackend {
      if (!demo) {
        throw new DomainError(
          'FEATURE_DISABLED',
          'Production persistence is not enabled in this build. Set DEMO_MODE=true or complete the Phase 2 PostgreSQL wiring (docs/ROADMAP.md).',
        )
      }
      backend ??= new DemoBackend(
        { payments, email, realtime, shipping, analytics },
        { locks, audit },
      )
      return backend
    },
  }
}

const globalForRuntime = globalThis as typeof globalThis & { __esocityRuntime?: Runtime }

/** Process-wide runtime singleton (survives dev hot reloads). */
export function getRuntime(): Runtime {
  globalForRuntime.__esocityRuntime ??= createRuntime()
  return globalForRuntime.__esocityRuntime
}

export function getBackend(): DemoBackend {
  return getRuntime().backend
}
