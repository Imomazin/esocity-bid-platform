/**
 * Structured logger with redaction. Never log secrets, tokens, cookies, card data or full
 * personal data. Values under sensitive keys are replaced before serialisation.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const SENSITIVE_KEY =
  /pass(word)?|secret|token|authorization|cookie|api[-_]?key|card|cvc|cvv|iban|session|signature/i
const MAX_DEPTH = 5

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[truncated]'
  if (value === null || typeof value !== 'object') return value
  if (value instanceof Error) {
    return { name: value.name, message: value.message }
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1))
  const output: Record<string, unknown> = {}
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(inner, depth + 1)
  }
  return output
}

function threshold(): number {
  const configured =
    (process.env.LOG_LEVEL as Level | undefined) ??
    (process.env.NODE_ENV === 'test' ? 'warn' : 'info')
  return LEVEL_ORDER[configured] ?? LEVEL_ORDER.info
}

function write(level: Level, message: string, fields?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < threshold()) return
  const line = JSON.stringify({
    level,
    msg: message,
    time: new Date().toISOString(),
    ...(redact(fields ?? {}) as object),
  })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => write('debug', message, fields),
  info: (message: string, fields?: Record<string, unknown>) => write('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>) => write('error', message, fields),
}
