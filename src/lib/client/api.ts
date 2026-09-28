'use client'

import { syncServerTime } from './clock'

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: Record<string, unknown>

  constructor(code: string, message: string, status: number, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

interface Envelope<T> {
  ok: boolean
  data?: T
  error?: { code: string; message: string; details?: Record<string, unknown> }
  requestId?: string
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Sends an Idempotency-Key header; reuse the same key when retrying the same intent. */
  idempotencyKey?: string
  signal?: AbortSignal
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

/** Typed fetch against the Esocity API envelope. Also keeps the server clock in sync. */
export async function api<T>(url: string, options: ApiOptions = {}): Promise<T> {
  const sentAt = Date.now()
  let response: Response
  try {
    response = await fetch(url, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: options.signal,
    })
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    throw new ApiError(
      'NETWORK',
      'You appear to be offline. Check your connection and try again.',
      0,
    )
  }
  const receivedAt = Date.now()
  const dateHeader = response.headers.get('date')
  let payload: Envelope<T>
  try {
    payload = (await response.json()) as Envelope<T>
  } catch {
    throw new ApiError('INTERNAL', 'Something went wrong. Please try again.', response.status)
  }
  const data = payload.data as (T & { serverTime?: number }) | undefined
  if (data && typeof data === 'object' && typeof data.serverTime === 'number') {
    syncServerTime(data.serverTime, sentAt, receivedAt)
  } else if (dateHeader && !Number.isNaN(Date.parse(dateHeader))) {
    // Coarse fallback (1s resolution) only used before a precise sample exists.
  }
  if (!response.ok || !payload.ok) {
    const error = payload.error ?? {
      code: 'INTERNAL',
      message: 'Something went wrong. Please try again.',
    }
    throw new ApiError(error.code, error.message, response.status, error.details)
  }
  return payload.data as T
}
