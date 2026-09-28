import { route } from '@/server/http/api'

export const GET = route({ auth: 'customer' }, async ({ runtime, viewer }) =>
  runtime.backend.cart(viewer!.userId),
)
