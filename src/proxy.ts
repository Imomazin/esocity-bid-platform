import { NextResponse, type NextRequest } from 'next/server'

/**
 * Network-boundary proxy (Next.js 16 `proxy` convention, formerly middleware):
 *  - issues a per-request CSP nonce (script-src 'nonce-…' 'strict-dynamic')
 *  - assigns/propagates an X-Request-Id for tracing and audit correlation
 * Authentication and authorisation are enforced in each route and page, never only here.
 */
export function proxy(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
  const nonce = btoa(crypto.randomUUID())
  const isDev = process.env.NODE_ENV === 'development'
  const realtime =
    process.env.REALTIME_PROVIDER === 'ably' ? ' https://*.ably.io wss://*.ably.io' : ''
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https:",
    "font-src 'self' data:",
    `connect-src 'self'${realtime}${isDev ? ' ws: wss:' : ''}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    process.env.VERCEL === '1' ? 'upgrade-insecure-requests' : '',
  ]
    .filter(Boolean)
    .join('; ')

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('x-request-id', requestId)
  requestHeaders.set('content-security-policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('content-security-policy', csp)
  response.headers.set('x-request-id', requestId)
  return response
}

export const config = {
  matcher: [
    {
      source:
        '/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|robots.txt|sitemap.xml).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
