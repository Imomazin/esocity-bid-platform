import 'server-only'

import { Redis } from '@upstash/redis'

import { getServerEnv } from '@/lib/config/env'

/**
 * Minimal Redis surface used by the platform. The Upstash REST client satisfies it; tests use an
 * in-memory fake. Keeping the surface small keeps distributed controls easy to reason about.
 */
export interface RedisLike {
  set(
    key: string,
    value: string,
    options?: { nx?: boolean; xx?: boolean; px?: number },
  ): Promise<unknown>
  get<T = unknown>(key: string): Promise<T | null>
  del(...keys: string[]): Promise<number>
  eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown>
}

let client: Redis | null | undefined

/** Upstash Redis client when UPSTASH_REDIS_REST_URL/TOKEN are configured, otherwise null. */
export function getRedis(): Redis | null {
  if (client !== undefined) return client
  const env = getServerEnv()
  client =
    env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
      ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
      : null
  return client
}

export function getRedisLike(): RedisLike | null {
  const redis = getRedis()
  if (!redis) return null
  return {
    set: (key, value, options) => {
      if (options?.nx && options.px) return redis.set(key, value, { nx: true, px: options.px })
      if (options?.xx && options.px) return redis.set(key, value, { xx: true, px: options.px })
      if (options?.px) return redis.set(key, value, { px: options.px })
      return redis.set(key, value)
    },
    get: (key) => redis.get(key),
    del: (...keys) => redis.del(...keys),
    eval: (script, keys, args) => redis.eval(script, keys, args),
  }
}
