/**
 * Money utilities.
 *
 * All monetary values are represented as integer *minor units* (e.g. pence) with an explicit
 * ISO-4217 currency. Arithmetic never uses floating point for settlement: percentages are
 * expressed in basis points and rounded with an explicit rounding mode using BigInt maths.
 * Floating point is only used at the very edge when formatting for display.
 */

export const CURRENCIES = {
  GBP: { code: 'GBP', exponent: 2, symbol: '£' },
  EUR: { code: 'EUR', exponent: 2, symbol: '€' },
  USD: { code: 'USD', exponent: 2, symbol: '$' },
} as const

export type CurrencyCode = keyof typeof CURRENCIES

export interface Money {
  /** Integer amount in minor units (e.g. pence). */
  readonly amount: number
  readonly currency: CurrencyCode
}

export type RoundingMode = 'HALF_UP' | 'HALF_EVEN' | 'DOWN' | 'UP'

export class MoneyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyError'
  }
}

/** 100% expressed in basis points. */
export const BPS_DENOMINATOR = 10_000

function assertMinorUnits(value: number): void {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`Money amounts must be safe integers in minor units (received ${value})`)
  }
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Currency mismatch: ${a.currency} vs ${b.currency}`)
  }
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return Object.hasOwn(CURRENCIES, value)
}

export function money(amount: number, currency: CurrencyCode = 'GBP'): Money {
  assertMinorUnits(amount)
  return Object.freeze({ amount, currency })
}

export function zero(currency: CurrencyCode = 'GBP'): Money {
  return money(0, currency)
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amount + b.amount, a.currency)
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return money(a.amount - b.amount, a.currency)
}

export function sum(values: readonly Money[], currency: CurrencyCode = 'GBP'): Money {
  return values.reduce((total, value) => add(total, value), zero(currency))
}

/** Multiply by an integer quantity (e.g. unit price × quantity). */
export function multiply(value: Money, quantity: number): Money {
  if (!Number.isSafeInteger(quantity)) {
    throw new MoneyError(`Quantity must be an integer (received ${quantity})`)
  }
  return money(value.amount * quantity, value.currency)
}

export function negate(value: Money): Money {
  return money(value.amount === 0 ? 0 : -value.amount, value.currency)
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b)
  return a.amount === b.amount ? 0 : a.amount < b.amount ? -1 : 1
}

export function isZero(value: Money): boolean {
  return value.amount === 0
}

export function isNegative(value: Money): boolean {
  return value.amount < 0
}

export function min(a: Money, b: Money): Money {
  return compare(a, b) <= 0 ? a : b
}

export function max(a: Money, b: Money): Money {
  return compare(a, b) >= 0 ? a : b
}

export function clampToZero(value: Money): Money {
  return value.amount < 0 ? zero(value.currency) : value
}

/**
 * Integer division with an explicit rounding mode, performed in BigInt to avoid overflow and
 * floating-point error.
 */
export function roundDiv(
  numerator: bigint,
  denominator: bigint,
  mode: RoundingMode = 'HALF_UP',
): bigint {
  if (denominator === 0n) throw new MoneyError('Division by zero')
  const negative = numerator < 0n !== denominator < 0n
  const n = numerator < 0n ? -numerator : numerator
  const d = denominator < 0n ? -denominator : denominator
  const quotient = n / d
  const remainder = n % d
  let result = quotient
  if (remainder !== 0n) {
    const twice = remainder * 2n
    switch (mode) {
      case 'DOWN':
        break
      case 'UP':
        result = quotient + 1n
        break
      case 'HALF_UP':
        if (twice >= d) result = quotient + 1n
        break
      case 'HALF_EVEN':
        if (twice > d || (twice === d && quotient % 2n === 1n)) result = quotient + 1n
        break
    }
  }
  return negative ? -result : result
}

/** Returns `value × bps / 10 000`, rounded. Useful for discounts, commissions and tax. */
export function applyBasisPoints(
  value: Money,
  basisPoints: number,
  mode: RoundingMode = 'HALF_UP',
): Money {
  assertMinorUnits(basisPoints)
  const result = roundDiv(BigInt(value.amount) * BigInt(basisPoints), BigInt(BPS_DENOMINATOR), mode)
  return money(Number(result), value.currency)
}

/** Discount amount for a percentage expressed in basis points (1500 = 15%). Never exceeds the value. */
export function percentageDiscount(value: Money, basisPoints: number): Money {
  if (basisPoints < 0 || basisPoints > BPS_DENOMINATOR) {
    throw new MoneyError(`Discount basis points must be between 0 and ${BPS_DENOMINATOR}`)
  }
  return min(applyBasisPoints(value, basisPoints, 'HALF_UP'), value)
}

/**
 * VAT contained in a tax-inclusive gross amount: gross × rate / (1 + rate).
 * e.g. £120.00 at 20% contains £20.00 VAT.
 */
export function taxFromGross(gross: Money, rateBasisPoints: number): Money {
  assertMinorUnits(rateBasisPoints)
  const result = roundDiv(
    BigInt(gross.amount) * BigInt(rateBasisPoints),
    BigInt(BPS_DENOMINATOR + rateBasisPoints),
    'HALF_UP',
  )
  return money(Number(result), gross.currency)
}

/** Tax to add on top of a tax-exclusive net amount. */
export function taxOnNet(net: Money, rateBasisPoints: number): Money {
  return applyBasisPoints(net, rateBasisPoints, 'HALF_UP')
}

/**
 * Split an amount into parts proportional to `ratios` using the largest-remainder method.
 * The parts always sum exactly to the original amount.
 */
export function allocate(value: Money, ratios: readonly number[]): Money[] {
  if (ratios.length === 0) throw new MoneyError('At least one ratio is required')
  if (ratios.some((ratio) => !Number.isSafeInteger(ratio) || ratio < 0)) {
    throw new MoneyError('Ratios must be non-negative integers')
  }
  const total = ratios.reduce((acc, ratio) => acc + ratio, 0)
  if (total === 0) throw new MoneyError('Ratios must not all be zero')
  const amount = BigInt(value.amount)
  const bigTotal = BigInt(total)
  const shares = ratios.map((ratio) => (amount * BigInt(ratio)) / bigTotal)
  let remainder = amount - shares.reduce((acc, share) => acc + share, 0n)
  const order = ratios
    .map((ratio, index) => ({ index, fraction: (amount * BigInt(ratio)) % bigTotal }))
    .sort((a, b) =>
      b.fraction > a.fraction ? 1 : b.fraction < a.fraction ? -1 : a.index - b.index,
    )
  const step = remainder >= 0n ? 1n : -1n
  for (const { index } of order) {
    if (remainder === 0n) break
    shares[index] = (shares[index] ?? 0n) + step
    remainder -= step
  }
  return shares.map((share) => money(Number(share), value.currency))
}

/**
 * Savings of `paid` relative to `reference`, in basis points (floored, 0–10 000).
 * Returns 0 when the reference is zero or the paid amount is higher.
 */
export function savingsBasisPoints(reference: Money, paid: Money): number {
  assertSameCurrency(reference, paid)
  if (reference.amount <= 0 || paid.amount >= reference.amount) return 0
  const saved = BigInt(reference.amount - Math.max(paid.amount, 0))
  const bps = roundDiv(saved * BigInt(BPS_DENOMINATOR), BigInt(reference.amount), 'DOWN')
  return Math.min(Number(bps), BPS_DENOMINATOR)
}

/** Parse a decimal string in major units ("12.34") into minor units without floating point. */
export function parseMajor(input: string, currency: CurrencyCode = 'GBP'): Money {
  const exponent = CURRENCIES[currency].exponent
  const trimmed = input.trim().replace(/[£€$,\s]/g, '')
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(trimmed)
  if (!match) throw new MoneyError(`Invalid money amount "${input}"`)
  const [, sign, whole = '0', fraction = ''] = match
  if (fraction.length > exponent) {
    throw new MoneyError(`Too many decimal places for ${currency}: "${input}"`)
  }
  const minor = Number(whole) * 10 ** exponent + Number(fraction.padEnd(exponent, '0') || '0')
  return money(sign ? -minor : minor, currency)
}

/** Minor units to a plain major-unit decimal string ("1234" → "12.34"). */
export function toMajorString(value: Money): string {
  const exponent = CURRENCIES[value.currency].exponent
  const negative = value.amount < 0
  const digits = Math.abs(value.amount)
    .toString()
    .padStart(exponent + 1, '0')
  const whole = digits.slice(0, digits.length - exponent)
  const fraction = digits.slice(digits.length - exponent)
  return `${negative ? '-' : ''}${whole}${exponent > 0 ? `.${fraction}` : ''}`
}

const formatterCache = new Map<string, Intl.NumberFormat>()

function getFormatter(
  locale: string,
  currency: CurrencyCode,
  fractionDigits: number,
): Intl.NumberFormat {
  const key = `${locale}|${currency}|${fractionDigits}`
  let formatter = formatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    formatterCache.set(key, formatter)
  }
  return formatter
}

export interface FormatMoneyOptions {
  locale?: string
  /** Drop the minor units when they are zero (e.g. "£999" instead of "£999.00"). */
  trimZeroMinor?: boolean
}

/** Format for display only. */
export function formatMoney(value: Money, options: FormatMoneyOptions = {}): string {
  const { locale = 'en-GB', trimZeroMinor = false } = options
  const exponent = CURRENCIES[value.currency].exponent
  const hasMinor = value.amount % 10 ** exponent !== 0
  const digits = trimZeroMinor && !hasMinor ? 0 : exponent
  return getFormatter(locale, value.currency, digits).format(value.amount / 10 ** exponent)
}

/** Convenience for the common GBP case in UI code. */
export function formatMinor(
  amount: number,
  currency: CurrencyCode = 'GBP',
  options?: FormatMoneyOptions,
): string {
  return formatMoney(money(amount, currency), options)
}

export function formatBasisPoints(bps: number, fractionDigits = 0): string {
  return `${(bps / 100).toFixed(fractionDigits)}%`
}
