import { newId } from '@/lib/ids'

/**
 * Payment provider abstraction.
 *
 * The platform NEVER collects or stores raw card details. Demo mode uses DemoPaymentProvider,
 * which simulates outcomes with no card data at all. With Stripe configured, payments move to
 * Stripe-hosted Checkout (or Stripe Elements), and confirmation arrives via signed webhooks.
 */

export type PaymentMethodOption = 'DEMO_CARD' | 'DEMO_WALLET' | 'DEMO_DECLINE' | 'HOSTED_CHECKOUT'

export interface ChargeInput {
  amountMinor: number
  currency: string
  reference: string
  description: string
  customerId: string
  method: PaymentMethodOption
  metadata?: Record<string, string>
  successUrl?: string
  cancelUrl?: string
}

export interface ChargeResult {
  status: 'SUCCEEDED' | 'FAILED' | 'REQUIRES_ACTION'
  providerReference: string
  methodLabel: string
  failureReason?: string
  /** Hosted checkout URL when status is REQUIRES_ACTION. */
  redirectUrl?: string
  simulated: boolean
}

export interface RefundInput {
  paymentReference: string
  amountMinor: number
  reason: string
}

export interface RefundResult {
  status: 'SUCCEEDED' | 'FAILED'
  providerReference: string
  simulated: boolean
}

export interface PaymentProvider {
  readonly name: 'demo' | 'stripe'
  readonly simulated: boolean
  charge(input: ChargeInput): Promise<ChargeResult>
  refund(input: RefundInput): Promise<RefundResult>
}

export const DEMO_METHOD_LABELS: Record<Exclude<PaymentMethodOption, 'HOSTED_CHECKOUT'>, string> = {
  DEMO_CARD: 'Demo card (simulated)',
  DEMO_WALLET: 'Demo digital wallet (simulated)',
  DEMO_DECLINE: 'Demo card — simulate a decline',
}

export class DemoPaymentProvider implements PaymentProvider {
  readonly name = 'demo' as const
  readonly simulated = true

  async charge(input: ChargeInput): Promise<ChargeResult> {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0) {
      return {
        status: 'FAILED',
        providerReference: `demo_pi_${newId()}`,
        methodLabel: 'Demo',
        failureReason: 'Invalid amount',
        simulated: true,
      }
    }
    if (input.method === 'DEMO_DECLINE') {
      return {
        status: 'FAILED',
        providerReference: `demo_pi_${newId()}`,
        methodLabel: DEMO_METHOD_LABELS.DEMO_DECLINE,
        failureReason: 'Payment simulation declined (demo). No money was taken.',
        simulated: true,
      }
    }
    const label =
      input.method === 'DEMO_WALLET' ? DEMO_METHOD_LABELS.DEMO_WALLET : DEMO_METHOD_LABELS.DEMO_CARD
    return {
      status: 'SUCCEEDED',
      providerReference: `demo_pi_${newId()}`,
      methodLabel: label,
      simulated: true,
    }
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return {
      status: input.amountMinor > 0 ? 'SUCCEEDED' : 'FAILED',
      providerReference: `demo_re_${newId()}`,
      simulated: true,
    }
  }
}

function formEncode(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
}

/**
 * Stripe adapter using the REST API (no raw card data ever touches Esocity servers).
 * `charge` creates a hosted Checkout Session and returns its URL; the order is marked paid only
 * when the signed `checkout.session.completed` webhook is verified (see verifyStripeSignature).
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe' as const
  readonly simulated = false

  constructor(
    private readonly secretKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async post(
    path: string,
    params: Record<string, string | number | undefined>,
    idempotencyKey: string,
  ) {
    const response = await this.fetchImpl(`https://api.stripe.com/v1/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotencyKey,
      },
      body: formEncode(params),
    })
    const body = (await response.json()) as Record<string, unknown>
    return { ok: response.ok, body }
  }

  async charge(input: ChargeInput): Promise<ChargeResult> {
    const { ok, body } = await this.post(
      'checkout/sessions',
      {
        mode: 'payment',
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.reference,
        'line_items[0][quantity]': 1,
        'line_items[0][price_data][currency]': input.currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': input.amountMinor,
        'line_items[0][price_data][product_data][name]': input.description,
        'metadata[reference]': input.reference,
        'metadata[customer_id]': input.customerId,
      },
      `checkout:${input.reference}`,
    )
    if (!ok) {
      return {
        status: 'FAILED',
        providerReference: '',
        methodLabel: 'Stripe',
        failureReason: 'Payment could not be started',
        simulated: false,
      }
    }
    return {
      status: 'REQUIRES_ACTION',
      providerReference: String(body.id ?? ''),
      methodLabel: 'Stripe Checkout',
      redirectUrl: String(body.url ?? ''),
      simulated: false,
    }
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const { ok, body } = await this.post(
      'refunds',
      {
        payment_intent: input.paymentReference,
        amount: input.amountMinor,
        'metadata[reason]': input.reason,
      },
      `refund:${input.paymentReference}:${input.amountMinor}`,
    )
    return {
      status: ok ? 'SUCCEEDED' : 'FAILED',
      providerReference: String(body.id ?? ''),
      simulated: false,
    }
  }
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Verifies a Stripe webhook signature header ("t=…,v1=…") against the raw payload.
 * Rejects signatures older than `toleranceSeconds` to prevent replay.
 */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header) return false
  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const [key, ...rest] = part.split('=')
      return [key?.trim() ?? '', rest.join('=')]
    }),
  )
  const timestamp = Number(parts.t)
  const signature = parts.v1
  if (!Number.isFinite(timestamp) || !signature) return false
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${payload}`),
  )
  const expected = [...new Uint8Array(mac)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  return timingSafeEqualHex(expected, signature)
}
