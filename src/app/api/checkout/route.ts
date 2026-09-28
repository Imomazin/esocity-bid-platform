import { checkoutSchema } from '@/server/http/schemas'
import { route } from '@/server/http/api'

/** Place an order. Stock is reserved before payment; payment is simulated in demo mode. */
export const POST = route(
  {
    auth: 'customer',
    rateLimit: 'checkout',
    body: checkoutSchema,
    idempotency: { scope: 'checkout' },
  },
  async ({ body, runtime, viewer, requestId }) =>
    runtime.backend.placeOrder(viewer!.userId, body.mode, {
      promoCode: body.promoCode,
      shippingMethodId: body.shippingMethodId,
      addressId: body.addressId,
      paymentMethod: body.paymentMethod,
      requestId,
    }),
)
