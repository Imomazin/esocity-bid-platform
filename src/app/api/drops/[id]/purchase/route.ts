import { z } from 'zod'

import { paymentMethodSchema } from '@/server/http/schemas'
import { route } from '@/server/http/api'

/** Direct Flash Drop purchase using the member's default address (simulated payment in demo). */
export const POST = route(
  {
    auth: 'customer',
    rateLimit: 'dropPurchase',
    body: z.object({
      quantity: z.number().int().min(1).max(10).default(1),
      paymentMethod: paymentMethodSchema.default('DEMO_CARD'),
      shippingMethodId: z.enum(['STANDARD', 'EXPRESS', 'NEXT_DAY']).default('STANDARD'),
    }),
    idempotency: { scope: 'drop-purchase' },
  },
  async ({ params, body, runtime, viewer, requestId }) => {
    const { id } = params as { id: string }
    return runtime.backend.placeOrder(
      viewer!.userId,
      { kind: 'DROP', dropId: id, quantity: body.quantity },
      { paymentMethod: body.paymentMethod, shippingMethodId: body.shippingMethodId, requestId },
    )
  },
)
