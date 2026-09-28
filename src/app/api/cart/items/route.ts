import { cartItemSchema } from '@/server/http/schemas'
import { route } from '@/server/http/api'

export const POST = route(
  { auth: 'customer', body: cartItemSchema },
  async ({ body, runtime, viewer }) =>
    runtime.backend.addToCart(viewer!.userId, body.productId, body.quantity),
)
