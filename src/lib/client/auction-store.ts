'use client'

import { useEffect, useSyncExternalStore } from 'react'

import type { AuctionSnapshot } from '@/server/views'

import { api } from './api'

/**
 * Client cache of authoritative auction snapshots, fed by polling (demo realtime transport) or,
 * later, by a push provider (Ably/Pusher). Components subscribe per auction id, so a price change
 * re-renders only the affected price/leader/countdown islands.
 */

const snapshots = new Map<string, AuctionSnapshot>()
const listeners = new Map<string, Set<() => void>>()

function notify(id: string) {
  for (const listener of listeners.get(id) ?? []) listener()
}

export function putSnapshot(snapshot: AuctionSnapshot): void {
  const existing = snapshots.get(snapshot.id)
  if (existing && existing.version > snapshot.version && existing.status === snapshot.status) return
  snapshots.set(snapshot.id, snapshot)
  notify(snapshot.id)
}

export function seedSnapshot(snapshot: AuctionSnapshot): void {
  if (!snapshots.has(snapshot.id)) snapshots.set(snapshot.id, snapshot)
}

export function useAuctionSnapshot(initial: AuctionSnapshot): AuctionSnapshot {
  return useSyncExternalStore(
    (listener) => {
      const set = listeners.get(initial.id) ?? new Set()
      set.add(listener)
      listeners.set(initial.id, set)
      return () => set.delete(listener)
    },
    () => snapshots.get(initial.id) ?? initial,
    () => initial,
  )
}

/** Polls the batch snapshot endpoint for the given auctions while the tab is visible. */
export function useAuctionPolling(ids: string[], intervalMs = 2_000): void {
  const key = ids.join(',')
  useEffect(() => {
    if (!key) return
    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | null = null
    const controller = new AbortController()
    const run = async () => {
      if (cancelled) return
      if (document.visibilityState === 'visible') {
        try {
          const data = await api<{ serverTime: number; auctions: AuctionSnapshot[] }>(
            `/api/auctions/snapshot?ids=${encodeURIComponent(key)}`,
            {
              signal: controller.signal,
            },
          )
          for (const snapshot of data.auctions) putSnapshot(snapshot)
        } catch {
          // Transient failures are tolerated; the next poll retries.
        }
      }
      if (!cancelled) timeout = setTimeout(run, intervalMs)
    }
    timeout = setTimeout(run, 400)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        if (timeout) clearTimeout(timeout)
        void run()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      controller.abort()
      if (timeout) clearTimeout(timeout)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [key, intervalMs])
}
