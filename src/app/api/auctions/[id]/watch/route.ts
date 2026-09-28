import { z } from 'zod'

import { route } from '@/server/http/api'

export const POST = route<{ id: string }, { watch?: boolean }>(
  { auth: 'customer', body: z.object({ watch: z.boolean().optional() }) },
  async ({ params, body, runtime, viewer }) =>
    runtime.backend.toggleWatch(viewer!.userId, 'AUCTION', params.id, body.watch),
)
