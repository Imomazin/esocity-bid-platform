import type { RedisLike } from './redis'

/**
 * Distributed lock abstraction.
 *
 * Correctness of bid placement does NOT depend on this lock alone: the production engine uses a
 * PostgreSQL transaction with a row lock (SELECT … FOR UPDATE) on the auction. The distributed
 * lock is an additional guard that serialises work per auction across serverless instances and
 * reduces database contention under bursty traffic.
 */
export interface LockProvider {
  readonly kind: 'memory' | 'redis'
  withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options?: { ttlMs?: number; waitMs?: number },
  ): Promise<T>
}

export class LockTimeoutError extends Error {
  constructor(key: string) {
    super(`Timed out acquiring lock ${key}`)
    this.name = 'LockTimeoutError'
  }
}

/** Per-key FIFO mutex for a single process (demo mode and tests). */
export class MemoryLockProvider implements LockProvider {
  readonly kind = 'memory' as const
  private readonly tails = new Map<string, Promise<void>>()

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve()
    let release!: () => void
    const current = new Promise<void>((resolve) => {
      release = resolve
    })
    const tail = previous.then(() => current)
    this.tails.set(key, tail)
    await previous
    try {
      return await fn()
    } finally {
      release()
      if (this.tails.get(key) === tail) this.tails.delete(key)
    }
  }
}

const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`

/** Redis (Upstash) lock using SET NX PX with a unique token and compare-and-delete release. */
export class RedisLockProvider implements LockProvider {
  readonly kind = 'redis' as const

  constructor(
    private readonly redis: RedisLike,
    private readonly prefix = 'esb:lock:',
  ) {}

  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options: { ttlMs?: number; waitMs?: number } = {},
  ): Promise<T> {
    const ttlMs = options.ttlMs ?? 5_000
    const waitMs = options.waitMs ?? 3_000
    const lockKey = `${this.prefix}${key}`
    const token = crypto.randomUUID()
    const deadline = Date.now() + waitMs
    let delay = 15
    for (;;) {
      const acquired = await this.redis.set(lockKey, token, { nx: true, px: ttlMs })
      if (acquired === 'OK' || acquired === true) break
      if (Date.now() > deadline) throw new LockTimeoutError(key)
      await new Promise((resolve) => setTimeout(resolve, delay + Math.random() * delay))
      delay = Math.min(delay * 2, 200)
    }
    try {
      return await fn()
    } finally {
      await this.redis.eval(RELEASE_SCRIPT, [lockKey], [token])
    }
  }
}
