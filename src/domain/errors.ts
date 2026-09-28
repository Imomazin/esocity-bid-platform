/**
 * Domain error codes. Every rejection a customer can see maps to a stable code, an HTTP status
 * and a clear, non-technical message (see src/server/http/errors.ts).
 */

export const DOMAIN_ERROR_CODES = [
  'NOT_FOUND',
  'AUCTION_NOT_FOUND',
  'AUCTION_NOT_LIVE',
  'AUCTION_ENDED',
  'AUCTION_PAUSED',
  'ALREADY_LEADING',
  'INSUFFICIENT_CREDITS',
  'BID_LIMIT_REACHED',
  'PARTICIPANT_CAP_REACHED',
  'NOT_ELIGIBLE',
  'RESPONSIBLE_USE_LIMIT',
  'ACCOUNT_RESTRICTED',
  'RATE_LIMITED',
  'IDEMPOTENCY_CONFLICT',
  'IDEMPOTENCY_IN_PROGRESS',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'CSRF_REJECTED',
  'VALIDATION_FAILED',
  'ITEM_UNAVAILABLE',
  'OUT_OF_STOCK',
  'PAYMENT_FAILED',
  'ORDER_NOT_FOUND',
  'PROMOTION_INVALID',
  'INVALID_TRANSITION',
  'FIELD_LOCKED',
  'DROP_NOT_LIVE',
  'DROP_SOLD_OUT',
  'PURCHASE_LIMIT_REACHED',
  'RECOVERY_NOT_ELIGIBLE',
  'AUTOBID_INVALID',
  'FEATURE_DISABLED',
  'CART_EMPTY',
  'CONFLICT',
  'INTERNAL',
] as const

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number]

/**
 * Registry symbol shared by every copy of this module. Next.js bundles pages and route handlers
 * separately, so one error class can exist more than once in a process; the brand keeps
 * `instanceof DomainError` reliable across those copies.
 */
const DOMAIN_ERROR_BRAND = Symbol.for('esocity.domain-error')

export class DomainError extends Error {
  readonly code: DomainErrorCode
  readonly details?: Record<string, unknown>
  readonly [DOMAIN_ERROR_BRAND] = true

  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.details = details
  }

  static override [Symbol.hasInstance](value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value as Record<symbol, unknown>)[DOMAIN_ERROR_BRAND] === true
    )
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError
}

export type Result<T, E = { code: DomainErrorCode; message: string }> =
  { ok: true; value: T } | { ok: false; error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function fail(code: DomainErrorCode, message: string): Result<never> {
  return { ok: false, error: { code, message } }
}
