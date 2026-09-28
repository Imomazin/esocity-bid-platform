/**
 * Time formatting helpers. The platform's primary market is the UK, so dates are rendered in
 * the Europe/London time zone on both server and client to avoid hydration mismatches.
 */

export const SECOND = 1_000
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

export const DISPLAY_TIME_ZONE = 'Europe/London'
export const DISPLAY_LOCALE = 'en-GB'

const dateTimeFormat = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const dateFormat = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const shortDateFormat = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  day: 'numeric',
  month: 'short',
})

const timeFormat = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
})

const timeWithSecondsFormat = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export function formatDateTime(epochMs: number): string {
  return dateTimeFormat.format(epochMs)
}

export function formatDate(epochMs: number): string {
  return dateFormat.format(epochMs)
}

export function formatShortDate(epochMs: number): string {
  return shortDateFormat.format(epochMs)
}

export function formatTime(epochMs: number): string {
  return timeFormat.format(epochMs)
}

export function formatTimeWithSeconds(epochMs: number): string {
  return timeWithSecondsFormat.format(epochMs)
}

/** "01:02:03", "02:03" or "0:07" style countdown text. */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / SECOND))
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => value.toString().padStart(2, '0')
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
}

/** Spoken form for assistive technology, e.g. "2 minutes 5 seconds". */
export function describeDuration(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / SECOND))
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []
  if (days) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`)
  if (hours) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`)
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`)
  if (seconds || parts.length === 0)
    parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`)
  return parts.slice(0, 2).join(' ')
}

export function formatRelative(epochMs: number, now: number): string {
  const diff = epochMs - now
  const abs = Math.abs(diff)
  const future = diff > 0
  const wrap = (text: string) => (future ? `in ${text}` : `${text} ago`)
  if (abs < 45 * SECOND) return future ? 'in a few seconds' : 'just now'
  if (abs < 90 * SECOND) return wrap('1 min')
  if (abs < HOUR) return wrap(`${Math.round(abs / MINUTE)} min`)
  if (abs < 1.5 * HOUR) return wrap('1 hr')
  if (abs < DAY) return wrap(`${Math.round(abs / HOUR)} hrs`)
  if (abs < 1.5 * DAY) return future ? 'tomorrow' : 'yesterday'
  if (abs < 30 * DAY) return wrap(`${Math.round(abs / DAY)} days`)
  return formatDate(epochMs)
}

export function startOfUtcDay(epochMs: number): number {
  return Math.floor(epochMs / DAY) * DAY
}

/** ISO week-start (Monday 00:00 UTC) for the given instant. */
export function startOfUtcWeek(epochMs: number): number {
  const day = new Date(startOfUtcDay(epochMs))
  const weekday = (day.getUTCDay() + 6) % 7
  return day.getTime() - weekday * DAY
}

export function startOfUtcMonth(epochMs: number): number {
  const date = new Date(epochMs)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
}

const zonedPartsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** Offset (ms) of Europe/London from UTC at the given instant (0 in winter, 1h in summer). */
export function londonOffsetMs(epochMs: number): number {
  const parts = Object.fromEntries(
    zonedPartsFormat.formatToParts(epochMs).map((part) => [part.type, part.value]),
  )
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return asUtc - Math.floor(epochMs / 1000) * 1000
}

/** Start of the calendar day in Europe/London containing the instant (used for daily limits). */
export function startOfLondonDay(epochMs: number): number {
  const offset = londonOffsetMs(epochMs)
  const localMidnight = startOfUtcDay(epochMs + offset)
  return localMidnight - londonOffsetMs(localMidnight - offset)
}

/** Monday 00:00 Europe/London of the week containing the instant. */
export function startOfLondonWeek(epochMs: number): number {
  const dayStart = startOfLondonDay(epochMs)
  const weekday = (new Date(dayStart + londonOffsetMs(dayStart)).getUTCDay() + 6) % 7
  return startOfLondonDay(dayStart - weekday * DAY + 12 * HOUR)
}

/** First day of the month 00:00 Europe/London. */
export function startOfLondonMonth(epochMs: number): number {
  const offset = londonOffsetMs(epochMs)
  const local = new Date(epochMs + offset)
  const localMonthStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1)
  return localMonthStart - londonOffsetMs(localMonthStart)
}
