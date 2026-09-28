import type { AuctionState } from '@/domain/auction/types'
import { exponential, pickWeighted, rngFor } from '@/lib/rng'
import { SECOND } from '@/lib/time'

import type { SimParams } from './state'

/**
 * Deterministic simulated bidders (DEMO MODE ONLY).
 *
 * The next simulated bid is a pure function of the authoritative auction state, so every server
 * instance derives identical activity for an auction that no real member has touched. When a
 * member bids, the state changes and simulated bidders react to it. The simulation never decides
 * outcomes: it only submits bids through the same authoritative engine as real members.
 *
 * Opening phase  (long countdown): bids arrive as a Poisson process.
 * Closing phase  (final seconds):  bidders respond inside the extension window; the chance that
 *                                  nobody responds grows as the price approaches the auction's
 *                                  simulated demand, so auctions end naturally.
 */

export interface SimulatedBid {
  at: number
  bidderHandle: string
}

export function closingHazard(bidCount: number, targetBids: number): number {
  const progress = bidCount / Math.max(1, targetBids)
  if (progress < 0.8) return 0.00015
  return Math.min(0.92, 0.00015 + 0.4 * ((progress - 0.8) / 0.35) ** 2)
}

function chooseBidder(state: AuctionState, sim: SimParams, rng: () => number): string {
  const candidates = sim.pool.filter((handle) => `sim:${handle}` !== state.leaderId)
  const weights = candidates.map((_, index) => 1 / (index + 1.5))
  return pickWeighted(rng, candidates, weights)
}

export function nextSimulatedBid(state: AuctionState, sim: SimParams): SimulatedBid | null {
  if (state.status !== 'LIVE') return null
  const lastAt = Math.max(state.lastBidAt ?? state.startsAt, state.startsAt)
  if (lastAt >= sim.giveUpAt) return null
  const rng = rngFor(state.id, 'sim', state.bidCount, state.leaderId ?? '-', lastAt)
  const extensionMs = state.rules.timerExtensionSeconds * SECOND
  const closingStart = state.closeAt - extensionMs

  if (lastAt < closingStart) {
    const gap = Math.max(700, Math.round(exponential(rng, sim.openingMeanGapMs)))
    const at = lastAt + gap
    if (at < closingStart) {
      return { at, bidderHandle: chooseBidder(state, sim, rng) }
    }
  }

  // Closing phase: does anyone respond before the clock expires?
  if (rng() < closingHazard(state.bidCount, sim.targetBids)) return null
  const windowStart = Math.max(lastAt, closingStart)
  const window = state.closeAt - windowStart
  if (window <= 300) return null
  const late = rng() < 0.2
  const fraction = late ? 0.7 + rng() * 0.27 : (0.04 + rng() * 0.96) * sim.closingPace
  const at = windowStart + Math.max(250, Math.round(window * Math.min(fraction, 0.97)))
  if (at >= state.closeAt || at >= sim.giveUpAt) return null
  return { at, bidderHandle: chooseBidder(state, sim, rng) }
}

/** Expected number of bids in the opening phase for a given mean gap. */
export function expectedOpeningBids(openMs: number, meanGapMs: number): number {
  return Math.round(openMs / Math.max(meanGapMs, 1))
}

/** Average spacing of closing-phase bids for the given pace and extension window. */
export function expectedClosingGapMs(extensionMs: number, closingPace: number): number {
  return extensionMs * (0.2 * 0.835 + 0.8 * 0.52 * closingPace)
}
