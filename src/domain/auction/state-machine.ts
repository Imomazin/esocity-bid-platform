import { DomainError } from '@/domain/errors'
import { SECOND } from '@/lib/time'

import type { AuctionState, AuctionStatus } from './types'

/**
 * Explicit auction lifecycle.
 *
 *   DRAFT ──► SCHEDULED ──► LIVE ──► FINALIZING ──► COMPLETED
 *     │          │  ▲         │  ▲
 *     │          ▼  │         ▼  │
 *     │        DRAFT│       PAUSED
 *     ▼          ▼            ▼
 *   CANCELLED ◄──┴────────────┘
 *
 * FINALIZING and COMPLETED are reachable only by the SYSTEM actor: no human can choose or
 * change an auction winner.
 */
export const AUCTION_TRANSITIONS: Readonly<Record<AuctionStatus, readonly AuctionStatus[]>> = {
  DRAFT: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['LIVE', 'DRAFT', 'CANCELLED'],
  LIVE: ['PAUSED', 'FINALIZING', 'CANCELLED'],
  PAUSED: ['LIVE', 'CANCELLED'],
  FINALIZING: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

export type TransitionActor = 'SYSTEM' | 'ADMIN'

export const SYSTEM_ONLY_TARGETS: ReadonlySet<AuctionStatus> = new Set(['FINALIZING', 'COMPLETED'])

/** Pausing is not allowed in the final seconds — it would be unfair to active bidders. */
export const MIN_REMAINING_TO_PAUSE_MS = 30 * SECOND

export interface TransitionContext {
  actor: TransitionActor
  now: number
  reason?: string
}

export function canTransition(from: AuctionStatus, to: AuctionStatus): boolean {
  return AUCTION_TRANSITIONS[from].includes(to)
}

export function isTerminal(status: AuctionStatus): boolean {
  return AUCTION_TRANSITIONS[status].length === 0
}

export function allowedTransitions(from: AuctionStatus, actor: TransitionActor): AuctionStatus[] {
  return AUCTION_TRANSITIONS[from].filter(
    (to) => actor === 'SYSTEM' || !SYSTEM_ONLY_TARGETS.has(to),
  )
}

function invalid(message: string, from: AuctionStatus, to: AuctionStatus): DomainError {
  return new DomainError('INVALID_TRANSITION', message, { from, to })
}

/** Validates a transition including its guards. Throws DomainError('INVALID_TRANSITION'). */
export function assertTransition(
  state: AuctionState,
  to: AuctionStatus,
  ctx: TransitionContext,
): void {
  const from = state.status
  if (!canTransition(from, to)) {
    throw invalid(`An auction cannot move from ${from} to ${to}.`, from, to)
  }
  if (SYSTEM_ONLY_TARGETS.has(to) && ctx.actor !== 'SYSTEM') {
    throw invalid('Only the auction engine can finalise an auction.', from, to)
  }
  switch (to) {
    case 'SCHEDULED':
      if (from === 'DRAFT' && state.startsAt <= ctx.now) {
        throw invalid('The start time must be in the future to schedule an auction.', from, to)
      }
      break
    case 'LIVE':
      if (from === 'SCHEDULED' && ctx.actor === 'SYSTEM' && ctx.now < state.startsAt) {
        throw invalid('The auction has not reached its start time.', from, to)
      }
      break
    case 'PAUSED': {
      if (!ctx.reason || ctx.reason.trim().length < 5) {
        throw invalid('A reason is required to pause a live auction.', from, to)
      }
      if (state.closeAt - ctx.now < MIN_REMAINING_TO_PAUSE_MS) {
        throw invalid('Auctions cannot be paused in their final 30 seconds.', from, to)
      }
      break
    }
    case 'FINALIZING':
      if (ctx.now < state.closeAt) {
        throw invalid('The auction clock has not expired.', from, to)
      }
      break
    case 'CANCELLED':
      if (!ctx.reason || ctx.reason.trim().length < 5) {
        throw invalid('A reason is required to cancel an auction.', from, to)
      }
      break
    default:
      break
  }
}

/**
 * Applies a transition and its timer side effects, returning the new state.
 * - SCHEDULED → LIVE: the clock starts (an admin "start now" moves the start time to now).
 * - LIVE → PAUSED: the remaining time is frozen.
 * - PAUSED → LIVE: the remaining time is restored (never less than one extension window).
 */
export function transition(
  state: AuctionState,
  to: AuctionStatus,
  ctx: TransitionContext,
): AuctionState {
  assertTransition(state, to, ctx)
  const next: AuctionState = {
    ...state,
    status: to,
    version: state.version + 1,
    updatedAt: ctx.now,
  }
  const extensionMs = state.rules.timerExtensionSeconds * SECOND

  if (state.status === 'SCHEDULED' && to === 'LIVE') {
    const startsAt = Math.min(state.startsAt, ctx.now)
    next.startsAt = startsAt
    next.closeAt = startsAt + state.rules.timerSeconds * SECOND
    next.hardCloseAt = state.rules.hardStopAfterSeconds
      ? startsAt + state.rules.hardStopAfterSeconds * SECOND
      : null
    next.priceMinor = state.bidCount === 0 ? state.rules.startingPriceMinor : state.priceMinor
  }
  if (to === 'PAUSED') {
    next.pausedAt = ctx.now
    next.remainingAtPauseMs = Math.max(0, state.closeAt - ctx.now)
  }
  if (state.status === 'PAUSED' && to === 'LIVE') {
    const pausedFor = ctx.now - (state.pausedAt ?? ctx.now)
    const remaining = Math.max(state.remainingAtPauseMs ?? extensionMs, extensionMs)
    next.closeAt = ctx.now + remaining
    next.hardCloseAt = state.hardCloseAt === null ? null : state.hardCloseAt + pausedFor
    if (next.hardCloseAt !== null) next.closeAt = Math.min(next.closeAt, next.hardCloseAt)
    next.pausedAt = null
    next.remainingAtPauseMs = null
  }
  if (to === 'CANCELLED') {
    next.cancelReason = ctx.reason?.trim() ?? null
  }
  return next
}
