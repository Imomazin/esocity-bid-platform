/** Helpers for money form fields: pounds text <-> integer minor units, without floating point. */

export function minorToInput(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return ''
  const pounds = Math.trunc(minor / 100)
  const pence = Math.abs(minor % 100)
  return pence === 0 ? String(pounds) : `${pounds}.${String(pence).padStart(2, '0')}`
}

/** Parses "12", "12.5", "12.50" or "£12.50" into minor units. Empty → null. */
export function parsePoundsInput(value: string): number | null | 'invalid' {
  const trimmed = value.trim().replace(/^£/, '').replace(/,/g, '')
  if (!trimmed) return null
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return 'invalid'
  const [whole = '0', fraction = ''] = trimmed.split('.')
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, '0'), 10)
}

export function parseWholeInput(value: string): number | null | 'invalid' {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d+$/.test(trimmed)) return 'invalid'
  return Number.parseInt(trimmed, 10)
}
