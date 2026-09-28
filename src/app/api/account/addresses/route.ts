import { addressSchema } from '@/server/http/schemas'
import { route } from '@/server/http/api'

export const POST = route(
  { auth: 'customer', body: addressSchema },
  async ({ body, runtime, viewer }) => runtime.backend.addAddress(viewer!.userId, body),
)
