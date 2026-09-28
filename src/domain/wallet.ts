import { DomainError } from '@/domain/errors'
import { DAY } from '@/lib/time'

/**
 * Bid Wallet ledger.
 *
 * Bid credits are NOT money and are held separately from any monetary balance. The wallet is an
 * append-only ledger: balances are never stored as unexplained counters — every balance can be
 * reconstructed by replaying ledger entries. A cached projection (e.g. `bid_wallets` in
 * PostgreSQL) must always reconcile with the ledger.
 *
 * Buckets:
 *  - PURCHASED: credits bought in bid packs (never expire).
 *  - PROMOTIONAL: free credits (welcome bonus, rewards, goodwill). Each grant is a "lot" with an
 *    expiry; spending consumes the earliest-expiring promotional lots first, then purchased.
 */

export const LEDGER_ENTRY_TYPES = [
  'BID_PACK_PURCHASE',
  'PROMOTIONAL_CREDIT',
  'AUCTION_BID',
  'BID_REFUND',
  'BUY_NOW_RECOVERY',
  'ADMIN_ADJUSTMENT',
  'EXPIRY',
] as const

export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number]
export type CreditBucket = 'PURCHASED' | 'PROMOTIONAL'

export type LedgerReferenceType =
  | 'BID'
  | 'AUCTION'
  | 'BID_PACKAGE_ORDER'
  | 'ORDER'
  | 'REWARD_REDEMPTION'
  | 'SUPPORT_TICKET'
  | 'PROMOTION'
  | 'SYSTEM'

export interface LedgerEntry {
  id: string
  userId: string
  type: LedgerEntryType
  bucket: CreditBucket
  /** Signed, non-zero integer number of credits. */
  credits: number
  createdAt: number
  /** Promotional grants only: when the lot expires. */
  expiresAt: number | null
  /** Promotional debits/expiries: the lot consumed. Grants use their own id as the lot id. */
  lotId: string | null
  description: string
  reference: { type: LedgerReferenceType; id: string } | null
  idempotencyKey: string | null
}

export const PROMOTIONAL_CREDIT_VALIDITY_MS = 30 * DAY
export const LOW_BALANCE_THRESHOLD = 20

const CREDIT_TYPES: ReadonlySet<LedgerEntryType> = new Set([
  'BID_PACK_PURCHASE',
  'PROMOTIONAL_CREDIT',
  'BID_REFUND',
  'BUY_NOW_RECOVERY',
])
const DEBIT_TYPES: ReadonlySet<LedgerEntryType> = new Set(['AUCTION_BID', 'EXPIRY'])

/** Structural validation of a single entry (sign conventions per type). */
export function assertValidEntry(entry: LedgerEntry): void {
  if (!Number.isSafeInteger(entry.credits) || entry.credits === 0) {
    throw new DomainError(
      'VALIDATION_FAILED',
      'Ledger entries must move a non-zero integer number of credits',
    )
  }
  if (CREDIT_TYPES.has(entry.type) && entry.credits < 0) {
    throw new DomainError('VALIDATION_FAILED', `${entry.type} entries must be credits (positive)`)
  }
  if (DEBIT_TYPES.has(entry.type) && entry.credits > 0) {
    throw new DomainError('VALIDATION_FAILED', `${entry.type} entries must be debits (negative)`)
  }
  if (entry.type === 'BID_PACK_PURCHASE' && entry.bucket !== 'PURCHASED') {
    throw new DomainError('VALIDATION_FAILED', 'Bid pack purchases credit the PURCHASED bucket')
  }
  if (
    (entry.type === 'PROMOTIONAL_CREDIT' || entry.type === 'EXPIRY') &&
    entry.bucket !== 'PROMOTIONAL'
  ) {
    throw new DomainError('VALIDATION_FAILED', `${entry.type} entries use the PROMOTIONAL bucket`)
  }
}

function sortChronologically(entries: readonly LedgerEntry[]): LedgerEntry[] {
  return [...entries].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
}

export interface BucketBalances {
  purchased: number
  promotional: number
  total: number
}

/** Raw balances by replaying every entry. */
export function ledgerBalances(entries: readonly LedgerEntry[]): BucketBalances {
  let purchased = 0
  let promotional = 0
  for (const entry of entries) {
    if (entry.bucket === 'PURCHASED') purchased += entry.credits
    else promotional += entry.credits
  }
  return { purchased, promotional, total: purchased + promotional }
}

export interface PromoLot {
  lotId: string
  grantedAt: number
  expiresAt: number
  granted: number
  remaining: number
}

/**
 * Reconstructs promotional lots. Debits that name a lot consume it; debits without a lot consume
 * the earliest-expiring open lots (FIFO by expiry).
 */
export function promotionalLots(entries: readonly LedgerEntry[]): PromoLot[] {
  const lots = new Map<string, PromoLot>()
  for (const entry of sortChronologically(entries)) {
    if (entry.bucket !== 'PROMOTIONAL') continue
    if (entry.credits > 0) {
      const lotId = entry.lotId ?? entry.id
      lots.set(lotId, {
        lotId,
        grantedAt: entry.createdAt,
        expiresAt: entry.expiresAt ?? entry.createdAt + PROMOTIONAL_CREDIT_VALIDITY_MS,
        granted: entry.credits,
        remaining: entry.credits,
      })
      continue
    }
    let toConsume = -entry.credits
    const named = entry.lotId ? lots.get(entry.lotId) : undefined
    if (named) {
      const take = Math.min(named.remaining, toConsume)
      named.remaining -= take
      toConsume -= take
    }
    const open = [...lots.values()]
      .filter((lot) => lot.remaining > 0)
      .sort((a, b) => a.expiresAt - b.expiresAt)
    for (const lot of open) {
      if (toConsume === 0) break
      const take = Math.min(lot.remaining, toConsume)
      lot.remaining -= take
      toConsume -= take
    }
  }
  return [...lots.values()]
}

/** EXPIRY entries needed to retire promotional lots that expired at or before `now`. */
export function collectExpiries(
  entries: readonly LedgerEntry[],
  userId: string,
  now: number,
  newId: () => string,
): LedgerEntry[] {
  return promotionalLots(entries)
    .filter((lot) => lot.remaining > 0 && lot.expiresAt <= now)
    .map((lot) => ({
      id: newId(),
      userId,
      type: 'EXPIRY' as const,
      bucket: 'PROMOTIONAL' as const,
      credits: -lot.remaining,
      createdAt: lot.expiresAt,
      expiresAt: null,
      lotId: lot.lotId,
      description: 'Promotional bids expired',
      reference: null,
      idempotencyKey: `expiry:${lot.lotId}`,
    }))
}

export interface WalletSummary {
  available: number
  availablePurchased: number
  availablePromotional: number
  /** Lifetime credits bought in bid packs. */
  purchased: number
  /** Lifetime promotional credits granted. */
  promotional: number
  /** Credits spent on bids (net of nothing — refunds are reported separately). */
  used: number
  expired: number
  refunded: number
  recovered: number
  adjustments: number
  expiringSoon: { credits: number; expiresAt: number } | null
  lowBalance: boolean
}

/**
 * Summary as of `now`. Promotional credits past their expiry are excluded from the available
 * balance even before the EXPIRY entry has been written.
 */
export function summarizeWallet(entries: readonly LedgerEntry[], now: number): WalletSummary {
  const balances = ledgerBalances(entries)
  const lots = promotionalLots(entries)
  const expiredUnwritten = lots
    .filter((lot) => lot.remaining > 0 && lot.expiresAt <= now)
    .reduce((acc, lot) => acc + lot.remaining, 0)
  const availablePromotional = Math.max(0, balances.promotional - expiredUnwritten)
  const availablePurchased = Math.max(0, balances.purchased)
  const byType = (type: LedgerEntryType) =>
    entries.filter((entry) => entry.type === type).reduce((acc, entry) => acc + entry.credits, 0)
  const upcoming = lots
    .filter((lot) => lot.remaining > 0 && lot.expiresAt > now && lot.expiresAt <= now + 7 * DAY)
    .sort((a, b) => a.expiresAt - b.expiresAt)
  const available = availablePurchased + availablePromotional
  return {
    available,
    availablePurchased,
    availablePromotional,
    purchased: byType('BID_PACK_PURCHASE'),
    promotional: byType('PROMOTIONAL_CREDIT'),
    used: -byType('AUCTION_BID'),
    expired: -byType('EXPIRY') + expiredUnwritten,
    refunded: byType('BID_REFUND'),
    recovered: byType('BUY_NOW_RECOVERY'),
    adjustments: byType('ADMIN_ADJUSTMENT'),
    expiringSoon: upcoming[0]
      ? {
          credits: upcoming.reduce((acc, lot) => acc + lot.remaining, 0),
          expiresAt: upcoming[0].expiresAt,
        }
      : null,
    lowBalance: available < LOW_BALANCE_THRESHOLD,
  }
}

export interface DebitAllocation {
  bucket: CreditBucket
  credits: number
  lotId: string | null
}

/**
 * Plans a debit of `credits`: earliest-expiring promotional lots first, then purchased credits.
 * Throws INSUFFICIENT_CREDITS — the wallet can never go negative.
 */
export function planDebit(
  entries: readonly LedgerEntry[],
  credits: number,
  now: number,
): DebitAllocation[] {
  if (!Number.isSafeInteger(credits) || credits <= 0) {
    throw new DomainError('VALIDATION_FAILED', 'Debit must be a positive integer number of credits')
  }
  const summary = summarizeWallet(entries, now)
  if (summary.available < credits) {
    throw new DomainError('INSUFFICIENT_CREDITS', 'You do not have enough bid credits.', {
      available: summary.available,
      required: credits,
    })
  }
  const allocations: DebitAllocation[] = []
  let remaining = credits
  const lots = promotionalLots(entries)
    .filter((lot) => lot.remaining > 0 && lot.expiresAt > now)
    .sort((a, b) => a.expiresAt - b.expiresAt)
  for (const lot of lots) {
    if (remaining === 0) break
    const take = Math.min(lot.remaining, remaining)
    allocations.push({ bucket: 'PROMOTIONAL', credits: take, lotId: lot.lotId })
    remaining -= take
  }
  if (remaining > 0) {
    allocations.push({ bucket: 'PURCHASED', credits: remaining, lotId: null })
  }
  return allocations
}

export interface ReconciliationResult {
  consistent: boolean
  ledger: BucketBalances
  projection: BucketBalances
  negativeBalanceDetected: boolean
}

/** Compares a cached projection with the ledger and checks the running balance never dipped below zero. */
export function reconcile(
  entries: readonly LedgerEntry[],
  projection: Omit<BucketBalances, 'total'>,
): ReconciliationResult {
  const ledger = ledgerBalances(entries)
  let purchased = 0
  let promotional = 0
  let negativeBalanceDetected = false
  for (const entry of sortChronologically(entries)) {
    if (entry.bucket === 'PURCHASED') purchased += entry.credits
    else promotional += entry.credits
    if (purchased < 0 || promotional < 0) negativeBalanceDetected = true
  }
  const normalized = { ...projection, total: projection.purchased + projection.promotional }
  return {
    consistent:
      ledger.purchased === normalized.purchased &&
      ledger.promotional === normalized.promotional &&
      !negativeBalanceDetected,
    ledger,
    projection: normalized,
    negativeBalanceDetected,
  }
}

export const LEDGER_TYPE_LABELS: Record<LedgerEntryType, string> = {
  BID_PACK_PURCHASE: 'Bid pack purchase',
  PROMOTIONAL_CREDIT: 'Promotional credit',
  AUCTION_BID: 'Auction bid',
  BID_REFUND: 'Bid refund',
  BUY_NOW_RECOVERY: 'Buy Now recovery',
  ADMIN_ADJUSTMENT: 'Adjustment',
  EXPIRY: 'Expired',
}

export interface BidPackage {
  id: string
  name: string
  credits: number
  bonusCredits: number
  priceMinor: number
  currency: 'GBP'
  badge: string | null
  description: string
  active: boolean
}

/** Price per credit including bonus credits, in minor units (rounded down to 0.01p precision as tenths). */
export function effectivePricePerCredit(
  pack: Pick<BidPackage, 'credits' | 'bonusCredits' | 'priceMinor'>,
): number {
  return pack.priceMinor / (pack.credits + pack.bonusCredits)
}

/** Index of the pack with the lowest effective price per credit ("best value"). */
export function bestValuePackId(packs: readonly BidPackage[]): string | null {
  const active = packs.filter((pack) => pack.active)
  if (active.length === 0) return null
  return active.reduce((best, pack) =>
    effectivePricePerCredit(pack) < effectivePricePerCredit(best) ? pack : best,
  ).id
}
