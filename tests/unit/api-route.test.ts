import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { DomainError } from '@/domain/errors'
import { route } from '@/server/http/api'

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}))

const ORIGIN = 'http://localhost:3000'
const noParams = { params: Promise.resolve({}) }

function request(
  method: string,
  path: string,
  init: { body?: unknown; headers?: Record<string, string> } = {},
) {
  const headers = new Headers({ host: 'localhost:3000', ...init.headers })
  const body =
    init.body === undefined
      ? undefined
      : typeof init.body === 'string'
        ? init.body
        : JSON.stringify(init.body)
  if (body !== undefined) headers.set('content-type', 'application/json')
  return new NextRequest(`${ORIGIN}${path}`, { method, headers, body })
}

type Handler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>

async function call(handler: Handler, req: NextRequest) {
  const response = await handler(req, noParams)
  return {
    status: response.status,
    headers: response.headers,
    body: (await response.json()) as Record<string, unknown>,
  }
}

beforeEach(() => {
  jar.clear()
})

describe('API route wrapper', () => {
  it('wraps results in the standard envelope and propagates the request id', async () => {
    const handler = route({ auth: 'none' }, async () => ({ hello: 'world' }))
    const result = await call(
      handler,
      request('GET', '/api/test', { headers: { 'x-request-id': 'req-123' } }),
    )
    expect(result.status).toBe(200)
    expect(result.body).toEqual({ ok: true, data: { hello: 'world' }, requestId: 'req-123' })
    expect(result.headers.get('x-request-id')).toBe('req-123')
    expect(result.headers.get('cache-control')).toBe('no-store')
    expect(result.headers.get('ratelimit-limit')).not.toBeNull()
  })

  it('rejects cross-site mutations (CSRF)', async () => {
    const handler = route({ auth: 'none' }, async () => 'should not run')
    const forged = await call(
      handler,
      request('POST', '/api/test', { headers: { origin: 'https://attacker.example' } }),
    )
    expect(forged.status).toBe(403)
    expect(forged.body).toMatchObject({ ok: false, error: { code: 'CSRF_REJECTED' } })
    const crossSite = await call(
      handler,
      request('POST', '/api/test', { headers: { 'sec-fetch-site': 'cross-site' } }),
    )
    expect(crossSite.status).toBe(403)
    const sameOrigin = await call(
      handler,
      request('POST', '/api/test', { headers: { origin: ORIGIN } }),
    )
    expect(sameOrigin.status).toBe(200)
  })

  it('validates bodies with a clear, field-level error envelope', async () => {
    const handler = route(
      { auth: 'none', body: z.object({ quantity: z.number().int().min(1) }) },
      async ({ body }) => body,
    )
    const invalid = await call(
      handler,
      request('POST', '/api/test', { body: { quantity: 0 }, headers: { origin: ORIGIN } }),
    )
    expect(invalid.status).toBe(422)
    expect(invalid.body).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED', details: { issues: [{ path: 'quantity' }] } },
    })
    const malformed = await call(
      handler,
      request('POST', '/api/test', { body: '{"quantity":', headers: { origin: ORIGIN } }),
    )
    expect(malformed.status).toBe(422)
    const valid = await call(
      handler,
      request('POST', '/api/test', { body: { quantity: 2 }, headers: { origin: ORIGIN } }),
    )
    expect(valid.body).toMatchObject({ ok: true, data: { quantity: 2 } })
  })

  it('maps domain errors to stable codes and never leaks internals', async () => {
    const domain = route({ auth: 'none' }, async () => {
      throw new DomainError('INSUFFICIENT_CREDITS', 'You do not have enough bid credits.')
    })
    const rejected = await call(domain, request('GET', '/api/test'))
    expect(rejected.status).toBe(402)
    expect(rejected.body).toMatchObject({
      ok: false,
      error: { code: 'INSUFFICIENT_CREDITS', message: 'You do not have enough bid credits.' },
    })

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const crashing = route({ auth: 'none' }, async () => {
      throw new Error('relation "wallets" does not exist at db.internal:5432')
    })
    const crashed = await call(crashing, request('GET', '/api/test'))
    errorSpy.mockRestore()
    expect(crashed.status).toBe(500)
    expect(crashed.body).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' },
    })
    const serialised = JSON.stringify(crashed.body)
    expect(serialised).not.toContain('wallets')
    expect(serialised).not.toContain('db.internal')
    expect(serialised).not.toMatch(/\bat \S+:\d+/)
  })

  it('requires a session for customer routes', async () => {
    const handler = route({ auth: 'customer' }, async ({ viewer }) => viewer?.displayName)
    const anonymous = await call(handler, request('GET', '/api/test'))
    expect(anonymous.status).toBe(401)
    jar.set('esb_session', crypto.randomUUID())
    const signedIn = await call(handler, request('GET', '/api/test'))
    expect(signedIn.body).toMatchObject({ ok: true, data: 'Demo Member' })
  })

  it('enforces role permissions on admin routes', async () => {
    const handler = route(
      { auth: 'admin', permission: 'refunds.issue' },
      async ({ admin }) => admin?.role,
    )
    jar.set('esb_demo_role', 'SUPPORT_AGENT')
    const denied = await call(handler, request('GET', '/api/admin/test'))
    expect(denied.status).toBe(403)
    expect(denied.body).toMatchObject({ error: { code: 'FORBIDDEN' } })
    jar.set('esb_demo_role', 'FINANCE')
    const allowed = await call(handler, request('GET', '/api/admin/test'))
    expect(allowed.body).toMatchObject({ ok: true, data: 'FINANCE' })
    // A customer role in the cookie can never grant staff access; it falls back to the demo operator.
    jar.set('esb_demo_role', 'CUSTOMER')
    expect((await call(handler, request('GET', '/api/admin/test'))).body).toMatchObject({
      data: 'ADMIN',
    })
  })

  it('requires an Idempotency-Key and replays the original result for a retried request', async () => {
    let executions = 0
    const handler = route(
      {
        auth: 'none',
        idempotency: { scope: 'test-purchase' },
        body: z.object({ pack: z.string() }),
      },
      async () => {
        executions += 1
        return { receipt: executions }
      },
    )
    const headers = { origin: ORIGIN, 'x-forwarded-for': '203.0.113.9' }
    const missing = await call(
      handler,
      request('POST', '/api/test', { body: { pack: 'starter' }, headers }),
    )
    expect(missing.status).toBe(422)

    const key = crypto.randomUUID()
    const first = await call(
      handler,
      request('POST', '/api/test', {
        body: { pack: 'starter' },
        headers: { ...headers, 'idempotency-key': key },
      }),
    )
    const retry = await call(
      handler,
      request('POST', '/api/test', {
        body: { pack: 'starter' },
        headers: { ...headers, 'idempotency-key': key },
      }),
    )
    expect(first.body).toMatchObject({ ok: true, data: { receipt: 1 } })
    expect(retry.body).toMatchObject({ ok: true, data: { receipt: 1 } })
    expect(retry.headers.get('idempotent-replayed')).toBe('true')
    expect(executions).toBe(1)

    const reused = await call(
      handler,
      request('POST', '/api/test', {
        body: { pack: 'power' },
        headers: { ...headers, 'idempotency-key': key },
      }),
    )
    expect(reused.body).toMatchObject({ ok: false, error: { code: 'IDEMPOTENCY_CONFLICT' } })
  })

  it('rate limits bursts with standard headers', async () => {
    const handler = route({ auth: 'none', rateLimit: 'bidBurst' }, async () => 'ok')
    const headers = { origin: ORIGIN, 'x-forwarded-for': '198.51.100.77' }
    const statuses: number[] = []
    let last: Awaited<ReturnType<typeof call>> | null = null
    for (let index = 0; index < 5; index += 1) {
      last = await call(handler, request('POST', '/api/test', { headers }))
      statuses.push(last.status)
    }
    expect(statuses).toEqual([200, 200, 200, 200, 429])
    expect(last!.body).toMatchObject({ error: { code: 'RATE_LIMITED' } })
    expect(Number(last!.headers.get('retry-after'))).toBeGreaterThanOrEqual(1)
  })
})
