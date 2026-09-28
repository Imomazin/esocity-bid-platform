import { describe, expect, it, vi } from 'vitest'

import {
  DemoPaymentProvider,
  StripePaymentProvider,
  verifyStripeSignature,
  type ChargeInput,
} from '@/server/providers/payments'

const charge = (overrides: Partial<ChargeInput> = {}): ChargeInput => ({
  amountMinor: 4_999,
  currency: 'GBP',
  reference: 'ESB-TEST01',
  description: 'Test order',
  customerId: 'user-1',
  method: 'DEMO_CARD',
  ...overrides,
})

async function sign(payload: string, secret: string, timestamp: number): Promise<string> {
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
  return [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

describe('demo payments', () => {
  it('simulates success and decline without any card data', async () => {
    const provider = new DemoPaymentProvider()
    expect(await provider.charge(charge())).toMatchObject({ status: 'SUCCEEDED', simulated: true })
    const declined = await provider.charge(charge({ method: 'DEMO_DECLINE' }))
    expect(declined).toMatchObject({ status: 'FAILED', simulated: true })
    expect(declined.failureReason).toMatch(/No money was taken/)
    expect(await provider.charge(charge({ amountMinor: -1 }))).toMatchObject({ status: 'FAILED' })
  })
})

describe('Stripe adapter', () => {
  it('starts a hosted Checkout Session with an idempotency key and never sends card data', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      Response.json({ id: 'cs_test_123', url: 'https://checkout.stripe.test/session' }),
    )
    const provider = new StripePaymentProvider(
      'test-key-not-real',
      fetchImpl as unknown as typeof fetch,
    )
    const result = await provider.charge(
      charge({
        method: 'HOSTED_CHECKOUT',
        successUrl: 'https://example.test/ok',
        cancelUrl: 'https://example.test/cancel',
      }),
    )
    expect(result).toMatchObject({
      status: 'REQUIRES_ACTION',
      redirectUrl: 'https://checkout.stripe.test/session',
      simulated: false,
    })
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(String(url)).toBe('https://api.stripe.com/v1/checkout/sessions')
    expect((init!.headers as Record<string, string>)['Idempotency-Key']).toBe('checkout:ESB-TEST01')
    const body = String(init!.body)
    expect(body).toContain('line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=4999')
    expect(body).not.toMatch(/card|cvc|number/i)
  })

  it('verifies webhook signatures and rejects tampering and replays', async () => {
    const secret = 'webhook-test-secret-not-real'
    const payload = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_123' } },
    })
    const now = 1_800_000_000
    const header = `t=${now},v1=${await sign(payload, secret, now)}`
    expect(await verifyStripeSignature(payload, header, secret, now)).toBe(true)
    expect(
      await verifyStripeSignature(payload.replace('completed', 'expired'), header, secret, now),
    ).toBe(false)
    expect(await verifyStripeSignature(payload, header, 'another-secret', now)).toBe(false)
    expect(await verifyStripeSignature(payload, header, secret, now + 301)).toBe(false)
    expect(await verifyStripeSignature(payload, null, secret, now)).toBe(false)
    expect(await verifyStripeSignature(payload, 't=abc,v1=00', secret, now)).toBe(false)
  })
})
