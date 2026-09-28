'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Re-renders the current server page on an interval while it is visible. Used for pages whose
 * data advances on the server (e.g. demo order fulfilment) without a dedicated live channel.
 */
export function AutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const timer = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(timer)
  }, [router, intervalMs])
  return null
}
