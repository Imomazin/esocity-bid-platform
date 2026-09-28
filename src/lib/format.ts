import { formatMinor } from '@/lib/money'
import { DISPLAY_TIME_ZONE } from '@/lib/time'

/** Display formatters shared by server and client components (en-GB, GBP). */

const numberFormat = new Intl.NumberFormat('en-GB')

/**
 * Compact notation implemented explicitly (1.2K, 3.4M, 5.6B) rather than with Intl's compact
 * notation, whose output differs between ICU builds (e.g. Node "3.4K" vs Chromium "3.4k") and
 * would cause hydration mismatches between server and browser.
 */
export function compactNumber(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  const tiers: [number, string][] = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ]
  const show = (scaled: number) =>
    Number.isInteger(scaled) ? scaled.toFixed(0) : scaled.toFixed(1)
  for (let index = 0; index < tiers.length; index += 1) {
    const [size, suffix] = tiers[index]!
    if (abs < size) continue
    const scaled = Math.round((abs / size) * 10) / 10
    const larger = tiers[index - 1]
    // 999,960 rounds to "1000K"; promote to the next unit ("1M") instead.
    if (scaled >= 1000 && larger)
      return `${sign}${show(Math.round((abs / larger[0]) * 10) / 10)}${larger[1]}`
    return `${sign}${show(scaled)}${suffix}`
  }
  return `${sign}${show(Math.round(abs * 10) / 10)}`
}

const percent1 = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const percent2 = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const compactMoney = (minor: number) => {
  const pounds = minor / 100
  if (Math.abs(pounds) < 1000)
    return formatMinor(Math.round(minor / 100) * 100, 'GBP', { trimZeroMinor: true })
  return `${pounds < 0 ? '-' : ''}£${compactNumber(Math.abs(pounds))}`
}
export const shortDay = (epochMs: number) =>
  new Date(epochMs).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: DISPLAY_TIME_ZONE,
  })

/** Serialisable formatter names, so server components can configure client charts. */
export type FormatKind =
  'money' | 'compactMoney' | 'number' | 'compactNumber' | 'percent1' | 'percent2'

export const FORMATTERS: Record<FormatKind, (value: number) => string> = {
  money: (value) => formatMinor(value),
  compactMoney,
  number: (value) => numberFormat.format(value),
  compactNumber,
  percent1: (value) => percent1.format(value),
  percent2: (value) => percent2.format(value),
}
