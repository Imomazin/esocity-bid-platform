'use client'

import { useEffect, useRef, useState } from 'react'

import type { AuctionStatus } from '@/domain/auction/types'
import { seedServerTime, useServerNow } from '@/lib/client/clock'
import { describeDuration, formatCountdown } from '@/lib/time'
import { cn } from '@/lib/utils'

export interface CountdownProps {
  status: AuctionStatus
  startsAt: number
  closeAt: number
  remainingAtPauseMs: number | null
  serverTime: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  /** Announce threshold crossings to assistive technology (use once per page). */
  announce?: boolean
}

const THRESHOLDS = [60, 30, 10, 5]

export function useRemaining(
  props: Pick<
    CountdownProps,
    'status' | 'startsAt' | 'closeAt' | 'remainingAtPauseMs' | 'serverTime'
  >,
) {
  const now = useServerNow(props.serverTime)
  if (props.status === 'PAUSED')
    return { mode: 'paused' as const, ms: props.remainingAtPauseMs ?? 0 }
  if (props.status === 'SCHEDULED' || props.status === 'DRAFT')
    return { mode: 'starts' as const, ms: Math.max(0, props.startsAt - now) }
  if (props.status === 'LIVE') {
    const ms = props.closeAt - now
    return ms > 0 ? { mode: 'live' as const, ms } : { mode: 'finalising' as const, ms: 0 }
  }
  return { mode: 'ended' as const, ms: 0 }
}

export function Countdown(props: CountdownProps) {
  const { size = 'md', className, announce = false } = props
  useEffect(() => seedServerTime(props.serverTime), [props.serverTime])
  const remaining = useRemaining(props)
  const [message, setMessage] = useState('')
  const lastAnnounced = useRef<number | null>(null)
  const seconds = Math.ceil(remaining.ms / 1000)

  useEffect(() => {
    if (!announce || remaining.mode !== 'live') return
    const threshold = THRESHOLDS.find(
      (value) =>
        seconds <= value && (lastAnnounced.current === null || value < lastAnnounced.current),
    )
    if (threshold !== undefined && seconds > 0) {
      lastAnnounced.current = threshold
      setMessage(`${threshold} seconds remaining`)
    }
    if (seconds > 60) lastAnnounced.current = null
  }, [announce, remaining.mode, seconds])

  const urgent = remaining.mode === 'live' && remaining.ms <= 10_000
  const warning = remaining.mode === 'live' && remaining.ms <= 60_000 && !urgent
  const sizes = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl', xl: 'text-4xl sm:text-5xl' }
  let text: string
  switch (remaining.mode) {
    case 'paused':
      text = `Paused · ${formatCountdown(remaining.ms)}`
      break
    case 'starts':
      text = formatCountdown(remaining.ms)
      break
    case 'live':
      text = formatCountdown(remaining.ms)
      break
    case 'finalising':
      text = 'Finalising…'
      break
    default:
      text = 'Ended'
  }
  return (
    <>
      <span
        role="timer"
        aria-live="off"
        aria-label={
          remaining.mode === 'live'
            ? `${describeDuration(remaining.ms)} remaining`
            : remaining.mode === 'starts'
              ? `Starts in ${describeDuration(remaining.ms)}`
              : text
        }
        className={cn(
          'tabular font-mono font-semibold tracking-tight transition-colors',
          sizes[size],
          urgent && 'text-live',
          warning && 'text-warning',
          (remaining.mode === 'ended' || remaining.mode === 'finalising') &&
            'text-muted-foreground',
          className,
        )}
      >
        {text}
      </span>
      {announce ? (
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {message}
        </span>
      ) : null}
    </>
  )
}
