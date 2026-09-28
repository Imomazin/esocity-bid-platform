'use client'

import { RefreshCwIcon, TriangleAlertIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

/**
 * Segment error boundary. Customers never see stack traces or raw messages from the server:
 * in production, server errors arrive here as a generic message with a digest for log lookup.
 */
export default function SiteError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error('Page error', { digest: error.digest })
  }, [error])
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-warning-soft text-warning-foreground">
        <TriangleAlertIcon className="size-7" aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 text-muted-foreground">
        We couldn’t load this page. Your bids, wallet and orders are safe — nothing was changed.
        Please try again.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button variant="brand" onClick={() => retry()}>
          <RefreshCwIcon /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go to home</Link>
        </Button>
      </div>
    </div>
  )
}
