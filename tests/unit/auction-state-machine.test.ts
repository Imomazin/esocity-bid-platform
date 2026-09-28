import { describe, expect, it } from 'vitest'

import {
  AUCTION_TRANSITIONS,
  MIN_REMAINING_TO_PAUSE_MS,
  allowedTransitions,
  assertTransition,
  canTransition,
  isTerminal,
  transition,
} from '@/domain/auction/state-machine'
import { AUCTION_STATUSES, type AuctionStatus } from '@/domain/auction/types'
import { DomainError } from '@/domain/errors'
import { MINUTE, SECOND } from '@/lib/time'

import { T0, liveAuction } from './fixtures'

const admin = (now: number, reason?: string) => ({ actor: 'ADMIN' as const, now, reason })
const system = (now: number) => ({ actor: 'SYSTEM' as const, now })

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (error) {
    return error instanceof DomainError ? error.code : 'UNEXPECTED'
  }
  return undefined
}

describe('auction state machine', () => {
  it('declares every status and has terminal COMPLETED and CANCELLED', () => {
    expect(Object.keys(AUCTION_TRANSITIONS).sort()).toEqual([...AUCTION_STATUSES].sort())
    expect(AUCTION_STATUSES.filter(isTerminal)).toEqual(['COMPLETED', 'CANCELLED'])
  })

  it.each<[AuctionStatus, AuctionStatus, boolean]>([
    ['DRAFT', 'SCHEDULED', true],
    ['DRAFT', 'LIVE', false],
    ['SCHEDULED', 'LIVE', true],
    ['SCHEDULED', 'DRAFT', true],
    ['LIVE', 'PAUSED', true],
    ['LIVE', 'COMPLETED', false],
    ['PAUSED', 'LIVE', true],
    ['PAUSED', 'FINALIZING', false],
    ['FINALIZING', 'COMPLETED', true],
    ['COMPLETED', 'LIVE', false],
    ['CANCELLED', 'SCHEDULED', false],
  ])('%s → %s allowed: %s', (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected)
  })

  it('never lets an admin finalise or complete an auction', () => {
    expect(allowedTransitions('LIVE', 'ADMIN')).toEqual(['PAUSED', 'CANCELLED'])
    expect(allowedTransitions('LIVE', 'SYSTEM')).toEqual(['PAUSED', 'FINALIZING', 'CANCELLED'])
    expect(allowedTransitions('FINALIZING', 'ADMIN')).toEqual([])
    const expired = liveAuction({ closeAt: T0 + MINUTE })
    expect(codeOf(() => assertTransition(expired, 'FINALIZING', admin(T0 + 2 * MINUTE)))).toBe(
      'INVALID_TRANSITION',
    )
    expect(
      codeOf(() => assertTransition(expired, 'FINALIZING', system(T0 + 2 * MINUTE))),
    ).toBeUndefined()
  })

  it('refuses to finalise before the authoritative clock expires', () => {
    const auction = liveAuction({ closeAt: T0 + MINUTE })
    expect(codeOf(() => transition(auction, 'FINALIZING', system(T0 + MINUTE - 1)))).toBe(
      'INVALID_TRANSITION',
    )
    expect(transition(auction, 'FINALIZING', system(T0 + MINUTE)).status).toBe('FINALIZING')
  })

  it('requires a future start to schedule a draft', () => {
    const draft = liveAuction({ status: 'DRAFT', startsAt: T0 })
    expect(codeOf(() => transition(draft, 'SCHEDULED', admin(T0)))).toBe('INVALID_TRANSITION')
    expect(transition(draft, 'SCHEDULED', admin(T0 - 1)).status).toBe('SCHEDULED')
  })

  it('starts the clock when a scheduled auction goes live, including an early admin start', () => {
    const scheduled = liveAuction(
      { status: 'SCHEDULED', startsAt: T0 + 10 * MINUTE, priceMinor: 0 },
      { timerSeconds: 600, hardStopAfterSeconds: 1_200 },
    )
    expect(codeOf(() => transition(scheduled, 'LIVE', system(T0)))).toBe('INVALID_TRANSITION')
    const early = transition(scheduled, 'LIVE', admin(T0))
    expect(early.startsAt).toBe(T0)
    expect(early.closeAt).toBe(T0 + 600 * SECOND)
    expect(early.hardCloseAt).toBe(T0 + 1_200 * SECOND)
    expect(early.version).toBe(scheduled.version + 1)
  })

  it('requires a reason to pause and forbids pausing in the final 30 seconds', () => {
    const auction = liveAuction({ closeAt: T0 + 5 * MINUTE })
    expect(codeOf(() => transition(auction, 'PAUSED', admin(T0)))).toBe('INVALID_TRANSITION')
    expect(codeOf(() => transition(auction, 'PAUSED', admin(T0, 'oops')))).toBe(
      'INVALID_TRANSITION',
    )
    const late = T0 + 5 * MINUTE - MIN_REMAINING_TO_PAUSE_MS + 1
    expect(codeOf(() => transition(auction, 'PAUSED', admin(late, 'Supplier stock check')))).toBe(
      'INVALID_TRANSITION',
    )
  })

  it('freezes the remaining time on pause and restores it on resume', () => {
    const auction = liveAuction({ closeAt: T0 + 5 * MINUTE })
    const paused = transition(auction, 'PAUSED', admin(T0 + MINUTE, 'Supplier stock check'))
    expect(paused.remainingAtPauseMs).toBe(4 * MINUTE)
    expect(paused.pausedAt).toBe(T0 + MINUTE)
    const resumedAt = T0 + 30 * MINUTE
    const resumed = transition(paused, 'LIVE', admin(resumedAt))
    expect(resumed.closeAt).toBe(resumedAt + 4 * MINUTE)
    expect(resumed.pausedAt).toBeNull()
    expect(resumed.remainingAtPauseMs).toBeNull()
  })

  it('shifts the hard stop by the paused duration and never lets the clock pass it', () => {
    const auction = liveAuction({ closeAt: T0 + 5 * MINUTE, hardCloseAt: T0 + 6 * MINUTE })
    const paused = transition(auction, 'PAUSED', admin(T0 + MINUTE, 'Investigating a report'))
    const resumed = transition(paused, 'LIVE', admin(T0 + 11 * MINUTE))
    expect(resumed.hardCloseAt).toBe(T0 + 16 * MINUTE)
    expect(resumed.closeAt).toBeLessThanOrEqual(resumed.hardCloseAt!)
  })

  it('records the cancellation reason', () => {
    const auction = liveAuction()
    expect(codeOf(() => transition(auction, 'CANCELLED', admin(T0)))).toBe('INVALID_TRANSITION')
    const cancelled = transition(
      auction,
      'CANCELLED',
      admin(T0, '  Item damaged in the warehouse  '),
    )
    expect(cancelled.cancelReason).toBe('Item damaged in the warehouse')
    expect(codeOf(() => transition(cancelled, 'LIVE', admin(T0)))).toBe('INVALID_TRANSITION')
  })
})
