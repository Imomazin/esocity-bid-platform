'use client'

import { useEffect } from 'react'

/**
 * Last-resort boundary for errors in the root layout. It renders its own document without the
 * app stylesheet, so it uses minimal inline styles and follows the OS colour scheme.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('Global error', { digest: error.digest })
  }, [error])
  return (
    <html lang="en-GB">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          colorScheme: 'light dark',
        }}
      >
        <title>Something went wrong · Esocity Bid</title>
        <main style={{ maxWidth: 440, padding: 24, textAlign: 'center' }}>
          <p style={{ fontWeight: 600, letterSpacing: '0.14em', fontSize: 13 }}>ESOCITY BID</p>
          <h1 style={{ fontSize: 24, margin: '16px 0 8px' }}>Something went wrong</h1>
          <p style={{ opacity: 0.7, lineHeight: 1.5 }}>
            We couldn’t load Esocity Bid. Your account, bids and orders are safe. Please try again
            in a moment.
          </p>
          {error.digest ? (
            <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, opacity: 0.6 }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 16,
              padding: '10px 18px',
              borderRadius: 10,
              border: 0,
              background: '#3d4beb',
              color: '#fff',
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
