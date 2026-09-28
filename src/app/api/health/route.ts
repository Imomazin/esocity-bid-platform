import { NextResponse } from 'next/server'

import { getEnvIssues, getServerEnv } from '@/lib/config/env'
import { getRuntime } from '@/server/runtime'

export const dynamic = 'force-dynamic'

/** Liveness and configuration health. Never exposes secrets — only whether services are configured. */
export async function GET() {
  const env = getServerEnv()
  const runtime = getRuntime()
  const issues = getEnvIssues()
  let demo: Record<string, unknown> | null = null
  if (runtime.mode === 'demo') {
    try {
      demo = runtime.backend.health()
    } catch {
      demo = null
    }
  }
  const services = {
    database: env.DATABASE_URL
      ? 'configured'
      : runtime.mode === 'demo'
        ? 'not-required (demo)'
        : 'missing',
    redis: env.UPSTASH_REDIS_REST_URL ? 'configured' : 'memory',
    payments: runtime.payments.name === 'demo' ? 'demo (simulated)' : 'stripe',
    realtime: runtime.realtime.name === 'demo' ? 'demo (polling)' : runtime.realtime.name,
    email: runtime.email.name === 'demo' ? 'demo (logged)' : runtime.email.name,
    rateLimiting: runtime.rateLimiter.kind,
    idempotency: runtime.idempotency.kind,
  }
  const body = {
    status: issues.length === 0 ? 'ok' : 'degraded',
    version:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.npm_package_version ?? '0.1.0',
    environment: env.VERCEL_ENV ?? env.NODE_ENV,
    mode: runtime.mode,
    market: env.MARKET_REGION,
    currency: env.DEFAULT_CURRENCY,
    services,
    configurationIssues: issues.map((issue) => ({
      variable: issue.variable,
      message: issue.message,
    })),
    demo,
    time: new Date().toISOString(),
  }
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
