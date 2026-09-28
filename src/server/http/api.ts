import 'server-only'

import { type NextRequest, NextResponse } from 'next/server'
import { ZodError, type ZodType } from 'zod'

import { DomainError, isDomainError } from '@/domain/errors'
import { getAdminActor, getViewer, type AdminActor, type Viewer } from '@/server/auth/session'
import { assertPermission, type Permission } from '@/server/auth/roles'
import { assertIdempotencyKey, executeIdempotently } from '@/server/infra/idempotency'
import { logger } from '@/server/infra/logger'
import {
  RATE_LIMIT_POLICIES,
  rateLimitHeaders,
  type RateLimitPolicyName,
  type RateLimitResult,
} from '@/server/infra/rate-limit'
import { getRuntime, type Runtime } from '@/server/runtime'

import { ERROR_MESSAGES, ERROR_STATUS } from './errors'

/**
 * Typed route handler wrapper providing, for every API route:
 *  - a standard response envelope { ok, data | error, requestId }
 *  - request IDs (propagated from the proxy or generated)
 *  - same-origin (CSRF) protection for mutating methods
 *  - authentication and role/permission checks
 *  - rate limiting with standard RateLimit headers
 *  - Zod validation of JSON bodies and query strings
 *  - idempotency for critical commerce actions
 *  - central error mapping that never leaks stack traces
 */

export interface ApiSuccess<T> {
  ok: true
  data: T
  requestId: string
}

export interface ApiFailure {
  ok: false
  error: { code: string; message: string; details?: Record<string, unknown> }
  requestId: string
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure

type AuthMode = 'none' | 'optional' | 'customer' | 'admin'

export interface RouteOptions<TBody, TQuery> {
  auth?: AuthMode
  permission?: Permission
  rateLimit?: RateLimitPolicyName | RateLimitPolicyName[]
  body?: ZodType<TBody>
  query?: ZodType<TQuery>
  idempotency?: { scope: string }
}

export interface HandlerContext<TParams, TBody, TQuery> {
  request: NextRequest
  params: TParams
  body: TBody
  query: TQuery
  requestId: string
  viewer: Viewer | null
  admin: AdminActor | null
  runtime: Runtime
  ip: string
  idempotencyKey: string | null
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return (forwarded?.split(',')[0] ?? request.headers.get('x-real-ip') ?? 'unknown').trim()
}

/** Browsers always send Origin on cross-origin mutations; a mismatch indicates a forged request. */
export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site') return false
  if (!origin) return true
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function json<T>(
  body: ApiEnvelope<T>,
  status: number,
  headers: Record<string, string> = {},
): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

export function errorResponse(
  error: unknown,
  requestId: string,
  headers: Record<string, string> = {},
): NextResponse {
  if (isDomainError(error)) {
    const status = ERROR_STATUS[error.code] ?? 400
    return json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message || ERROR_MESSAGES[error.code] || 'Request failed',
          details: error.details,
        },
        requestId,
      },
      status,
      headers,
    )
  }
  if (error instanceof ZodError) {
    return json(
      {
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Some details need attention.',
          details: {
            issues: error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        },
        requestId,
      },
      422,
      headers,
    )
  }
  logger.error('Unhandled API error', { requestId, error })
  return json(
    { ok: false, error: { code: 'INTERNAL', message: ERROR_MESSAGES.INTERNAL! }, requestId },
    500,
    headers,
  )
}

async function enforceRateLimits(
  runtime: Runtime,
  names: RateLimitPolicyName[],
  key: string,
): Promise<RateLimitResult | null> {
  let last: RateLimitResult | null = null
  for (const name of names) {
    const result = await runtime.rateLimiter.consume(key, RATE_LIMIT_POLICIES[name])
    last = result
    if (!result.allowed) {
      throw Object.assign(
        new DomainError('RATE_LIMITED', ERROR_MESSAGES.RATE_LIMITED!, {
          retryAfterMs: result.retryAfterMs,
        }),
        {
          rateLimit: result,
        },
      )
    }
  }
  return last
}

export function route<TParams = Record<string, string>, TBody = undefined, TQuery = undefined>(
  options: RouteOptions<TBody, TQuery>,
  handler: (ctx: HandlerContext<TParams, TBody, TQuery>) => Promise<unknown>,
) {
  return async (
    request: NextRequest,
    context: { params: Promise<TParams> },
  ): Promise<NextResponse> => {
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
    let extraHeaders: Record<string, string> = { 'x-request-id': requestId }
    try {
      const runtime = getRuntime()
      const mutating = MUTATING.has(request.method)
      if (mutating && !isSameOriginRequest(request)) {
        throw new DomainError('CSRF_REJECTED', ERROR_MESSAGES.CSRF_REJECTED!)
      }
      const authMode = options.auth ?? 'optional'
      const viewer = authMode === 'none' ? null : await getViewer()
      let admin: AdminActor | null = null
      if (authMode === 'customer' && !viewer) {
        throw new DomainError('UNAUTHENTICATED', ERROR_MESSAGES.UNAUTHENTICATED!)
      }
      if (authMode === 'admin') {
        admin = await getAdminActor()
        if (!admin)
          throw new DomainError('UNAUTHENTICATED', 'Sign in with a staff account to continue.')
        assertPermission(admin.roles, options.permission ?? 'admin.access')
      }
      const ip = clientIp(request)
      const limitKey = admin?.id ?? viewer?.userId ?? `ip:${ip}`
      const policies = options.rateLimit
        ? Array.isArray(options.rateLimit)
          ? options.rateLimit
          : [options.rateLimit]
        : mutating
          ? (['mutation'] as RateLimitPolicyName[])
          : (['read'] as RateLimitPolicyName[])
      try {
        const limit = await enforceRateLimits(runtime, policies, limitKey)
        if (limit) extraHeaders = { ...extraHeaders, ...rateLimitHeaders(limit) }
      } catch (error) {
        const limit = (error as { rateLimit?: RateLimitResult }).rateLimit
        if (limit) extraHeaders = { ...extraHeaders, ...rateLimitHeaders(limit) }
        throw error
      }

      const params = await context.params
      let body = undefined as TBody
      if (options.body) {
        let raw: unknown
        try {
          raw = await request.json()
        } catch {
          throw new DomainError('VALIDATION_FAILED', 'The request body must be valid JSON.')
        }
        body = options.body.parse(raw)
      }
      let query = undefined as TQuery
      if (options.query) {
        query = options.query.parse(Object.fromEntries(request.nextUrl.searchParams.entries()))
      }

      const ctx: HandlerContext<TParams, TBody, TQuery> = {
        request,
        params,
        body,
        query,
        requestId,
        viewer,
        admin,
        runtime,
        ip,
        idempotencyKey: null,
      }

      if (options.idempotency) {
        const key = assertIdempotencyKey(request.headers.get('idempotency-key'))
        ctx.idempotencyKey = key
        const result = await executeIdempotently(
          {
            store: runtime.idempotency,
            scope: options.idempotency.scope,
            userId: limitKey,
            key,
            payload: { params, body: body ?? null },
          },
          async () => ({ status: 200, body: await handler(ctx) }),
        )
        return json({ ok: true, data: result.body, requestId }, 200, {
          ...extraHeaders,
          ...(result.replayed ? { 'Idempotent-Replayed': 'true' } : {}),
        })
      }

      const data = await handler(ctx)
      if (data instanceof Response) return data as NextResponse
      return json({ ok: true, data, requestId }, 200, extraHeaders)
    } catch (error) {
      return errorResponse(error, requestId, extraHeaders)
    }
  }
}
