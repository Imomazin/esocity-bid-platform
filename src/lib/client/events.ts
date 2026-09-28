'use client'

import { useEffect, useState } from 'react'

/**
 * Tiny typed event bus for cross-component UI updates (e.g. wallet balance after a bid) without
 * re-rendering whole pages. Server state remains authoritative; these are optimistic hints that
 * are reconciled by the next server render or poll.
 */

export interface AppEvents {
  'wallet:balance': { available: number }
  'cart:count': { count: number }
  'notifications:unread': { unread: number }
}

export function emit<K extends keyof AppEvents>(name: K, detail: AppEvents[K]): void {
  window.dispatchEvent(new CustomEvent(`esb:${name}`, { detail }))
}

export function on<K extends keyof AppEvents>(
  name: K,
  handler: (detail: AppEvents[K]) => void,
): () => void {
  const listener = (event: Event) => handler((event as CustomEvent<AppEvents[K]>).detail)
  window.addEventListener(`esb:${name}`, listener)
  return () => window.removeEventListener(`esb:${name}`, listener)
}

const EVENT_VALUE: { [K in keyof AppEvents]: (detail: AppEvents[K]) => number } = {
  'wallet:balance': (detail) => detail.available,
  'cart:count': (detail) => detail.count,
  'notifications:unread': (detail) => detail.unread,
}

/**
 * Mirrors a server-rendered number that can also be updated optimistically through an app event.
 * A new server value (e.g. after `router.refresh()`) always replaces earlier optimistic updates.
 */
export function useEventValue<K extends keyof AppEvents>(serverValue: number, name: K): number {
  const [state, setState] = useState({ server: serverValue, value: serverValue })
  if (state.server !== serverValue) setState({ server: serverValue, value: serverValue })
  useEffect(
    () =>
      on(name, (detail) =>
        setState((current) => ({ ...current, value: EVENT_VALUE[name](detail) })),
      ),
    [name],
  )
  return state.server === serverValue ? state.value : serverValue
}
