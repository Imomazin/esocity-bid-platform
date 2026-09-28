import { watchSchema } from '@/server/http/schemas'
import { route } from '@/server/http/api'

export const GET = route({ auth: 'customer' }, async ({ runtime, viewer }) =>
  runtime.backend.watchlist(viewer!.userId),
)

export const POST = route(
  { auth: 'customer', body: watchSchema },
  async ({ body, runtime, viewer }) =>
    runtime.backend.toggleWatch(viewer!.userId, body.type, body.targetId, body.watch),
)
