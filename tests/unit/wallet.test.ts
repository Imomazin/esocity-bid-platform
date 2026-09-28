import { describe, expect, it } from 'vitest'

import { DomainError } from '@/domain/errors'
import {
  PROMOTIONAL_CREDIT_VALIDITY_MS,
  assertValidEntry,
  bestValuePackId,
  collectExpiries,
  planDebit,
  promotionalLots,
  reconcile,
  summarizeWallet,
  type BidPackage,
  type LedgerEntry,
} from '@/domain/wallet'
import { DAY } from '@/lib/time'

import { T0, entry } from './fixtures'

const purchase = (credits: number, at = T0) =>
  entry({ type: 'BID_PACK_PURCHASE', bucket: 'PURCHASED', credits, createdAt: at })
const promo = (credits: number, at = T0, expiresAt: number | null = null) =>
  entry({ type: 'PROMOTIONAL_CREDIT', bucket: 'PROMOTIONAL', credits, createdAt: at, expiresAt })

/** Writes the planned debit as ledger entries, as both engines do. */
function spend(entries: LedgerEntry[], credits: number, at: number): LedgerEntry[] {
  const debits = planDebit(entries, credits, at).map((allocation) =>
    entry({
      type: 'AUCTION_BID',
      bucket: allocation.bucket,
      credits: -allocation.credits,
      lotId: allocation.lotId,
      createdAt: at,
    }),
  )
  return [...entries, ...debits]
}

describe('bid wallet ledger', () => {
  it('enforces sign and bucket conventions for each entry type', () => {
    expect(() => assertValidEntry(purchase(0))).toThrow(DomainError)
    expect(() =>
      assertValidEntry(entry({ type: 'AUCTION_BID', bucket: 'PURCHASED', credits: 1 })),
    ).toThrow(/debits/)
    expect(() =>
      assertValidEntry(entry({ type: 'BID_REFUND', bucket: 'PURCHASED', credits: -1 })),
    ).toThrow(/credits/)
    expect(() =>
      assertValidEntry(entry({ type: 'BID_PACK_PURCHASE', bucket: 'PROMOTIONAL', credits: 10 })),
    ).toThrow(/PURCHASED/)
    expect(() =>
      assertValidEntry(entry({ type: 'EXPIRY', bucket: 'PURCHASED', credits: -1 })),
    ).toThrow(/PROMOTIONAL/)
    expect(() =>
      assertValidEntry(entry({ type: 'ADMIN_ADJUSTMENT', bucket: 'PURCHASED', credits: -5 })),
    ).not.toThrow()
  })

  it('spends the earliest-expiring promotional lots first, then purchased credits', () => {
    const soon = promo(3, T0, T0 + 2 * DAY)
    const later = promo(5, T0, T0 + 20 * DAY)
    const entries = [purchase(100), later, soon]
    expect(planDebit(entries, 6, T0 + DAY)).toEqual([
      { bucket: 'PROMOTIONAL', credits: 3, lotId: soon.id },
      { bucket: 'PROMOTIONAL', credits: 3, lotId: later.id },
    ])
    expect(planDebit(entries, 10, T0 + DAY).at(-1)).toEqual({
      bucket: 'PURCHASED',
      credits: 2,
      lotId: null,
    })
  })

  it('never lets the balance go negative', () => {
    const entries = [purchase(2)]
    expect(() => planDebit(entries, 3, T0)).toThrow(
      expect.objectContaining({ code: 'INSUFFICIENT_CREDITS' }),
    )
    expect(() => planDebit(entries, 0, T0)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }),
    )
    let ledger = spend(entries, 2, T0)
    expect(summarizeWallet(ledger, T0).available).toBe(0)
    expect(() => spend(ledger, 1, T0)).toThrow(DomainError)
    ledger = [
      ...ledger,
      entry({ type: 'BID_REFUND', bucket: 'PURCHASED', credits: 2, createdAt: T0 + 1 }),
    ]
    expect(reconcile(ledger, { purchased: 2, promotional: 0 })).toMatchObject({
      consistent: true,
      negativeBalanceDetected: false,
    })
  })

  it('excludes expired promotional credits from the balance before the expiry entry is written', () => {
    const lot = promo(10, T0, T0 + DAY)
    const entries = [purchase(5), lot]
    expect(summarizeWallet(entries, T0).available).toBe(15)
    const afterExpiry = summarizeWallet(entries, T0 + DAY)
    expect(afterExpiry).toMatchObject({ available: 5, availablePromotional: 0, expired: 10 })
    expect(() => planDebit(entries, 6, T0 + DAY)).toThrow(
      expect.objectContaining({ code: 'INSUFFICIENT_CREDITS' }),
    )
  })

  it('writes one idempotent EXPIRY entry per lapsed lot for the unspent remainder', () => {
    let ledger: LedgerEntry[] = [promo(10, T0)]
    ledger = spend(ledger, 4, T0 + DAY)
    const expiries = collectExpiries(
      ledger,
      'user-1',
      T0 + PROMOTIONAL_CREDIT_VALIDITY_MS,
      () => 'expiry-1',
    )
    expect(expiries).toHaveLength(1)
    expect(expiries[0]).toMatchObject({
      type: 'EXPIRY',
      credits: -6,
      idempotencyKey: `expiry:${ledger[0]!.id}`,
    })
    const settled = [...ledger, ...expiries]
    expect(
      collectExpiries(settled, 'user-1', T0 + 2 * PROMOTIONAL_CREDIT_VALIDITY_MS, () => 'expiry-2'),
    ).toEqual([])
    expect(promotionalLots(settled)[0]!.remaining).toBe(0)
    expect(summarizeWallet(settled, T0 + PROMOTIONAL_CREDIT_VALIDITY_MS)).toMatchObject({
      available: 0,
      used: 4,
      expired: 6,
    })
  })

  it('reports lifetime totals and credits expiring within seven days', () => {
    const ledger = spend([purchase(50), promo(10, T0, T0 + 5 * DAY)], 12, T0 + DAY)
    const summary = summarizeWallet(ledger, T0 + DAY)
    expect(summary).toMatchObject({
      available: 48,
      purchased: 50,
      promotional: 10,
      used: 12,
      lowBalance: false,
    })
    expect(summary.expiringSoon).toBeNull() // the promotional lot was fully spent first
    const withLot = summarizeWallet([purchase(5), promo(10, T0, T0 + 5 * DAY)], T0)
    expect(withLot.expiringSoon).toEqual({ credits: 10, expiresAt: T0 + 5 * DAY })
    expect(withLot.lowBalance).toBe(true)
  })

  it('detects a projection that disagrees with the ledger', () => {
    const ledger = [purchase(10)]
    expect(reconcile(ledger, { purchased: 11, promotional: 0 }).consistent).toBe(false)
    const overdrawn = [
      purchase(1),
      entry({ type: 'AUCTION_BID', bucket: 'PURCHASED', credits: -2, createdAt: T0 + 1 }),
      purchase(5, T0 + 2),
    ]
    expect(reconcile(overdrawn, { purchased: 4, promotional: 0 })).toMatchObject({
      consistent: false,
      negativeBalanceDetected: true,
    })
  })

  it('identifies the best-value active bid pack including bonus credits', () => {
    const pack = (
      id: string,
      credits: number,
      bonusCredits: number,
      priceMinor: number,
      active = true,
    ): BidPackage => ({
      id,
      name: id,
      credits,
      bonusCredits,
      priceMinor,
      currency: 'GBP',
      badge: null,
      description: '',
      active,
    })
    expect(
      bestValuePackId([
        pack('starter', 50, 0, 3000),
        pack('pro', 500, 100, 24_000),
        pack('legacy', 1000, 0, 1000, false),
      ]),
    ).toBe('pro')
    expect(bestValuePackId([])).toBeNull()
  })
})
