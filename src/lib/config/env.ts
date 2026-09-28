import 'server-only'

import { z } from 'zod'

/**
 * Server-side environment validation.
 *
 * Every variable is optional so that the first Vercel deployment works with DEMO_MODE=true and
 * no integrations. Validation is lazy (on first use), never at import/build time, and values
 * are never exposed to the client bundle — only NEXT_PUBLIC_* variables reach the browser.
 */

const booleanString = z
  .enum(['true', 'false', '1', '0', 'yes', 'no'])
  .transform((value) => value === 'true' || value === '1' || value === 'yes')

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional()

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  VERCEL_ENV: optionalString,
  DEMO_MODE: booleanString.default(true),
  NEXT_PUBLIC_APP_NAME: optionalString,
  NEXT_PUBLIC_APP_URL: optionalString,
  DATABASE_URL: optionalString,
  UPSTASH_REDIS_REST_URL: optionalString,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
  AUTH_SECRET: optionalString,
  PAYMENT_PROVIDER: z.enum(['demo', 'stripe']).default('demo'),
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalString,
  REALTIME_PROVIDER: z.enum(['demo', 'ably']).default('demo'),
  ABLY_API_KEY: optionalString,
  EMAIL_PROVIDER: z.enum(['demo', 'resend']).default('demo'),
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: optionalString,
  STORAGE_PROVIDER: z.enum(['demo', 'vercel-blob', 's3']).default('demo'),
  MARKET_REGION: z.enum(['UK', 'IE', 'US']).default('UK'),
  DEFAULT_CURRENCY: z.enum(['GBP', 'EUR', 'USD']).default('GBP'),
  RATE_LIMIT_ENABLED: booleanString.default(true),
  FEATURE_FLAGS: optionalString,
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

export interface EnvIssue {
  variable: string
  message: string
}

let cached: { env: ServerEnv; issues: EnvIssue[] } | null = null

function readRaw(): Record<string, string | undefined> {
  const keys = Object.keys(serverEnvSchema.shape)
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]))
}

/** Cross-field checks that should surface as warnings (health check) rather than crash builds. */
function collectIssues(env: ServerEnv): EnvIssue[] {
  const issues: EnvIssue[] = []
  if (!env.DEMO_MODE && !env.DATABASE_URL) {
    issues.push({ variable: 'DATABASE_URL', message: 'Required when DEMO_MODE=false' })
  }
  if (env.PAYMENT_PROVIDER === 'stripe' && !env.STRIPE_SECRET_KEY) {
    issues.push({ variable: 'STRIPE_SECRET_KEY', message: 'Required when PAYMENT_PROVIDER=stripe' })
  }
  if (env.PAYMENT_PROVIDER === 'stripe' && !env.STRIPE_WEBHOOK_SECRET) {
    issues.push({
      variable: 'STRIPE_WEBHOOK_SECRET',
      message: 'Required to verify Stripe webhooks',
    })
  }
  if (env.REALTIME_PROVIDER === 'ably' && !env.ABLY_API_KEY) {
    issues.push({ variable: 'ABLY_API_KEY', message: 'Required when REALTIME_PROVIDER=ably' })
  }
  if (env.EMAIL_PROVIDER === 'resend' && !env.RESEND_API_KEY) {
    issues.push({ variable: 'RESEND_API_KEY', message: 'Required when EMAIL_PROVIDER=resend' })
  }
  if (Boolean(env.UPSTASH_REDIS_REST_URL) !== Boolean(env.UPSTASH_REDIS_REST_TOKEN)) {
    issues.push({
      variable: 'UPSTASH_REDIS_REST_URL',
      message: 'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together',
    })
  }
  if (env.AUTH_SECRET && env.AUTH_SECRET.length < 32) {
    issues.push({ variable: 'AUTH_SECRET', message: 'Should be at least 32 characters' })
  }
  if (!env.DEMO_MODE && !env.AUTH_SECRET) {
    issues.push({ variable: 'AUTH_SECRET', message: 'Required when DEMO_MODE=false' })
  }
  return issues
}

function load(): { env: ServerEnv; issues: EnvIssue[] } {
  const parsed = serverEnvSchema.safeParse(readRaw())
  if (parsed.success) {
    return { env: parsed.data, issues: collectIssues(parsed.data) }
  }
  // Invalid values fall back to safe defaults (demo mode) and are reported via /api/health.
  const issues = parsed.error.issues.map((issue) => ({
    variable: issue.path.join('.'),
    message: issue.message,
  }))
  const fallback = serverEnvSchema.parse({ NODE_ENV: process.env.NODE_ENV })
  return { env: fallback, issues }
}

export function getServerEnv(): ServerEnv {
  cached ??= load()
  return cached.env
}

export function getEnvIssues(): EnvIssue[] {
  cached ??= load()
  return cached.issues
}

/** Test helper: force re-reading process.env. */
export function resetEnvCache(): void {
  cached = null
}

export function isDemoMode(): boolean {
  return getServerEnv().DEMO_MODE
}
