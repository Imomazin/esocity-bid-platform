import { cartUpdateSchema } from '@/server/http/schemas'
import { route } from '@/server/http/api'

export const PATCH = route(
  { auth: 'customer', body: cartUpdateSchema },
  async ({ params, body, runtime, viewer }) =>
    runtime.backend.updateCartItem(viewer!.userId, (params as { id: string }).id, body.quantity),
)

export const DELETE = route<{ id: string }>(
  { auth: 'customer' },
  async ({ params, runtime, viewer }) => runtime.backend.removeCartItem(viewer!.userId, params.id),
)
