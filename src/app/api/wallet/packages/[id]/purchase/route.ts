import { bidPackPurchaseSchema } from '@/server/http/schemas'
import { route } from '@/server/http/api'

/** Buy a bid pack (simulated payment in demo mode). Idempotent and budget-checked. */
export const POST = route(
  {
    auth: 'customer',
    rateLimit: 'walletPurchase',
    body: bidPackPurchaseSchema,
    idempotency: { scope: 'bid-pack-purchase' },
  },
  async ({ params, body, runtime, viewer, requestId }) => {
    const { id } = params as { id: string }
    return runtime.backend.purchaseBidPackage(viewer!.userId, id, {
      promoCode: body.promoCode,
      paymentMethod: body.paymentMethod,
      requestId,
    })
  },
)
