'use client'

import { useSyncExternalStore } from 'react'

/**
 * Server-synchronised clock.
 *
 * Countdowns are derived from the authoritative `closeAt` and the SERVER's time, never from a
 * decrementing client counter. We estimate the offset between the server clock and this browser
 * from API responses (adjusting for round-trip time) and tick a single shared timer so only the
 * small countdown components re-render — never whole pages.
 */

let offsetMs = 0
let offsetSamples = 0
let currentSecond = 0
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

export function serverNow(): number {
  return Date.now() + offsetMs
}

/** Incorporate a server timestamp observed between `sentAt` and `receivedAt` (client clock). */
export function syncServerTime(
  serverTime: number,
  sentAt?: number,
  receivedAt: number = Date.now(),
): void {
  if (!Number.isFinite(serverTime)) return
  const midpoint = sentAt !== undefined ? sentAt + (receivedAt - sentAt) / 2 : receivedAt
  const sample = serverTime - midpoint
  // Exponential smoothing avoids visible jumps from network jitter.
  offsetMs = offsetSamples === 0 ? sample : offsetMs * 0.7 + sample * 0.3
  offsetSamples += 1
}

function tick() {
  const second = Math.floor(serverNow() / 1000)
  if (second !== currentSecond) {
    currentSecond = second
    for (const listener of listeners) listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!timer) {
    currentSecond = Math.floor(serverNow() / 1000)
    timer = setInterval(tick, 200)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

function getSnapshot(): number {
  return currentSecond || Math.floor(serverNow() / 1000)
}

/**
 * Current server time (ms, resolution: 1s). `initialServerTime` is the time the page was rendered
 * on the server, used for SSR and hydration so markup matches.
 */
export function useServerNow(initialServerTime: number): number {
  const second = useSyncExternalStore(subscribe, getSnapshot, () =>
    Math.floor(initialServerTime / 1000),
  )
  return second * 1000
}

/** Seed the clock from the server-rendered page time on first load. */
export function seedServerTime(serverTime: number): void {
  if (offsetSamples === 0) syncServerTime(serverTime)
}
