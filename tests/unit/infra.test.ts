import { describe, expect, it, vi } from 'vitest'

import { DomainError } from '@/domain/errors'
import {
  MemoryIdempotencyStore,
  RedisIdempotencyStore,
  assertIdempotencyKey,
  executeIdempotently,
  fingerprint,
  stableStringify,
  type IdempotencyStore,
} from '@/server/infra/idempotency'
import { LockTimeoutError, MemoryLockProvider, RedisLockProvider } from '@/server/infra/locks'
import { MemoryRateLimiter, RATE_LIMIT_POLICIES, rateLimitHeaders } from '@/server/infra/rate-limit'
import type { RedisLike } from '@/server/infra/redis'

/** Minimal in-memory Redis supporting the commands the platform uses (SET NX PX, GET, DEL, lock release). */
class FakeRedis implements RedisLike {
  readonly values = new Map<string, { value: string; expiresAt: number | null }>()

  private live(key: string) {
    const record = this.values.get(key)
    if (record && record.expiresAt !== null && record.expiresAt <= Date.now()) {
      this.values.delete(key)
      return undefined
    }
    return record
  }

  async set(key: string, value: string, options: { nx?: boolean; xx?: boolean; px?: number } = {}) {
    const exists = this.live(key) !== undefined
    if ((options.nx && exists) || (options.xx && !exists)) return null
    this.values.set(key, { value, expiresAt: options.px ? Date.now() + options.px : null })
    return 'OK'
  }

  async get<T>(key: string) {
    return (this.live(key)?.value ?? null) as T | null
  }

  async del(...keys: string[]) {
    return keys.filter((key) => this.values.delete(key)).length
  }

  async eval(script: string, keys: string[], args: (string | number)[]) {
    if (!script.includes('redis.call("del"')) throw new Error('Unsupported script in FakeRedis')
    const [key] = keys
    if (key && this.live(key)?.value === String(args[0])) return this.del(key)
    return 0
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 1))

describe('rate limiting', () => {
  it('allows the policy limit within a sliding window, then blocks with a retry hint', async () => {
    const limiter = new MemoryRateLimiter()
    const policy = RATE_LIMIT_POLICIES.bidBurst
    const t = 1_000_000
    const results = []
    for (let index = 0; index < policy.limit + 1; index += 1)
      results.push(await limiter.consume('member-1', policy, t + index * 10))
    expect(results.slice(0, policy.limit).every((result) => result.allowed)).toBe(true)
    const blocked = results.at(-1)!
    expect(blocked).toMatchObject({ allowed: false, remaining: 0 })
    expect(blocked.retryAfterMs).toBe(policy.windowMs - policy.limit * 10)
    expect(rateLimitHeaders(blocked)['Retry-After']).toBe('1')
    // Other members and other policies are unaffected.
    expect((await limiter.consume('member-2', policy, t)).allowed).toBe(true)
    expect((await limiter.consume('member-1', RATE_LIMIT_POLICIES.checkout, t)).allowed).toBe(true)
    // The window slides: once the oldest request ages out, a new one is allowed.
    expect((await limiter.consume('member-1', policy, t + policy.windowMs + 1)).allowed).toBe(true)
  })

  it('keeps bid policies stricter than general mutations', () => {
    expect(RATE_LIMIT_POLICIES.bidBurst.limit).toBeLessThan(RATE_LIMIT_POLICIES.mutation.limit)
    expect(RATE_LIMIT_POLICIES.bidSustained.limit).toBeLessThanOrEqual(
      RATE_LIMIT_POLICIES.mutation.limit,
    )
  })
})

describe('idempotency', () => {
  const run = (
    store: IdempotencyStore,
    key: string,
    payload: unknown,
    action: () => Promise<unknown>,
  ) =>
    executeIdempotently({ store, scope: 'bid', userId: 'member-1', key, payload }, async () => ({
      status: 200,
      body: await action(),
    }))

  it.each([
    ['memory', () => new MemoryIdempotencyStore()],
    ['redis', () => new RedisIdempotencyStore(new FakeRedis())],
  ])('executes once and replays the stored response (%s store)', async (_kind, create) => {
    const store = create()
    const action = vi.fn(async () => ({ sequence: 1 }))
    const first = await run(store, 'key-00000001', { auction: 'a' }, action)
    const second = await run(store, 'key-00000001', { auction: 'a' }, action)
    expect(action).toHaveBeenCalledTimes(1)
    expect(first).toMatchObject({ replayed: false, body: { sequence: 1 } })
    expect(second).toMatchObject({ replayed: true, body: { sequence: 1 } })
    await expect(run(store, 'key-00000001', { auction: 'b' }, action)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    })
  })

  it('rejects a concurrent duplicate while the first request is still running', async () => {
    const store = new MemoryIdempotencyStore()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const action = vi.fn(async () => {
      await gate
      return { ok: true }
    })
    const first = run(store, 'key-00000002', {}, action)
    await tick()
    await expect(run(store, 'key-00000002', {}, action)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_IN_PROGRESS',
    })
    release()
    await expect(first).resolves.toMatchObject({ replayed: false })
    expect(action).toHaveBeenCalledTimes(1)
  })

  it('replays business rejections but releases the key after unexpected failures', async () => {
    const store = new MemoryIdempotencyStore()
    const rejected = vi.fn(async () => {
      throw new DomainError('INSUFFICIENT_CREDITS', 'You do not have enough bid credits.')
    })
    await expect(run(store, 'key-00000003', {}, rejected)).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
    })
    await expect(run(store, 'key-00000003', {}, rejected)).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
    })
    expect(rejected).toHaveBeenCalledTimes(1)

    const crashing = vi.fn(async () => {
      throw new Error('connection reset')
    })
    await expect(run(store, 'key-00000004', {}, crashing)).rejects.toThrow('connection reset')
    const recovered = await run(store, 'key-00000004', {}, async () => 'done')
    expect(recovered).toMatchObject({ replayed: false, body: 'done' })
  })

  it('validates keys and fingerprints payloads independently of key order', async () => {
    expect(() => assertIdempotencyKey(null)).toThrow(DomainError)
    expect(() => assertIdempotencyKey('short')).toThrow(DomainError)
    expect(() => assertIdempotencyKey('has spaces in it')).toThrow(DomainError)
    expect(assertIdempotencyKey('7f9c2d1e-0b1a-4c3d-9e8f-123456789abc')).toBe(
      '7f9c2d1e-0b1a-4c3d-9e8f-123456789abc',
    )
    expect(stableStringify({ b: 1, a: [2, { d: undefined, c: 3 }] })).toBe(
      '{"a":[2,{"c":3}],"b":1}',
    )
    expect(await fingerprint({ a: 1, b: 2 })).toBe(await fingerprint({ b: 2, a: 1 }))
    expect(await fingerprint({ a: 1 })).not.toBe(await fingerprint({ a: 2 }))
  })
})

describe('locks', () => {
  /** A deliberately racy read-modify-write: without mutual exclusion updates are lost. */
  async function racyIncrement(counter: { value: number }) {
    const read = counter.value
    await tick()
    counter.value = read + 1
  }

  it('serialises work per key in FIFO order and runs different keys independently', async () => {
    const locks = new MemoryLockProvider()
    const counter = { value: 0 }
    const order: number[] = []
    await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        locks.withLock('auction:1', async () => {
          order.push(index)
          await racyIncrement(counter)
        }),
      ),
    )
    expect(counter.value).toBe(25)
    expect(order).toEqual(Array.from({ length: 25 }, (_, index) => index))

    const unlocked = { value: 0 }
    await Promise.all(Array.from({ length: 5 }, () => racyIncrement(unlocked)))
    expect(unlocked.value).toBeLessThan(5) // proves the test would catch a missing lock
  })

  it('releases the lock when the critical section throws', async () => {
    const locks = new MemoryLockProvider()
    await expect(
      locks.withLock('k', async () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom')
    await expect(locks.withLock('k', async () => 'next')).resolves.toBe('next')
  })

  it('uses a unique token so one holder can never release another holder’s Redis lock', async () => {
    const redis = new FakeRedis()
    const locks = new RedisLockProvider(redis)
    const counter = { value: 0 }
    await Promise.all(
      Array.from({ length: 5 }, () =>
        locks.withLock('auction:2', () => racyIncrement(counter), { waitMs: 2_000 }),
      ),
    )
    expect(counter.value).toBe(5)
    expect(redis.values.size).toBe(0)

    await redis.set('esb:lock:held', 'someone-else', { px: 10_000 })
    await expect(
      locks.withLock('held', async () => 'never', { waitMs: 30 }),
    ).rejects.toBeInstanceOf(LockTimeoutError)
    expect(await redis.get('esb:lock:held')).toBe('someone-else')
  })
})
