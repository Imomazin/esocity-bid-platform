import { z } from 'zod'

import { route } from '@/server/http/api'

export const POST = route(
  {
    auth: 'customer',
    body: z.object({ ids: z.union([z.literal('all'), z.array(z.string()).max(200)]) }),
  },
  async ({ body, runtime, viewer }) =>
    runtime.backend.markNotificationsRead(viewer!.userId, body.ids),
)
