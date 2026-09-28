import { describe, expect, it } from 'vitest'

import { compactMoney, compactNumber } from '@/lib/format'
import {
  MoneyError,
  add,
  allocate,
  applyBasisPoints,
  formatMinor,
  money,
  parseMajor,
  percentageDiscount,
  roundDiv,
  savingsBasisPoints,
  subtract,
  taxFromGross,
  toMajorString,
} from '@/lib/money'

describe('money', () => {
  it('only accepts integer minor units', () => {
    expect(money(1999).amount).toBe(1999)
    expect(() => money(19.99)).toThrow(MoneyError)
    expect(() => money(Number.MAX_SAFE_INTEGER + 1)).toThrow(MoneyError)
  })

  it('refuses to mix currencies', () => {
    expect(add(money(100), money(250)).amount).toBe(350)
    expect(subtract(money(100), money(250)).amount).toBe(-150)
    expect(() => add(money(100, 'GBP'), money(100, 'EUR'))).toThrow(/Currency mismatch/)
  })

  it.each([
    [5n, 2n, 'HALF_UP', 3n],
    [5n, 2n, 'HALF_EVEN', 2n],
    [7n, 2n, 'HALF_EVEN', 4n],
    [5n, 2n, 'DOWN', 2n],
    [4n, 3n, 'UP', 2n],
    [-5n, 2n, 'HALF_UP', -3n],
    [6n, 3n, 'UP', 2n],
  ] as const)('roundDiv(%s, %s, %s) = %s', (numerator, denominator, mode, expected) => {
    expect(roundDiv(numerator, denominator, mode)).toBe(expected)
  })

  it('never divides by zero', () => {
    expect(() => roundDiv(1n, 0n)).toThrow(MoneyError)
  })

  it('applies basis points without floating-point drift', () => {
    expect(applyBasisPoints(money(1999), 1500).amount).toBe(300) // 299.85 → 300
    expect(applyBasisPoints(money(333), 3333, 'DOWN').amount).toBe(110)
    // 0.1 + 0.2 style inputs are exact in integer maths.
    expect(applyBasisPoints(money(30), 10_000).amount).toBe(30)
  })

  it('caps percentage discounts at the value and rejects out-of-range rates', () => {
    expect(percentageDiscount(money(1000), 10_000).amount).toBe(1000)
    expect(() => percentageDiscount(money(1000), 10_001)).toThrow(MoneyError)
    expect(() => percentageDiscount(money(1000), -1)).toThrow(MoneyError)
  })

  it('extracts VAT from tax-inclusive UK prices', () => {
    expect(taxFromGross(money(12_000), 2000).amount).toBe(2000)
    expect(taxFromGross(money(999), 2000).amount).toBe(167) // 166.5 → 167
  })

  it('allocates remainders so parts always sum to the whole', () => {
    const parts = allocate(money(100), [1, 1, 1])
    expect(parts.map((part) => part.amount)).toEqual([34, 33, 33])
    const uneven = allocate(money(1001), [3, 7])
    expect(uneven.reduce((total, part) => total + part.amount, 0)).toBe(1001)
    const negative = allocate(money(-100), [1, 1, 1])
    expect(negative.reduce((total, part) => total + part.amount, 0)).toBe(-100)
    expect(() => allocate(money(100), [])).toThrow(MoneyError)
    expect(() => allocate(money(100), [0, 0])).toThrow(MoneyError)
  })

  it('computes savings in basis points, floored and bounded', () => {
    expect(savingsBasisPoints(money(10_000), money(2_500))).toBe(7500)
    expect(savingsBasisPoints(money(3), money(1))).toBe(6666)
    expect(savingsBasisPoints(money(1000), money(1200))).toBe(0)
    expect(savingsBasisPoints(money(0), money(0))).toBe(0)
  })

  it('parses decimal strings without floating point', () => {
    expect(parseMajor('12.34').amount).toBe(1234)
    expect(parseMajor('£1,299.5').amount).toBe(129_950)
    expect(parseMajor('-0.07').amount).toBe(-7)
    expect(parseMajor(' 7 ').amount).toBe(700)
    expect(() => parseMajor('1.234')).toThrow(/Too many decimal places/)
    expect(() => parseMajor('abc')).toThrow(MoneyError)
  })

  it('round-trips minor units through major strings', () => {
    expect(toMajorString(money(5))).toBe('0.05')
    expect(toMajorString(money(-123_456))).toBe('-1234.56')
    for (const amount of [0, 1, 99, 100, 101, 123_456_789]) {
      expect(parseMajor(toMajorString(money(amount))).amount).toBe(amount)
    }
  })

  it('formats GBP for display', () => {
    expect(formatMinor(129_999)).toBe('£1,299.99')
    expect(formatMinor(99_900, 'GBP', { trimZeroMinor: true })).toBe('£999')
    expect(formatMinor(99_950, 'GBP', { trimZeroMinor: true })).toBe('£999.50')
  })
})

describe('deterministic compact formatting', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1_000, '1K'],
    [1_250, '1.3K'],
    [12_345, '12.3K'],
    [999_960, '1M'],
    [3_400_000, '3.4M'],
    [5_600_000_000, '5.6B'],
    [-2_500, '-2.5K'],
  ])('compactNumber(%s) = %s', (value, expected) => {
    expect(compactNumber(value)).toBe(expected)
  })

  it('formats compact money in pounds', () => {
    expect(compactMoney(45_000)).toBe('£450')
    expect(compactMoney(12_345_600)).toBe('£123.5K')
    expect(compactMoney(-250_000_000)).toBe('-£2.5M')
  })
})
