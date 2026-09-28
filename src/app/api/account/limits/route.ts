import { limitsSchema } from '@/server/http/schemas'
import { route } from '@/server/http/api'

export const GET = route({ auth: 'customer' }, async ({ runtime, viewer }) =>
  runtime.backend.limits(viewer!.userId),
)

/** Decreases apply immediately; increases take effect after 24 hours; breaks can't be shortened. */
export const PUT = route(
  { auth: 'customer', body: limitsSchema },
  async ({ body, runtime, viewer, requestId }) =>
    runtime.backend.updateLimits(viewer!.userId, body, requestId),
)
