import { HOUR } from '@/lib/time'

import type { AuctionRules, AuctionState, RecoveryMode } from './types'

/**
 * Bid Credit Recovery (a.k.a. Bid Value Recovery).
 *
 * Where the auction rules — and the market configuration — permit it, a member who bid in an
 * auction but did not win may buy the item at its Buy Now price and recover eligible bids:
 *  - RETURN_BIDS: eligible bid credits are returned to the Bid Wallet (ledger: BUY_NOW_RECOVERY).
 *  - PRICE_CREDIT: the value of eligible bids is deducted from the Buy Now price.
 *
 * This mechanism is configurable per auction and per market because its commercial and legal
 * treatment can differ by jurisdiction (docs/COMPLIANCE.md).
 */

export interface RecoveryInput {
  rules: AuctionRules
  auction: Pick<AuctionState, 'status' | 'result' | 'leaderId' | 'id'>
  userId: string
  /** Credits this member spent in the auction, by source. */
  purchasedCreditsSpent: number
  promotionalCreditsSpent: number
  /** Value attributed to one purchased bid credit, in minor units (e.g. average pack price). */
  creditValueMinor: number
  buyNowPriceMinor: number
  now: number
  alreadyRecovered: boolean
  marketAllowsRecovery: boolean
  featureEnabled: boolean
}

export interface RecoveryQuote {
  eligible: boolean
  reasons: string[]
  mode: RecoveryMode
  credits: number
  purchasedCredits: number
  promotionalCredits: number
  valueMinor: number
  /** Price the member pays (Buy Now price minus any price credit). */
  payableMinor: number
  windowEndsAt: number | null
}

export function recoveryWindowEndsAt(
  input: Pick<RecoveryInput, 'rules' | 'auction'>,
): number | null {
  if (input.auction.status === 'COMPLETED' && input.auction.result) {
    return input.auction.result.closedAt + input.rules.recoveryWindowHours * HOUR
  }
  return null
}

export function quoteRecovery(input: RecoveryInput): RecoveryQuote {
  const { rules, auction } = input
  const reasons: string[] = []
  const purchasedCredits = input.purchasedCreditsSpent
  // Promotional bids can be returned as bids, but never converted into a money-value price credit.
  const promotionalCredits =
    rules.recoveryMode === 'RETURN_BIDS' && rules.recoverPromotionalBids
      ? input.promotionalCreditsSpent
      : 0
  const credits = purchasedCredits + promotionalCredits
  const windowEndsAt = recoveryWindowEndsAt(input)

  if (!input.featureEnabled || !input.marketAllowsRecovery)
    reasons.push('Bid recovery is not available in your market.')
  if (!rules.buyNowEnabled) reasons.push('Buy Now is not available for this auction.')
  if (!rules.bidCreditRecoveryEnabled) reasons.push('This auction does not offer bid recovery.')
  if (input.purchasedCreditsSpent + input.promotionalCreditsSpent === 0) {
    reasons.push('You have not bid in this auction.')
  } else if (credits === 0) {
    reasons.push(
      rules.recoveryMode === 'PRICE_CREDIT'
        ? 'Only purchased bids can be credited against the Buy Now price.'
        : 'Only purchased bids are eligible for recovery in this auction.',
    )
  }
  if (input.alreadyRecovered) reasons.push('You have already used bid recovery for this auction.')
  if (auction.status === 'CANCELLED') reasons.push('Cancelled auctions refund bids automatically.')
  if (auction.result?.winnerId === input.userId) reasons.push('You won this auction.')
  if (auction.result?.bidsRefunded) reasons.push('Bids for this auction were already refunded.')
  if (windowEndsAt !== null && input.now > windowEndsAt)
    reasons.push('The recovery window has closed.')

  const eligible = reasons.length === 0
  const rawValue = purchasedCredits * input.creditValueMinor
  const valueMinor = eligible
    ? rules.recoveryMode === 'PRICE_CREDIT'
      ? Math.min(rawValue, input.buyNowPriceMinor)
      : rawValue
    : 0
  const payableMinor =
    eligible && rules.recoveryMode === 'PRICE_CREDIT'
      ? input.buyNowPriceMinor - valueMinor
      : input.buyNowPriceMinor

  return {
    eligible,
    reasons,
    mode: rules.recoveryMode,
    credits: eligible ? credits : 0,
    purchasedCredits: eligible ? purchasedCredits : 0,
    promotionalCredits: eligible ? promotionalCredits : 0,
    valueMinor,
    payableMinor,
    windowEndsAt,
  }
}
